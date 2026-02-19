import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildRepoContext, latestOutput, loadStageTemplate, renderTemplate } from "@/lib/harness/prompts";
import { runClaudePrompt, runMockStage, runTestCommand } from "@/lib/harness/runners";
import { JsonRunStore } from "@/lib/harness/store";
import type {
  RepoConfig,
  RunEvent,
  RunRecord,
  RunnerMode,
  RunnerResult,
  StageAttempt,
  StageName,
  StageRun,
} from "@/lib/harness/types";
import { STAGE_ORDER } from "@/lib/harness/types";
import { provisionWorktree, teardownWorktree } from "@/lib/harness/workspace-manager";

const STAGE_TIMEOUT_MS: Record<StageName, number> = {
  Plan: 120_000,
  Implement: 180_000,
  Verify: 120_000,
  Test: 300_000,
  PR: 120_000,
};

export interface CreateRunInput {
  ticket: string;
  repoPath: string;
  repoId?: string;
  runnerMode: RunnerMode;
  testCommand: string;
  prMode: "simulate";
}

function nowIso(): string {
  return new Date().toISOString();
}

function stageDefault(name: StageName): StageRun {
  return {
    name,
    status: "queued",
    attempts: [],
    lastError: "",
    promptOverride: null,
    skipReason: "",
    startedAt: null,
    endedAt: null,
  };
}

function appendEvent(run: RunRecord, event: Omit<RunEvent, "timestamp">): void {
  run.events.push({
    ...event,
    timestamp: nowIso(),
  });
}

export class HarnessOrchestrator {
  private store: JsonRunStore;
  private active = new Set<string>();

  constructor(store: JsonRunStore) {
    this.store = store;
  }

  async listRuns(): Promise<RunRecord[]> {
    const runs = await this.store.listRuns();
    return runs.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    return this.store.getRun(runId);
  }

  async createRun(input: CreateRunInput): Promise<RunRecord> {
    const runId = crypto.randomUUID();
    let repoPath = path.resolve(input.repoPath || ".");
    let repoId: string | null = null;
    let worktree: RunRecord["worktree"] = null;
    let repo: RepoConfig | null = null;

    if (input.repoId) {
      repo = await this.store.getRepo(input.repoId);
      if (!repo) {
        throw new Error("repo not found");
      }
      repoId = repo.id;
      const worktreeInfo = await provisionWorktree(repo, runId);
      worktree = worktreeInfo;
      repoPath = worktreeInfo.worktreePath;
    }

    const run: RunRecord = {
      id: runId,
      ticket: input.ticket.trim(),
      repoPath,
      repoId,
      worktree,
      runnerMode: input.runnerMode,
      testCommand: input.testCommand.trim() || "pnpm lint",
      prMode: "simulate",
      status: "queued",
      currentStage: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      repoContext: await buildRepoContext(repoPath),
      stages: STAGE_ORDER.map((name) => stageDefault(name)),
      events: [],
    };
    appendEvent(run, {
      type: "run_created",
      stage: "",
      message: "Run created",
    });
    await this.store.createRun(run);

    const progressDir = path.dirname(this.progressPath(run.id));
    await mkdir(progressDir, { recursive: true });
    await writeFile(
      this.progressPath(run.id),
      `# Progress — Run ${run.id}\n\nTicket: ${run.ticket}\n\n`,
      "utf8",
    );

    await this.startRun(run.id);
    return (await this.store.getRun(run.id)) as RunRecord;
  }

  async startRun(runId: string): Promise<RunRecord> {
    const existing = await this.store.getRun(runId);
    if (!existing) {
      throw new Error("run not found");
    }
    if (this.active.has(runId)) {
      return existing;
    }
    this.active.add(runId);
    void this.executeLoop(runId);
    return existing;
  }

  async retryStage(runId: string, stageName: StageName): Promise<RunRecord> {
    return this.retryFrom(runId, stageName);
  }

