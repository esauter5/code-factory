"use client";

import { useCallback, useState } from "react";

import type { PrMode, RunnerMode, RunRecord, StageOverrides } from "@/lib/harness/types";

interface RunResponse {
  run: RunRecord;
}

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

export type { DirectoryEntry, DirectoryBrowseResponse };

async function apiPost<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `request failed: ${response.status}`);
  }
  return data;
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `request failed: ${response.status}`);
  }
  return data;
}

export function useRunActions(onSuccess: () => Promise<void>) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const createRun = useCallback(
    async (params: {
      ticket: string;
      repoPath: string;
      repoId?: string;
      runnerMode: RunnerMode;
      testCommand: string;
      prMode: PrMode;
      templateId?: string;
      model?: string;
      thinkingLevel?: string;
      stageOverrides?: StageOverrides;
    }): Promise<RunRecord | null> => {
      if (!params.ticket.trim()) {
        setActionError("Ticket is required");
        return null;
      }
      try {
        setActionLoading(true);
        setActionError("");
        const data = await apiPost<RunResponse>("/api/runs", params);
        await onSuccess();
        return data.run;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "failed to create run");
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [onSuccess],
  );

  const retryStage = useCallback(
    async (runId: string, stageName: string) => {
      try {
        setActionLoading(true);
        setActionError("");
        await apiPost<RunResponse>(`/api/runs/${runId}/actions/retry-stage`, {
          stage: stageName,
        });
        await onSuccess();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [onSuccess],
  );

  const retryFrom = useCallback(
    async (runId: string, stageName: string) => {
      try {
        setActionLoading(true);
        setActionError("");
        await apiPost<RunResponse>(`/api/runs/${runId}/actions/retry-from`, {
          stage: stageName,
        });
        await onSuccess();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [onSuccess],
  );

  const editPrompt = useCallback(
    async (runId: string, stageName: string, prompt: string) => {
      try {
        setActionLoading(true);
        setActionError("");
        await apiPost<RunResponse>(`/api/runs/${runId}/actions/edit-prompt`, {
          stage: stageName,
          prompt,
        });
        await onSuccess();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [onSuccess],
  );

  const skipStage = useCallback(
    async (runId: string, stageName: string, reason: string) => {
      try {
        setActionLoading(true);
        setActionError("");
        await apiPost<RunResponse>(`/api/runs/${runId}/actions/skip-stage`, {
          stage: stageName,
          reason,
        });
        await onSuccess();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [onSuccess],
  );

  const cleanWorkspace = useCallback(
    async (runId: string) => {
      try {
        setActionLoading(true);
        setActionError("");
        await apiPost<RunResponse>(`/api/runs/${runId}/actions/clean-workspace`, {});
        await onSuccess();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "action failed");
      } finally {
        setActionLoading(false);
      }
    },
    [onSuccess],
  );

  const browseDirectory = useCallback(async (targetPath: string) => {
    const data = await apiGet<DirectoryBrowseResponse>(
      `/api/fs/directories?path=${encodeURIComponent(targetPath)}`,
    );
    return data;
  }, []);

  return {
    actionLoading,
    actionError,
    setActionError,
    createRun,
    retryStage,
    retryFrom,
    editPrompt,
    skipStage,
    cleanWorkspace,
    browseDirectory,
  };
}
