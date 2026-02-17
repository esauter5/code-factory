import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface DirectoryEntry {
  name: string;
  path: string;
}

interface DirectoryBrowseResponse {
  currentPath: string;
  parentPath: string | null;
  directories: DirectoryEntry[];
  shortcuts: Array<{ label: string; path: string }>;
}

function buildShortcuts(): Array<{ label: string; path: string }> {
  const workspace = process.cwd();
  const home = homedir();
  const shortcuts = [{ label: "Workspace", path: workspace }];
  if (home !== workspace) {
    shortcuts.push({ label: "Home", path: home });
  }
  return shortcuts;
}

export async function GET(request: NextRequest): Promise<NextResponse<DirectoryBrowseResponse | { error: string }>> {
  const rawPath = request.nextUrl.searchParams.get("path")?.trim() || process.cwd();
  const resolvedPath = path.resolve(rawPath);

  try {
    const stats = await stat(resolvedPath);
    if (!stats.isDirectory()) {
      return NextResponse.json({ error: "Path is not a directory" }, { status: 400 });
    }

    const entries = await readdir(resolvedPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: path.join(resolvedPath, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }))
      .slice(0, 250);

    const parent = path.dirname(resolvedPath);
    const parentPath = parent === resolvedPath ? null : parent;

    return NextResponse.json({
      currentPath: resolvedPath,
      parentPath,
      directories,
      shortcuts: buildShortcuts(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read directory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