  async retryFrom(runId: string, stageName: StageName): Promise<RunRecord> {
    if (this.active.has(runId)) {
      throw new Error("run is currently active");
    }
    const run = await this.requireRun(runId);
    const startIdx = STAGE_ORDER.findIndex((name) => name === stageName);
    if (startIdx === -1) {
      throw new Error("invalid stage");
    }
    for (let i = startIdx; i < run.stages.length; i += 1) {
      run.stages[i].status = "queued";
      run.stages[i].lastError = "";
      run.stages[i].skipReason = "";
      run.stages[i].startedAt = null;
      run.stages[i].endedAt = null;
    }
    run.status = "queued";
    run.currentStage = null;
    run.updatedAt = nowIso();
    appendEvent(run, {
      type: "retry_from",
      stage: stageName,
      message: `Retry from ${stageName}`,
    });
    await this.store.saveRun(run);
    await this.startRun(runId);
    return (await this.requireRun(runId)) as RunRecord;
  }

  async editPromptAndRerun(runId: string, stageName: StageName, prompt: string): Promise<RunRecord> {
    if (this.active.has(runId)) {
      throw new Error("run is currently active");
    }
    const run = await this.requireRun(runId);
    const stage = run.stages.find((item) => item.name === stageName);
    if (!stage) {
      throw new Error("invalid stage");
    }
    stage.promptOverride = prompt;
    appendEvent(run, {
      type: "prompt_override",
      stage: stageName,
      message: "Prompt override applied",
    });
    await this.store.saveRun(run);
    return this.retryFrom(runId, stageName);
  }

  async skipStage(runId: string, stageName: StageName, reason: string): Promise<RunRecord> {
    if (this.active.has(runId)) {
      throw new Error("run is currently active");
    }
    const run = await this.requireRun(runId);
    const stage = run.stages.find((item) => item.name === stageName);
    if (!stage) {
      throw new Error("invalid stage");
    }
    if (stage.status === "done") {
      throw new Error("cannot skip a completed stage");
    }
    stage.status = "skipped";
    stage.skipReason = reason.trim() || "No reason provided";
    stage.endedAt = nowIso();
    stage.lastError = "";
    run.status = "queued";
    run.currentStage = null;
    run.updatedAt = nowIso();
    appendEvent(run, {
      type: "stage_skipped",
      stage: stageName,
      message: stage.skipReason,
    });
    await this.store.saveRun(run);
    await this.startRun(run.id);
    return (await this.requireRun(run.id)) as RunRecord;
  }

  async cleanWorkspace(runId: string): Promise<RunRecord> {
    const run = await this.requireRun(runId);
    if (!run.worktree || !run.repoId) {
      throw new Error("run has no worktree to clean");
    }
    if (run.worktree.status === "cleaned") {
      throw new Error("worktree already cleaned");
    }
    if (this.active.has(runId)) {
      throw new Error("cannot clean workspace while run is active");
    }
    const repo = await this.store.getRepo(run.repoId);
    if (!repo) {
      throw new Error("repo not found");
    }
    await teardownWorktree(repo, run.worktree);
    run.worktree.status = "cleaned";
    run.updatedAt = nowIso();
    appendEvent(run, {
      type: "workspace_cleaned",
      stage: "",
      message: "Worktree removed",
    });
    await this.store.saveRun(run);
    return run;
  }

  async listRepos(): Promise<RepoConfig[]> {
    return this.store.listRepos();
  }

  async getRepo(repoId: string): Promise<RepoConfig | null> {
    return this.store.getRepo(repoId);
  }

  async createRepo(repo: RepoConfig): Promise<RepoConfig> {
    return this.store.createRepo(repo);
  }

  async saveRepo(repo: RepoConfig): Promise<RepoConfig> {
    return this.store.saveRepo(repo);
  }

  async deleteRepo(repoId: string): Promise<void> {
    return this.store.deleteRepo(repoId);
  }

