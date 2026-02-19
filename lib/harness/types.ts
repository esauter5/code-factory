export const STAGE_ORDER = ["Plan", "Implement", "Verify", "Test", "PR"] as const;

export type StageName = (typeof STAGE_ORDER)[number];
export type RunnerMode = "mock" | "claude";
export type RunStatus = "queued" | "running" | "failed" | "done";
export type StageStatus = "queued" | "running" | "failed" | "done" | "skipped";

export interface StageAttempt {
  attempt: number;
  startedAt: string;
  endedAt: string | null;
  status: "running" | "done" | "failed";
  prompt: string;
  artifactPath: string;
  logPath: string;
  outputPreview: string;
  logsPreview: string;
  error: string;
}

export interface StageRun {
  name: StageName;
  status: StageStatus;
  attempts: StageAttempt[];
  lastError: string;
  promptOverride: string | null;
  skipReason: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface RunEvent {
  timestamp: string;
  type: string;
  stage: StageName | "";
  message: string;
}

export interface RepoConfig {
  id: string;
  name: string;
  localPath: string;
  gitRemote: string | null;
  defaultBranch: string;
  setupScript: string;
  envFiles: string[];
  defaultTestCommand: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorktreeInfo {
  worktreePath: string;
  branch: string;
  status: "provisioning" | "ready" | "failed" | "cleaned";
}

export interface RunRecord {
  id: string;
  ticket: string;
  repoPath: string;
  repoId: string | null;
  worktree: WorktreeInfo | null;
  runnerMode: RunnerMode;
  testCommand: string;
  prMode: "simulate";
  status: RunStatus;
  currentStage: StageName | null;
  createdAt: string;
  updatedAt: string;
  repoContext: string;
  stages: StageRun[];
  events: RunEvent[];
}

export interface StoreShape {
  runs: RunRecord[];
  repos: RepoConfig[];
}

export interface RunnerResult {
  success: boolean;
  output: string;
  logs: string;
  error: string;
}
