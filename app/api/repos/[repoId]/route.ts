import { NextRequest, NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ repoId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { repoId } = await params;
  const orchestrator = getOrchestrator();
  const repo = await orchestrator.getRepo(repoId);
  if (!repo) {
    return NextResponse.json({ error: "repo not found" }, { status: 404 });
  }
  return NextResponse.json({ repo });
}

interface UpdateRepoPayload {
  name?: string;
  setupScript?: string;
  envFiles?: string[];
  defaultTestCommand?: string;
}

export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { repoId } = await params;
  const orchestrator = getOrchestrator();
  const repo = await orchestrator.getRepo(repoId);
  if (!repo) {
    return NextResponse.json({ error: "repo not found" }, { status: 404 });
  }

  const payload = (await request.json()) as UpdateRepoPayload;
  if (payload.name !== undefined) repo.name = payload.name.trim();
  if (payload.setupScript !== undefined) repo.setupScript = payload.setupScript.trim();
  if (payload.envFiles !== undefined) repo.envFiles = payload.envFiles;
  if (payload.defaultTestCommand !== undefined) repo.defaultTestCommand = payload.defaultTestCommand.trim();
  repo.updatedAt = new Date().toISOString();

  const updated = await orchestrator.saveRepo(repo);
  return NextResponse.json({ repo: updated });
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { repoId } = await params;
  const orchestrator = getOrchestrator();
  const repo = await orchestrator.getRepo(repoId);
  if (!repo) {
    return NextResponse.json({ error: "repo not found" }, { status: 404 });
  }
  await orchestrator.deleteRepo(repoId);
  return NextResponse.json({ ok: true });
}
