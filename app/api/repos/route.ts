import { NextRequest, NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";
import { probeGitInfo } from "@/lib/harness/workspace-manager";

export const runtime = "nodejs";

interface CreateRepoPayload {
  localPath?: string;
  name?: string;
  setupScript?: string;
  envFiles?: string[];
  defaultTestCommand?: string;
}

export async function GET(): Promise<NextResponse> {
  const orchestrator = getOrchestrator();
  const repos = await orchestrator.listRepos();
  return NextResponse.json({ repos });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json()) as CreateRepoPayload;
  if (!payload.localPath?.trim()) {
    return NextResponse.json({ error: "localPath is required" }, { status: 400 });
  }

  const localPath = payload.localPath.trim();
  const gitInfo = await probeGitInfo(localPath);

  const name = payload.name?.trim() || localPath.split("/").pop() || "repo";

  const orchestrator = getOrchestrator();
  const repo = await orchestrator.createRepo({
    id: crypto.randomUUID(),
    name,
    localPath,
    gitRemote: gitInfo.remote,
    defaultBranch: gitInfo.defaultBranch,
    setupScript: payload.setupScript?.trim() ?? "",
    envFiles: payload.envFiles ?? [],
    defaultTestCommand: payload.defaultTestCommand?.trim() ?? "pnpm lint",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ repo }, { status: 201 });
}
