"use client";

import { useCallback, useMemo, useState } from "react";

import type { RunRecord, StageName } from "@/lib/harness/types";

import { KanbanBoard } from "./_components/kanban-board";
import { NewRunDialog } from "./_components/new-run-dialog";
import { RunDetailSheet } from "./_components/run-detail-sheet";
import { TopBar } from "./_components/top-bar";
import { getBoardStage, useRuns } from "./_hooks/use-runs";
import { useRunActions } from "./_hooks/use-run-actions";

export default function Page() {
  const { runs, boardColumns, totals, error, setError, refresh } = useRuns();
  const {
    actionLoading,
    actionError,
    setActionError,
    createRun,
    retryStage,
    retryFrom,
    editPrompt,
    skipStage,
    browseDirectory,
  } = useRunActions(refresh);

  const [newRunOpen, setNewRunOpen] = useState(false);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [detailStage, setDetailStage] = useState<StageName>("Plan");

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
      <TopBar totals={totals} onNewRun={() => setNewRunOpen(true)} />

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
        <KanbanBoard boardColumns={boardColumns} onCardClick={openRunDetail} />
      </main>

      <NewRunDialog
        open={newRunOpen}
        loading={actionLoading}
        onSubmit={handleCreateRun}
        onClose={() => setNewRunOpen(false)}
        onBrowseDirectory={browseDirectory}
      />

      <RunDetailSheet
        run={selectedRun}
        activeTab={detailStage}
        onTabChange={setDetailStage}
        open={Boolean(selectedRun)}
        onClose={() => setDetailRunId(null)}
        onRetryStage={(id, stage) => void retryStage(id, stage)}
        onRetryFrom={(id, stage) => void retryFrom(id, stage)}
        onEditPrompt={(id, stage, prompt) => void editPrompt(id, stage, prompt)}
        onSkipStage={(id, stage, reason) => void skipStage(id, stage, reason)}
        actionLoading={actionLoading}
      />
    </div>
  );
}
