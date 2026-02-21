import type { StageDefinition } from "@/lib/harness/pipeline-templates";

export const DEFAULT_STAGE_ORDER = ["Plan", "Implement", "Verify", "Test", "PR"] as const;
/** @deprecated Use DEFAULT_STAGE_ORDER instead */
export const STAGE_ORDER = DEFAULT_STAGE_ORDER;

export type StageName = string;
export type RunnerMode = "mock" | "claude" | "codex";
export type PrMode = "simulate" | "create";
export type RunStatus = "queued" | "running" | "failed" | "done" | "cancelled";
export type StageStatus = "queued" | "running" | "failed" | "done" | "skipped";

export interface StageAttempt {
  attempt: number;
  cycle: number;
  startedAt: string;
  endedAt: string | null;
  status: "running" | "done" | "failed";
  prompt: string;
  artifactPath: string;
  logPath: string;
  outputPreview: string;
  logsPreview: string;
  error: string;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  providerUsed: string | null;
  modelUsed: string | null;
}

export interface StageRun {
  name: string;
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
  stage: string;
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
  prMode: PrMode;
  prUrl: string | null;
  status: RunStatus;
  currentStage: string | null;
  createdAt: string;
  updatedAt: string;
  repoContext: string;
  stages: StageRun[];
  events: RunEvent[];
  templateId: string | null;
  templateSnapshot: StageDefinition[] | null;
  model: string | null;
  thinkingLevel: string | null;
  archived: boolean;
  cycle: number;
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
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export interface StageOverride {
  provider?: string;
  model?: string;
  thinkingLevel?: string;
  timeoutMs?: number;
}

export type StageOverrides = Record<string, StageOverride>;

export interface ProviderData {
  id: string;
  label: string;
  available: boolean;
  defaultModel: string;
  models: {
    id: string;
    label: string;
    thinkingLevels: { id: string; label: string }[];
  }[];
}
