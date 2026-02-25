import { spawn } from "node:child_process";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import type { StageDefinition } from "@/lib/harness/pipeline-templates";
import type { ParsedProviderOutput, ProviderInfo } from "@/lib/harness/providers";
import { getProvider, parseStreamJsonOutput } from "@/lib/harness/providers";
import type { RunnerResult } from "@/lib/harness/types";

function isNoOutputParseError(error: string): boolean {
  const normalized = error.toLowerCase();
  return normalized.includes("no output") || normalized.includes("no output or result event");
}

function buildProviderLogs(stdout: string, stderr: string): string {
  const out = stdout.trim();
  const err = stderr.trim();

  if (out && err) {
    return `stdout:\n${out}\n\nstderr:\n${err}`;
  }
  if (out) {
    return out;
  }
  if (err) {
    return `stderr:\n${err}`;
  }
  return "";
}

function looksLikeStructuredJsonStream(raw: string): boolean {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return false;

  const sample = lines.slice(0, Math.min(lines.length, 5));
  let jsonLike = 0;

  for (const line of sample) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && ("type" in parsed || "message" in parsed || "subtype" in parsed)) {
        jsonLike += 1;
      }
    } catch {
      // not JSON
    }
  }

  return jsonLike >= Math.ceil(sample.length / 2);
}

function safeArtifactOutput(parsedOutput: string, rawStdout: string): string {
  const output = parsedOutput.trim();
  if (output) {
    return output;
  }

  const stdout = rawStdout.trim();
  if (!stdout) {
    return "";
  }

  // Prevent raw stream-json / JSONL events from being persisted as artifact output.
  if (looksLikeStructuredJsonStream(stdout)) {
    return "";
  }

  return stdout;
}

function parseProviderOutput(
  provider: ProviderInfo,
  stdout: string,
  stderr: string,
): ParsedProviderOutput {
  const parsedStdout = provider.parseOutput(stdout);
  if (parsedStdout.success) {
    return parsedStdout;
  }

  if (!stderr.trim()) {
    return parsedStdout;
  }

  // Some provider versions emit structured events on stderr instead of stdout.
  const parsedStderr = provider.parseOutput(stderr);
  if (parsedStderr.success) {
    return parsedStderr;
  }

  if (parsedStderr.error && isNoOutputParseError(parsedStdout.error || "")) {
    return { ...parsedStdout, error: parsedStderr.error };
  }

  return parsedStdout;
}

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
        output: stdout.trim(),
        logs: buildProviderLogs(stdout, stderr),
        error: error.message,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const stdoutTrim = stdout.trim();
      const stderrTrim = stderr.trim();
      const logs = buildProviderLogs(stdout, stderr);

      if (timedOut) {
        const parsed = parseProviderOutput(provider, stdout, stderr);
        resolve({
          success: false,
          output: safeArtifactOutput(parsed.output, stdout),
          logs,
          error: `command timed out after ${Math.round(timeoutMs / 1000)}s`,
          costUsd: parsed.costUsd,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          durationMs: parsed.durationMs,
        });
        return;
      }

      const parsed = parseProviderOutput(provider, stdout, stderr);

      if (code !== 0 && !parsed.success) {
        const resolvedError =
          stderrTrim && isNoOutputParseError(parsed.error || "")
            ? stderrTrim
            : parsed.error || `command exited with code ${code}`;
        resolve({
          success: false,
          output: safeArtifactOutput(parsed.output, stdout),
          logs,
          error: resolvedError,
          costUsd: parsed.costUsd,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          durationMs: parsed.durationMs,
        });
        return;
      }

      // Fallback: if provider exited cleanly with non-empty plain text, accept it.
      if (!parsed.success && code === 0 && stdoutTrim && !stderrTrim) {
        resolve({
          success: true,
          output: safeArtifactOutput(stdoutTrim, stdout),
          logs,
          error: "",
        });
        return;
      }

      const resolvedError =
        stderrTrim && isNoOutputParseError(parsed.error || "")
          ? stderrTrim
          : parsed.error;

      resolve({
        success: parsed.success,
        output: safeArtifactOutput(parsed.output, stdout),
        logs,
        error: resolvedError,
        costUsd: parsed.costUsd,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        durationMs: parsed.durationMs,
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
