import { exec } from "node:child_process";
import { copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { glob } from "glob";

import type { RepoConfig, WorktreeInfo } from "@/lib/harness/types";

const execAsync = promisify(exec);

function shortId(runId: string): string {
  return runId.replace(/-/g, "").slice(0, 8);
}

export async function provisionWorktree(
  repo: RepoConfig,
  runId: string,
): Promise<WorktreeInfo> {
  const suffix = shortId(runId);
  const branch = `cf/run-${suffix}`;
  const worktreePath = `${repo.localPath}-cf-${suffix}`;

  const info: WorktreeInfo = {
    worktreePath,
    branch,
    status: "provisioning",
  };

  try {
    await execAsync(
      `git worktree add ${JSON.stringify(worktreePath)} -b ${branch} ${repo.defaultBranch}`,
      { cwd: repo.localPath },
    );

    // Copy env files
    for (const pattern of repo.envFiles) {
      const matches = await glob(pattern, {
        cwd: repo.localPath,
        dot: true,
        nodir: true,
      });
      for (const match of matches) {
        const src = path.join(repo.localPath, match);
        const dest = path.join(worktreePath, match);
        await copyFile(src, dest);
      }
    }

    // Run setup script
    if (repo.setupScript.trim()) {
      await execAsync(repo.setupScript, {
        cwd: worktreePath,
        timeout: 120_000,
      });
    }

    info.status = "ready";
    return info;
  } catch (err) {
    info.status = "failed";
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to provision worktree: ${message}`);
  }
}

export async function teardownWorktree(
  repo: RepoConfig,
  worktree: WorktreeInfo,
): Promise<void> {
  // Remove the worktree
  try {
    await execAsync(
      `git worktree remove ${JSON.stringify(worktree.worktreePath)} --force`,
      { cwd: repo.localPath },
    );
  } catch {
    // Fallback: force-remove the directory
    await rm(worktree.worktreePath, { recursive: true, force: true });
    // Prune stale worktree entries
    try {
      await execAsync("git worktree prune", { cwd: repo.localPath });
    } catch {
      // best-effort
    }
  }

  // Delete the branch
  try {
    await execAsync(`git branch -D ${worktree.branch}`, {
      cwd: repo.localPath,
    });
  } catch {
    // Branch may already be gone
  }
}

export async function probeGitInfo(
  localPath: string,
): Promise<{ remote: string | null; defaultBranch: string }> {
  let remote: string | null = null;
  try {
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd: localPath,
    });
    remote = stdout.trim() || null;
  } catch {
    // No remote configured
  }

  let defaultBranch = "main";
  try {
    const { stdout } = await execAsync(
      "git symbolic-ref refs/remotes/origin/HEAD",
      { cwd: localPath },
    );
    // Output is like "refs/remotes/origin/main"
    const parts = stdout.trim().split("/");
    defaultBranch = parts[parts.length - 1] || "main";
  } catch {
    // Fallback: check if "main" or "master" exists
    try {
      await execAsync("git rev-parse --verify main", { cwd: localPath });
      defaultBranch = "main";
    } catch {
      try {
        await execAsync("git rev-parse --verify master", { cwd: localPath });
        defaultBranch = "master";
      } catch {
        // Keep "main" as default
      }
    }
  }

  return { remote, defaultBranch };
}
