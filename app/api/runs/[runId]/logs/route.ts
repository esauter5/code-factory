import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { runId } = await params;
  const orchestrator = getOrchestrator();
  const run = await orchestrator.getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  // Find the running stage and its latest attempt
  const runningStage = run.stages.find((s) => s.status === "running");
  if (!runningStage) {
    return NextResponse.json({ content: "", stage: null, attempt: null });
  }

  const latestAttempt = runningStage.attempts.at(-1);
  if (!latestAttempt?.logPath) {
    return NextResponse.json({ content: "", stage: runningStage.name, attempt: latestAttempt?.attempt ?? null });
  }

  const logFile = path.join(latestAttempt.logPath, "live.log");
  let content = "";
  try {
    const raw = await readFile(logFile, "utf8");
    // Return last 200 lines
    const lines = raw.split("\n");
    if (lines.length > 200) {
      content = lines.slice(-200).join("\n");
    } else {
      content = raw;
    }
  } catch {
    // File doesn't exist yet — that's fine
  }

  return NextResponse.json({
    content,
    stage: runningStage.name,
    attempt: latestAttempt.attempt,
  });
}
