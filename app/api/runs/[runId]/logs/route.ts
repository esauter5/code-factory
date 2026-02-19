import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { runId } = await params;
  const orchestrator = getOrchestrator();
  const run = await orchestrator.getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const stageName = url.searchParams.get("stage");

  // If a specific stage is requested, read its logs
  // Otherwise fall back to the currently running stage
  const targetStage = stageName
    ? run.stages.find((s) => s.name === stageName)
    : run.stages.find((s) => s.status === "running");

  if (!targetStage) {
    return NextResponse.json({ content: "", stage: null, attempt: null });
  }

  const latestAttempt = targetStage.attempts.at(-1);
  if (!latestAttempt?.logPath) {
    return NextResponse.json({ content: "", stage: targetStage.name, attempt: latestAttempt?.attempt ?? null });
  }

  // logPath is the attempt directory during execution, but gets
  // overwritten to logs.txt path after completion. Handle both.
  let logDir = latestAttempt.logPath;
  if (logDir.endsWith(".txt")) {
    logDir = path.dirname(logDir);
  }

  const logFile = path.join(logDir, "live.log");
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
    stage: targetStage.name,
    attempt: latestAttempt.attempt,
  });
}