  private async executeLoop(runId: string): Promise<void> {
    try {
      while (true) {
        const run = await this.requireRun(runId);
        const next = run.stages.find((stage) => stage.status === "queued");
        if (!next) {
          run.status = "done";
          run.currentStage = null;
          run.updatedAt = nowIso();
          appendEvent(run, {
            type: "run_done",
            stage: "",
            message: "All stages completed",
          });
          await this.store.saveRun(run);
          return;
        }

        const attempt: StageAttempt = {
          attempt: next.attempts.length + 1,
          startedAt: nowIso(),
          endedAt: null,
          status: "running",
          prompt: "",
          artifactPath: "",
          logPath: "",
          outputPreview: "",
          logsPreview: "",
          error: "",
        };
        const prompt = next.promptOverride ?? (await this.buildPrompt(run, next.name));
        attempt.prompt = prompt;
        next.status = "running";
        next.startedAt = nowIso();
        next.endedAt = null;
        next.lastError = "";
        next.attempts.push(attempt);
        run.status = "running";
        run.currentStage = next.name;
        run.updatedAt = nowIso();
        appendEvent(run, {
          type: "stage_started",
          stage: next.name,
          message: "",
        });
        await this.store.saveRun(run);

        const result = await this.executeStage(run, next.name, prompt);
        await this.applyStageResult(runId, next.name, result);
        if (!result.success) {
          return;
        }
      }
    } finally {
      this.active.delete(runId);
    }
  }

  private async buildPrompt(run: RunRecord, stageName: StageName): Promise<string> {
    const template = await loadStageTemplate(stageName);
    return renderTemplate(template, {
      run_id: run.id,
      ticket: run.ticket,
      repo_path: run.repoPath,
      repo_context: run.repoContext,
      progress_path: this.progressPath(run.id),
      plan_artifact: latestOutput(run, "Plan"),
      implementation_artifact: latestOutput(run, "Implement"),
      verify_artifact: latestOutput(run, "Verify"),
      test_report: latestOutput(run, "Test"),
      feedback: this.buildFeedback(run, stageName),
    });
  }

  private buildFeedback(run: RunRecord, stageName: StageName): string {
    const lines: string[] = [];
    const stageIdx = STAGE_ORDER.indexOf(stageName);
    const stage = run.stages.find((s) => s.name === stageName);

    // Same-stage: prior failed attempts of THIS stage
    if (stage) {
      const failedAttempts = stage.attempts.filter((a) => a.status === "failed");
      for (const attempt of failedAttempts) {
        lines.push(`### ${stageName} — Attempt ${attempt.attempt} (failed)`);
        if (attempt.error) {
          lines.push(`Error: ${attempt.error}`);
        }
        if (attempt.outputPreview) {
          lines.push(`Output: ${attempt.outputPreview.slice(0, 2000)}`);
        }
        lines.push("");
      }
    }

    // Cross-stage: downstream stage failures
    for (let i = stageIdx + 1; i < STAGE_ORDER.length; i += 1) {
      const downstreamName = STAGE_ORDER[i];
      const downstream = run.stages.find((s) => s.name === downstreamName);
      if (!downstream || downstream.attempts.length === 0) continue;
      const lastAttempt = downstream.attempts[downstream.attempts.length - 1];
      if (lastAttempt.status !== "failed") continue;

      lines.push(`### ${downstreamName} stage feedback (failed)`);
      if (lastAttempt.error) {
        lines.push(`Error: ${lastAttempt.error}`);
      }
      if (lastAttempt.outputPreview) {
        lines.push(`Output: ${lastAttempt.outputPreview.slice(0, 2000)}`);
      }
      if (lastAttempt.logsPreview) {
        lines.push(`Logs: ${lastAttempt.logsPreview.slice(0, 2000)}`);
      }
      lines.push("");
    }

    if (lines.length === 0) return "";

    return [
      "## Feedback from prior attempts",
      "",
      "The following issues were found in previous attempts. You MUST address these in this attempt.",
      "",
      ...lines,
    ].join("\n");
  }

