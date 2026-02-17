import { NextRequest, NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";
import { STAGE_ORDER, type StageName } from "@/lib/harness/types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ runId: string; action: string }>;
}

function validateStage(value: unknown): StageName | null {
  if (typeof value !== "string") return null;
  const found = STAGE_ORDER.find((stage) => stage === value);
  return found ?? null;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { runId, action } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const stage = validateStage(body.stage);
  const orchestrator = getOrchestrator();

  if (!stage) {
    return NextResponse.json({ error: "valid stage is required" }, { status: 400 });
  }

  try {
    let run;
    if (action === "retry-stage") {
      run = await orchestrator.retryStage(runId, stage);
    } else if (action === "retry-from") {
      run = await orchestrator.retryFrom(runId, stage);
    } else if (action === "edit-prompt") {
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      if (!prompt.trim()) {
        return NextResponse.json({ error: "prompt is required" }, { status: 400 });
      }
      run = await orchestrator.editPromptAndRerun(runId, stage, prompt);
    } else if (action === "skip-stage") {
      const reason = typeof body.reason === "string" ? body.reason : "";
      run = await orchestrator.skipStage(runId, stage, reason);
    } else {
      return NextResponse.json({ error: "unknown action" }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
