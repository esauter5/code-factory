import { spawn } from "node:child_process";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import type { RunnerResult, StageName } from "@/lib/harness/types";

interface StreamJsonEvent {
  type: string;
  subtype?: string;
  message?: {
    content: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  };
  cost_usd?: number;
  duration_ms?: number;
}

function parseStreamJsonOutput(raw: string): { output: string; success: boolean; error: string } {
  const lines = raw.split("\n").filter((l) => l.trim());
  const events: StreamJsonEvent[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as StreamJsonEvent);
    } catch {
      // skip malformed lines
    }
  }

  // Extract text content from assistant messages
  const textParts: string[] = [];
  for (const event of events) {
    if (event.type === "assistant" && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        }
      }
    }
  }

  const output = textParts.join("\n");

  // Check result event for success/error
  const resultEvent = events.find((e) => e.type === "result");
  if (resultEvent) {
    if (resultEvent.subtype === "error") {
      return { output, success: false, error: "Claude returned an error result" };
    }
    return { output, success: true, error: "" };
  }

  // No result event — treat as success if we got output
  if (output.length > 0) {
    return { output, success: true, error: "" };
  }

  return { output: "", success: false, error: "No output or result event from Claude" };
}

function appendToLog(logDir: string, chunk: string): void {
  const logFile = path.join(logDir, "live.log");
  // Fire-and-forget — don't block the stream
  void appendFile(logFile, chunk, "utf8").catch((err) => {
    console.error("[runner] appendToLog failed:", logFile, err);
  });
}

export async function runClaudePrompt(
  prompt: string,
  cwd: string,
  timeoutMs: number,
  logDir?: string,
): Promise<RunnerResult> {
  return new Promise<RunnerResult>((resolve) => {
    const child = spawn("claude", ["-p", "--output-format", "stream-json", prompt], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
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
        const parsed = parseStreamJsonOutput(stdout);
        resolve({
          success: false,
          output: parsed.output || stdout.trim(),
          logs: stdout.trim(),
          error: `command timed out after ${Math.round(timeoutMs / 1000)}s`,
        });
        return;
      }

      // Parse the NDJSON stream
      const parsed = parseStreamJsonOutput(stdout);

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

export async function runMockStage(stageName: StageName, prompt: string): Promise<RunnerResult> {
  await sleep(250);
  const base = `generated_by: mock_runner\nstage: ${stageName}\n`;

  if (stageName === "Verify" && (prompt.includes("FAIL_VERIFY") || prompt.includes("FORCE_BLOCKER"))) {
    return {
      success: false,
      output: `${base}\nBLOCKER: Missing validation in implementation.`,
      logs: "mock verify detected blocker",
      error: "verify blocker found",
    };
  }

  if (stageName === "Plan") {
    return {
      success: true,
      output: `${base}\n# Plan\n- Understand request\n- Propose implementation\n- Validate with tests`,
      logs: "mock plan success",
      error: "",
    };
  }
  if (stageName === "Implement") {
    return {
      success: true,
      output: `${base}\n# Implementation Summary\n- Created implementation updates\n- Prepared for verification`,
      logs: "mock implement success",
      error: "",
    };
  }
  if (stageName === "Verify") {
    return {
      success: true,
      output: `${base}\n# Verify Report\nNo blocker findings.`,
      logs: "mock verify success",
      error: "",
    };
  }
  if (stageName === "PR") {
    return {
      success: true,
      output: `${base}\n# PR Draft\ntitle: Automated SDLC update\nsummary: Generated changes from fixed pipeline`,
      logs: "mock pr success",
      error: "",
    };
  }

  return {
    success: true,
    output: `${base}\nNo output`,
    logs: "mock generic success",
    error: "",
  };
}
