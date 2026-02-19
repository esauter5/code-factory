import { spawn } from "node:child_process";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import type { StageDefinition } from "@/lib/harness/pipeline-templates";
import type { ProviderInfo } from "@/lib/harness/providers";
import { getProvider, parseStreamJsonOutput } from "@/lib/harness/providers";
import type { RunnerResult } from "@/lib/harness/types";

function appendToLog(logDir: string, chunk: string): void {
  const logFile = path.join(logDir, "live.log");
  // Fire-and-forget — don't block the stream
  void appendFile(logFile, chunk, "utf8").catch((err) => {
    console.error("[runner] appendToLog failed:", logFile, err);
  });
}

export async function runProviderPrompt(
  provider: ProviderInfo,
  prompt: string,
  cwd: string,
  timeoutMs: number,
  model?: string,
  thinkingLevel?: string,
  logDir?: string,
): Promise<RunnerResult> {
  return new Promise<RunnerResult>((resolve) => {
    const args = provider.buildArgs(prompt, model, thinkingLevel);
    const extraEnv = provider.buildEnv(thinkingLevel);

    const child = spawn(provider.binary, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (logDir) {
        appendToLog(logDir, text);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        output: stdout.trim(),
        logs: stderr.trim(),
        error: error.message,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        const parsed = provider.parseOutput(stdout);
        resolve({
          success: false,
          output: parsed.output || stdout.trim(),
          logs: stdout.trim(),
          error: `command timed out after ${Math.round(timeoutMs / 1000)}s`,
        });
        return;
      }

      const parsed = provider.parseOutput(stdout);

      if (code !== 0 && !parsed.success) {
        resolve({
          success: false,
          output: parsed.output || stdout.trim(),
          logs: stdout.trim(),
          error: parsed.error || `command exited with code ${code}`,
        });
        return;
      }

      resolve({
        success: parsed.success,
        output: parsed.output,
        logs: stdout.trim(),
        error: parsed.error,
      });
    });
  });
}

/** Backward-compatible wrapper — delegates to runProviderPrompt with Claude provider */
export async function runClaudePrompt(
  prompt: string,
  cwd: string,
  timeoutMs: number,
  logDir?: string,
): Promise<RunnerResult> {
  const claude = getProvider("claude");
  if (!claude) {
    return { success: false, output: "", logs: "", error: "Claude provider not found" };
  }
  return runProviderPrompt(claude, prompt, cwd, timeoutMs, undefined, undefined, logDir);
}

export { parseStreamJsonOutput };

export async function runTestCommand(
  command: string,
  repoPath: string,
  timeoutMs: number,
  logDir?: string,
): Promise<RunnerResult> {
  return new Promise<RunnerResult>((resolve) => {
    const child = spawn(command, {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      if (logDir) {
        appendToLog(logDir, text);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        output: "",
        logs: stderr.trim(),
        error: error.message,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        resolve({
          success: false,
          output: "Tests timed out",
          logs: `command: ${command}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          error: `test command timed out after ${Math.round(timeoutMs / 1000)}s`,
        });
        return;
      }

      const logs = `command: ${command}\nreturn_code: ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`;
      if (code !== 0) {
        resolve({
          success: false,
          output: "Tests failed",
          logs,
          error: "test command failed",
        });
        return;
      }
      resolve({
        success: true,
        output: "Tests passed",
        logs,
        error: "",
      });
    });
  });
}

export async function runMockStage(stageDef: StageDefinition, prompt: string): Promise<RunnerResult> {
  await sleep(250);
  const base = `generated_by: mock_runner\nstage: ${stageDef.name}\n`;

  // Handle failIfOutputContains test triggers
  if (
    stageDef.successCriteria?.failIfOutputContains &&
    (prompt.includes("FAIL_VERIFY") || prompt.includes("FORCE_BLOCKER"))
  ) {
    return {
      success: false,
      output: `${base}\n${stageDef.successCriteria.failIfOutputContains} Missing validation in implementation.`,
      logs: `mock ${stageDef.name.toLowerCase()} detected blocker`,
      error: `${stageDef.name.toLowerCase()} blocker found`,
    };
  }

  if (stageDef.executionType === "shell-command") {
    return {
      success: true,
      output: "Tests passed",
      logs: `command: (mock)\nreturn_code: 0\nstdout:\nAll tests passed\nstderr:\n`,
      error: "",
    };
  }

  const nameLower = stageDef.name.toLowerCase();
  const mockOutputs: Record<string, string> = {
    plan: `${base}\n# Plan\n- Understand request\n- Propose implementation\n- Validate with tests`,
    implement: `${base}\n# Implementation Summary\n- Created implementation updates\n- Prepared for verification`,
    verify: `${base}\n# Verify Report\nNo blocker findings.`,
    pr: `${base}\n# PR Draft\ntitle: Automated SDLC update\nsummary: Generated changes from fixed pipeline`,
  };

  return {
    success: true,
    output: mockOutputs[nameLower] ?? `${base}\nCompleted ${stageDef.name} stage.`,
    logs: `mock ${nameLower} success`,
    error: "",
  };
}
