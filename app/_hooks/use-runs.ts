"use client";

import { useCallback, useEffect, useState } from "react";

import type { RunRecord } from "@/lib/harness/types";

interface RunsResponse {
  runs: RunRecord[];
}

const POLL_MS = 1800;

function getBoardStage(run: RunRecord): string {
  // Cancelled/done runs go to the Done column
  if (run.status === "done" || run.status === "cancelled") return "Done";
  const running = run.stages.find((stage) => stage.status === "running");
  if (running) return running.name;
  const failed = run.stages.find((stage) => stage.status === "failed");
  if (failed) return failed.name;
  const queued = run.stages.find((stage) => stage.status === "queued");
  if (queued) return queued.name;
  // All stages done but run status not yet "done" — show in Done
  return "Done";
}

export { getBoardStage };

async function fetchRunsFromApi(): Promise<RunRecord[]> {
  const response = await fetch("/api/runs", { cache: "no-store" });
  const data = (await response.json()) as RunsResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `request failed: ${response.status}`);
  }
  return data.runs;
}

export function useRuns() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async (): Promise<void> => {
    const newRuns = await fetchRunsFromApi();
    setRuns(newRuns);
  }, []);

  const clearError = useCallback(() => setError(""), []);

  useEffect(() => {
    let canceled = false;

    fetchRunsFromApi()
      .then((newRuns) => {
        if (!canceled) setRuns(newRuns);
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "failed to load runs");
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    const timer = setInterval(() => {
      fetchRunsFromApi()
        .then((newRuns) => {
          if (!canceled) setRuns(newRuns);
        })
        .catch((err: unknown) => {
          if (!canceled) {
            setError(err instanceof Error ? err.message : "poll failed");
          }
        });
    }, POLL_MS);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, []);

  return { runs, loading, error, setError, clearError, refresh };
}
