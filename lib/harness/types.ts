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

export interface RunRecord {
  id: string;
  ticket: string;
  repoPath: string;
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
}

export interface RunnerResult {
  success: boolean;
  output: string;
  logs: string;
  error: string;
}
