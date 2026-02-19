"use client";

import { useCallback, useEffect, useState } from "react";

import type { StageName } from "@/lib/harness/types";

export interface StageMetrics {
  name: StageName;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  avgDurationMs: number | null;
}

export interface RecentFailure {
  runId: string;
  ticket: string;
  stage: StageName;
  error: string;
  failedAt: string;
}

export interface AnalyticsData {
  totalRuns: number;
  runsByStatus: { queued: number; running: number; failed: number; done: number };
  successRate: number | null;
  avgDurationMs: number | null;
  stages: StageMetrics[];
  recentFailures: RecentFailure[];
}

const POLL_MS = 10_000;

async function fetchAnalytics(): Promise<AnalyticsData> {
  const response = await fetch("/api/analytics", { cache: "no-store" });
  const data = (await response.json()) as AnalyticsData & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `request failed: ${response.status}`);
  }
  return data;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const result = await fetchAnalytics();
    setData(result);
  }, []);

  useEffect(() => {
    let canceled = false;

    fetchAnalytics()
      .then((result) => {
        if (!canceled) setData(result);
      })
      .catch((err: unknown) => {
        if (!canceled) setError(err instanceof Error ? err.message : "failed to load analytics");
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    const timer = setInterval(() => {
      fetchAnalytics()
        .then((result) => {
          if (!canceled) setData(result);
        })
        .catch((err: unknown) => {
          if (!canceled) setError(err instanceof Error ? err.message : "poll failed");
        });
    }, POLL_MS);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, []);

  return { data, loading, error, setError, refresh };
}
