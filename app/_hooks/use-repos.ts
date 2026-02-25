"use client";

import { useCallback, useEffect, useState } from "react";

import type { RepoConfig } from "@/lib/harness/types";

interface ReposResponse {
  repos: RepoConfig[];
}

interface RepoResponse {
  repo: RepoConfig;
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `request failed: ${response.status}`);
  }
  return data;
}

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

async function apiPut<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `request failed: ${response.status}`);
  }
  return data;
}

async function apiDelete(url: string): Promise<void> {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? `request failed: ${response.status}`);
  }
}

export function useRepos() {
  const [repos, setRepos] = useState<RepoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<ReposResponse>("/api/repos");
      setRepos(data.repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load repos");
    }
  }, []);

  useEffect(() => {
    apiGet<ReposResponse>("/api/repos")
      .then((data) => setRepos(data.repos))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "failed to load repos"),
      )
      .finally(() => setLoading(false));
  }, []);

  const createRepo = useCallback(
    async (params: {
      localPath: string;
      name?: string;
      setupScript?: string;
      envFiles?: string[];
      defaultTestCommand?: string;
      appBaseUrl?: string;
      appStartCommand?: string;
      appReadyPattern?: string;
    }): Promise<RepoConfig | null> => {
      try {
        setError("");
        const data = await apiPost<RepoResponse>("/api/repos", params);
        await refresh();
        return data.repo;
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to create repo");
        return null;
      }
    },
    [refresh],
  );

  const updateRepo = useCallback(
    async (
      repoId: string,
      params: {
        name?: string;
        setupScript?: string;
        envFiles?: string[];
        defaultTestCommand?: string;
        appBaseUrl?: string;
        appStartCommand?: string;
        appReadyPattern?: string;
      },
    ): Promise<RepoConfig | null> => {
      try {
        setError("");
        const data = await apiPut<RepoResponse>(`/api/repos/${repoId}`, params);
        await refresh();
        return data.repo;
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to update repo");
        return null;
      }
    },
    [refresh],
  );

  const deleteRepo = useCallback(
    async (repoId: string): Promise<boolean> => {
      try {
        setError("");
        await apiDelete(`/api/repos/${repoId}`);
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed to delete repo");
        return false;
      }
    },
    [refresh],
  );

  return { repos, loading, error, setError, refresh, createRepo, updateRepo, deleteRepo };
}
