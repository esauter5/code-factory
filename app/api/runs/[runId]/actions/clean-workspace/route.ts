import { NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { runId } = await params;
  const orchestrator = getOrchestrator();

  try {
    const run = await orchestrator.cleanWorkspace(runId);
    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to clean workspace";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
