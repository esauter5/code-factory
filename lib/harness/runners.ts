import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import type { RunnerResult, StageName } from "@/lib/harness/types";

interface RunCommandOptions {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs: number;
}

async function runCommand(options: RunCommandOptions): Promise<RunnerResult> {
  const { command, args, cwd, timeoutMs } = options;

  return new Promise<RunnerResult>((resolve) => {
    const child = spawn(command, args, {
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
      stdout += chunk.toString("utf8");
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
        resolve({
          success: false,
          output: stdout.trim(),
          logs: stderr.trim(),
          error: `command timed out after ${Math.round(timeoutMs / 1000)}s`,
        });
        return;
      }
      if (code !== 0) {
        resolve({
          success: false,
          output: stdout.trim(),
          logs: stderr.trim(),
          error: `command exited with code ${code}`,
        });
        return;
      }
      resolve({
        success: true,
        output: stdout.trim(),
        logs: stderr.trim(),
        error: "",
      });
    });
  });
}

export async function runClaudePrompt(prompt: string, cwd: string, timeoutMs: number): Promise<RunnerResult> {
  return runCommand({
    command: "claude",
    args: ["-p", "--verbose", prompt],
    cwd,
    timeoutMs,
  });
}

export async function runTestCommand(
  command: string,
  repoPath: string,
  timeoutMs: number,
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
      stderr += chunk.toString("utf8");
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
