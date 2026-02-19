import { NextResponse } from "next/server";

import { getOrchestrator } from "@/lib/harness/singleton";
import { STAGE_ORDER, type RunRecord, type StageName } from "@/lib/harness/types";

export const runtime = "nodejs";

interface StageMetrics {
  name: StageName;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  avgDurationMs: number | null;
}

interface RecentFailure {
  runId: string;
  ticket: string;
  stage: StageName;
  error: string;
  failedAt: string;
}

interface AnalyticsData {
  totalRuns: number;
  runsByStatus: { queued: number; running: number; failed: number; done: number };
  successRate: number | null;
  avgDurationMs: number | null;
  stages: StageMetrics[];
  recentFailures: RecentFailure[];
}

function computeDurationMs(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const diff = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return diff > 0 ? diff : null;
}

function computeRunDurationMs(run: RunRecord): number | null {
  if (run.status !== "done" && run.status !== "failed") return null;
  const firstStarted = run.stages.find((s) => s.startedAt)?.startedAt ?? null;
  const lastEnded = run.stages
    .filter((s) => s.endedAt)
    .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime())[0]?.endedAt ?? null;
  return computeDurationMs(firstStarted, lastEnded);
}

export async function GET(): Promise<NextResponse> {
  const orchestrator = getOrchestrator();
  const runs = await orchestrator.listRuns();

  const runsByStatus = { queued: 0, running: 0, failed: 0, done: 0 };
  for (const run of runs) {
    runsByStatus[run.status]++;
  }

  const completed = runsByStatus.done + runsByStatus.failed;
  const successRate = completed > 0 ? runsByStatus.done / completed : null;

  const runDurations = runs.map(computeRunDurationMs).filter((d): d is number => d !== null);
  const avgDurationMs =
    runDurations.length > 0 ? runDurations.reduce((a, b) => a + b, 0) / runDurations.length : null;

  const stages: StageMetrics[] = STAGE_ORDER.map((stageName) => {
    let total = 0;
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const durations: number[] = [];

    for (const run of runs) {
      const stage = run.stages.find((s) => s.name === stageName);
      if (!stage || stage.status === "queued") continue;
      total++;
      if (stage.status === "done") success++;
      else if (stage.status === "failed") failed++;
      else if (stage.status === "skipped") skipped++;

      const dur = computeDurationMs(stage.startedAt, stage.endedAt);
      if (dur !== null) durations.push(dur);
    }

    return {
      name: stageName,
      total,
      success,
      failed,
      skipped,
      avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    };
  });

  const recentFailures: RecentFailure[] = [];
  const sortedRuns = [...runs].sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  for (const run of sortedRuns) {
    if (recentFailures.length >= 10) break;
    for (const stage of run.stages) {
      if (stage.status === "failed" && recentFailures.length < 10) {
        recentFailures.push({
          runId: run.id,
          ticket: run.ticket,
          stage: stage.name,
          error: stage.lastError ? stage.lastError.slice(0, 200) : "",
          failedAt: stage.endedAt ?? run.updatedAt,
        });
      }
    }
  }

  const data: AnalyticsData = {
    totalRuns: runs.length,
    runsByStatus,
    successRate,
    avgDurationMs,
    stages,
    recentFailures,
  };

  return NextResponse.json(data);
}
