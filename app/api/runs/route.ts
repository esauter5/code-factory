import { NextRequest, NextResponse } from "next/server";

import { getTemplate } from "@/lib/harness/pipeline-templates";
import { getOrchestrator, getAvailableProviders } from "@/lib/harness/singleton";
import { DEFAULT_STAGE_ORDER, type PrMode, type RunnerMode, type StageOverrides } from "@/lib/harness/types";

export const runtime = "nodejs";

interface CreateRunPayload {
  ticket?: string;
  repoPath?: string;
  repoId?: string;
  runnerMode?: RunnerMode;
  testCommand?: string;
  prMode?: PrMode;
  templateId?: string;
  model?: string;
  thinkingLevel?: string;
  stageOverrides?: StageOverrides;
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

  // Validate runnerMode against detected providers + "mock"
  const runnerMode: RunnerMode = payload.runnerMode ?? "mock";
  if (runnerMode !== "mock") {
    const providers = await getAvailableProviders();
    const provider = providers.find((p) => p.id === runnerMode);
    if (!provider) {
      return NextResponse.json({ error: "invalid runnerMode" }, { status: 400 });
    }
    if (!provider.available) {
      return NextResponse.json({ error: `provider '${runnerMode}' is not available (CLI not found)` }, { status: 400 });
    }
  }

  const prMode: PrMode = payload.prMode ?? "simulate";
  if (!["simulate", "create"].includes(prMode)) {
    return NextResponse.json({ error: "invalid prMode" }, { status: 400 });
  }
  if (prMode === "create" && !payload.repoId?.trim()) {
    return NextResponse.json({ error: "prMode 'create' requires a managed repo (repoId)" }, { status: 400 });
  }

  if (payload.templateId && !getTemplate(payload.templateId)) {
    return NextResponse.json({ error: "invalid templateId" }, { status: 400 });
  }

  const orchestrator = getOrchestrator();
  const run = await orchestrator.createRun({
    ticket: payload.ticket.trim(),
    repoPath: payload.repoPath?.trim() || ".",
    repoId: payload.repoId?.trim() || undefined,
    runnerMode,
    testCommand: payload.testCommand?.trim() || "pnpm lint",
    prMode,
    templateId: payload.templateId,
    model: payload.model?.trim() || undefined,
    thinkingLevel: payload.thinkingLevel?.trim() || undefined,
    stageOverrides: payload.stageOverrides,
  });

  return NextResponse.json(
    {
      run,
      template: DEFAULT_STAGE_ORDER,
    },
    { status: 201 },
  );
}
