import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { RunRecord } from "@/lib/harness/types";

const tokenPattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export async function loadStageTemplate(stageName: string): Promise<string> {
  const templatePath = path.join(process.cwd(), "prompt-templates", `${stageName.toLowerCase()}.txt`);
  return readFile(templatePath, "utf8");
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(tokenPattern, (_, token: string) => values[token] ?? "");
}

export async function buildRepoContext(repoPath: string): Promise<string> {
  const lines: string[] = [];
  lines.push(`repo_path: ${repoPath}`);

  try {
    const entries = await readdir(repoPath);
    const visible = entries.filter((item) => !item.startsWith(".")).slice(0, 40);
    lines.push("top_level_entries:");
    for (const name of visible) {
      lines.push(`- ${name}`);
    }
  } catch {
    lines.push("top_level_entries:");
    lines.push("- unavailable");
  }

  const readmeCandidates = ["README.md", "README.txt", "README"];
  for (const candidate of readmeCandidates) {
    const candidatePath = path.join(repoPath, candidate);
    try {
      const readme = await readFile(candidatePath, "utf8");
      lines.push("readme_excerpt:");
      lines.push(readme.slice(0, 2000));
      break;
    } catch {
      // Try next candidate.
    }
  }

  return lines.join("\n");
}

export function latestOutput(run: RunRecord, stageName: string): string {
  const stage = run.stages.find((item) => item.name === stageName);
  if (!stage || stage.attempts.length === 0) return "";
  return stage.attempts[stage.attempts.length - 1].outputPreview ?? "";
}