  private async executeStage(run: RunRecord, stageName: StageName, prompt: string): Promise<RunnerResult> {
    const timeoutMs = STAGE_TIMEOUT_MS[stageName] ?? 120_000;

    if (stageName === "Test") {
      return runTestCommand(run.testCommand, run.repoPath, timeoutMs);
    }

    let result: RunnerResult;
    if (run.runnerMode === "claude") {
      result = await runClaudePrompt(prompt, run.repoPath, timeoutMs);
    } else {
      result = await runMockStage(stageName, prompt);
    }

    if (stageName === "Verify" && result.success && result.output.toUpperCase().includes("BLOCKER:")) {
      return {
        success: false,
        output: result.output,
        logs: result.logs,
        error: "Verify found blocker findings",
      };
    }

    if (stageName === "PR" && result.success && run.prMode === "simulate") {
      const suffix = run.id.split("-")[0];
      return {
        success: true,
        output: `${result.output}\n\nsimulated_pr_url: https://example.com/pr/${suffix}`,
        logs: result.logs,
        error: "",
      };
    }

    return result;
  }

  private async applyStageResult(
    runId: string,
    stageName: StageName,
    result: RunnerResult,
  ): Promise<void> {
    const run = await this.requireRun(runId);
    const stage = run.stages.find((item) => item.name === stageName);
    if (!stage) {
      throw new Error("stage not found");
    }
    const attempt = stage.attempts.at(-1);
    if (!attempt) {
      throw new Error("stage attempt not found");
    }

    const { artifactPath, logsPath } = await this.persistAttemptFiles(
      runId,
      stageName,
      attempt.attempt,
      attempt.prompt,
      result.output,
      result.logs,
    );

    attempt.endedAt = nowIso();
    attempt.status = result.success ? "done" : "failed";
    attempt.artifactPath = artifactPath;
    attempt.logPath = logsPath;
    attempt.outputPreview = result.output.slice(0, 4000);
    attempt.logsPreview = result.logs.slice(0, 4000);
    attempt.error = result.error;

    await this.appendProgress(runId, stageName, attempt.attempt, result);

    stage.endedAt = nowIso();
    run.updatedAt = nowIso();
    if (result.success) {
      stage.status = "done";
      stage.lastError = "";
      run.status = "queued";
      appendEvent(run, {
        type: "stage_done",
        stage: stageName,
        message: "",
      });
    } else {
      stage.status = "failed";
      stage.lastError = result.error || "Stage failed";
      run.status = "failed";
      appendEvent(run, {
        type: "stage_failed",
        stage: stageName,
        message: stage.lastError,
      });
    }
    await this.store.saveRun(run);
  }

  private async persistAttemptFiles(
    runId: string,
    stageName: StageName,
    attemptNumber: number,
    prompt: string,
    output: string,
    logs: string,
  ): Promise<{ artifactPath: string; logsPath: string }> {
    const baseDir = path.join(process.cwd(), "runs", runId, stageName.toLowerCase(), `attempt-${attemptNumber}`);
    await mkdir(baseDir, { recursive: true });
    const promptPath = path.join(baseDir, "prompt.txt");
    const artifactPath = path.join(baseDir, "artifact.txt");
    const logsPath = path.join(baseDir, "logs.txt");
    await Promise.all([
      writeFile(promptPath, prompt, "utf8"),
      writeFile(artifactPath, output, "utf8"),
      writeFile(logsPath, logs, "utf8"),
    ]);
    return { artifactPath, logsPath };
  }

  private progressPath(runId: string): string {
    return path.join(process.cwd(), "runs", runId, "progress.md");
  }

  private async appendProgress(
    runId: string,
    stageName: StageName,
    attemptNumber: number,
    result: RunnerResult,
  ): Promise<void> {
    const filePath = this.progressPath(runId);
    await mkdir(path.dirname(filePath), { recursive: true });

    const status = result.success ? "done" : "failed";
    const lines = [
      `## ${stageName} | Attempt ${attemptNumber} | ${status}`,
      `- Timestamp: ${nowIso()}`,
    ];

    if (result.error) {
      lines.push(`- Error: ${result.error}`);
    }

    const preview = result.output.slice(0, 500).trim();
    if (preview) {
      lines.push(`- Output summary: ${preview}`);
    }

    lines.push("", "");
    await appendFile(filePath, lines.join("\n"), "utf8");
  }

  private async requireRun(runId: string): Promise<RunRecord> {
    const run = await this.store.getRun(runId);
    if (!run) {
      throw new Error("run not found");
    }
    return run;
  }
}
