"use client";

import { useCallback, useMemo, useState } from "react";

import type { RunRecord, StageName } from "@/lib/harness/types";

import { KanbanBoard } from "./_components/kanban-board";
import { NewRunDialog } from "./_components/new-run-dialog";
import { RepoManagementDialog } from "./_components/repo-management-dialog";
import { RunDetailSheet } from "./_components/run-detail-sheet";
import { TopBar } from "./_components/top-bar";
import { getBoardStage, useRuns } from "./_hooks/use-runs";
import { useRunActions } from "./_hooks/use-run-actions";
import { useRepos } from "./_hooks/use-repos";

export default function Page() {
  const { runs, error, setError, refresh } = useRuns();
  const {
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
  } = useRunActions(refresh);
  const {
    repos,
    refresh: refreshRepos,
    createRepo: createRepoAction,
    updateRepo: updateRepoAction,
    deleteRepo: deleteRepoAction,
  } = useRepos();

  const [newRunOpen, setNewRunOpen] = useState(false);
  const [repoDialogOpen, setRepoDialogOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [detailStage, setDetailStage] = useState<StageName>("Plan");

  // Filter runs by selected workspace
  const filteredRuns = useMemo(() => {
    if (!selectedWorkspaceId) return runs;
    return runs.filter((r) => r.repoId === selectedWorkspaceId);
  }, [runs, selectedWorkspaceId]);

  const filteredBoardColumns = useMemo(() => {
    const columns: Record<StageName, RunRecord[]> = {
      Plan: [],
      Implement: [],
      Verify: [],
      Test: [],
      PR: [],
    };
    for (const run of filteredRuns) {
      columns[getBoardStage(run)].push(run);
    }
    for (const key of Object.keys(columns) as StageName[]) {
      columns[key].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    }
    return columns;
  }, [filteredRuns]);

  const filteredTotals = useMemo(
    () => ({
      total: filteredRuns.length,
      running: filteredRuns.filter((r) => r.status === "running").length,
      failed: filteredRuns.filter((r) => r.status === "failed").length,
      done: filteredRuns.filter((r) => r.status === "done").length,
    }),
    [filteredRuns],
  );

  // Close detail sheet if run disappears (computed, not effect-driven)
  const runStillExists = detailRunId !== null && runs.some((r) => r.id === detailRunId);
  const effectiveDetailRunId = runStillExists ? detailRunId : null;

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === effectiveDetailRunId) ?? null,
    [runs, effectiveDetailRunId],
  );

  const openRunDetail = useCallback((run: RunRecord, stageName: StageName) => {
    setDetailRunId(run.id);
    setDetailStage(stageName);
  }, []);

  const handleCreateRun = useCallback(
    async (params: {
      ticket: string;
      repoPath: string;
      repoId?: string;
      runnerMode: "mock" | "claude";
      testCommand: string;
    }) => {
      const result = await createRun(params);
      if (result) {
        setDetailRunId(result.id);
        setDetailStage(getBoardStage(result));
      }
      return result;
    },
    [createRun],
  );

  const combinedError = error || actionError;

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        totals={filteredTotals}
        repos={repos}
        selectedWorkspaceId={selectedWorkspaceId}
        onWorkspaceChange={setSelectedWorkspaceId}
        onNewRun={() => setNewRunOpen(true)}
        onManageRepos={() => setRepoDialogOpen(true)}
      />

      {combinedError && (
        <div className="flex items-center justify-between bg-destructive/10 px-4 py-1.5 text-xs text-destructive shrink-0">
          <span>{combinedError}</span>
          <button
            type="button"
            className="text-[10px] font-medium hover:underline"
            onClick={() => {
              setError("");
              setActionError("");
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden md:overflow-x-auto p-1.5 md:p-2">
        <KanbanBoard boardColumns={filteredBoardColumns} repos={repos} onCardClick={openRunDetail} />
      </main>

      <NewRunDialog
        open={newRunOpen}
        loading={actionLoading}
        repos={repos}
        initialRepoId={selectedWorkspaceId}
        onSubmit={handleCreateRun}
        onClose={() => setNewRunOpen(false)}
        onBrowseDirectory={browseDirectory}
      />

      <RunDetailSheet
        run={selectedRun}
        repos={repos}
        activeTab={detailStage}
        onTabChange={setDetailStage}
        open={Boolean(selectedRun)}
        onClose={() => setDetailRunId(null)}
        onRetryStage={(id, stage) => void retryStage(id, stage)}
        onRetryFrom={(id, stage) => void retryFrom(id, stage)}
        onEditPrompt={(id, stage, prompt) => void editPrompt(id, stage, prompt)}
        onSkipStage={(id, stage, reason) => void skipStage(id, stage, reason)}
        onCleanWorkspace={(id) => void cleanWorkspace(id)}
        actionLoading={actionLoading}
      />

      <RepoManagementDialog
        open={repoDialogOpen}
        repos={repos}
        onClose={() => setRepoDialogOpen(false)}
        onCreateRepo={async (params) => {
          const result = await createRepoAction(params);
          await refreshRepos();
          return result;
        }}
        onUpdateRepo={async (repoId, params) => {
          const result = await updateRepoAction(repoId, params);
          await refreshRepos();
          return result;
        }}
        onDeleteRepo={async (repoId) => {
          const result = await deleteRepoAction(repoId);
          await refreshRepos();
          return result;
        }}
        onBrowseDirectory={browseDirectory}
      />
    </div>
  );
}
