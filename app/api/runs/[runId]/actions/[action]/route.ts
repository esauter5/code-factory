import { NextRequest, NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ runId: string; action: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { runId, action } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const orchestrator = getOrchestrator();

  // Actions that don't require a stage parameter
  if (action === "cancel") {
    try {
      const result = await orchestrator.cancelRun(runId);
      return NextResponse.json({ run: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "action failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  if (action === "archive") {
    try {
      const result = await orchestrator.archiveRun(runId);
      return NextResponse.json({ run: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "action failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
  if (action === "unarchive") {
    try {
      const result = await orchestrator.unarchiveRun(runId);
      return NextResponse.json({ run: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "action failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Stage-based actions
  const stage = typeof body.stage === "string" ? body.stage : null;

  if (!stage) {
    return NextResponse.json({ error: "valid stage is required" }, { status: 400 });
  }

  // Validate stage name against the run's actual stages (not a global constant)
  const run = await orchestrator.getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }
  const validStage = run.stages.some((s) => s.name === stage);
  if (!validStage) {
    return NextResponse.json({ error: "invalid stage for this run" }, { status: 400 });
  }

  try {
    let result;
    if (action === "retry-stage") {
      result = await orchestrator.retryStage(runId, stage);
    } else if (action === "retry-from") {
      result = await orchestrator.retryFrom(runId, stage);
    } else if (action === "edit-prompt") {
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      if (!prompt.trim()) {
        return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      }
      result = await orchestrator.editPromptAndRerun(runId, stage, prompt);
    } else if (action === "skip-stage") {
      const reason = typeof body.reason === "string" ? body.reason : "";
      result = await orchestrator.skipStage(runId, stage, reason);
    } else {
      return NextResponse.json({ error: "unknown action" }, { status: 404 });
    }

    return NextResponse.json({ run: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
