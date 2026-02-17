import { NextRequest, NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";
import { STAGE_ORDER, type RunnerMode } from "@/lib/harness/types";

export const runtime = "nodejs";

interface CreateRunPayload {
  ticket?: string;
  repoPath?: string;
  runnerMode?: RunnerMode;
  testCommand?: string;
}

export async function GET(): Promise<NextResponse> {
  const orchestrator = getOrchestrator();
  const runs = await orchestrator.listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json()) as CreateRunPayload;
  if (!payload.ticket?.trim()) {
    return NextResponse.json({ error: "ticket is required" }, { status: 400 });
  }

  if (payload.runnerMode && !["mock", "claude"].includes(payload.runnerMode)) {
    return NextResponse.json({ error: "invalid runnerMode" }, { status: 400 });
  }

  const orchestrator = getOrchestrator();
  const run = await orchestrator.createRun({
    ticket: payload.ticket.trim(),
    repoPath: payload.repoPath?.trim() || ".",
    runnerMode: payload.runnerMode ?? "mock",
    testCommand: payload.testCommand?.trim() || "pnpm lint",
    prMode: "simulate",
  });

  return NextResponse.json(
    {
      run,
      template: STAGE_ORDER,
    },
    { status: 201 },
  );
}
