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
  return NextResponse.json({ run });
}
