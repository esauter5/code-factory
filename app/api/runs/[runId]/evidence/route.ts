import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function isWithin(parentDir: string, filePath: string): boolean {
  const relative = path.relative(parentDir, filePath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function GET(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { runId } = await params;
  const orchestrator = getOrchestrator();
  const run = await orchestrator.getRun(runId);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rawPath = (url.searchParams.get("path") ?? "").trim();
  if (!rawPath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const runRoot = path.resolve(path.join(process.cwd(), "runs", runId));
  const targetPath = path.resolve(path.isAbsolute(rawPath) ? rawPath : path.join(runRoot, rawPath));

  if (!isWithin(runRoot, targetPath)) {
    return NextResponse.json({ error: "invalid evidence path" }, { status: 403 });
  }

  try {
    const bytes = await readFile(targetPath);
    return new NextResponse(bytes, {
      headers: {
        "content-type": contentTypeFor(targetPath),
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "evidence not found" }, { status: 404 });
  }
}
