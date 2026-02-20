"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplateOrDefault } from "@/lib/harness/pipeline-templates";
import type { PrMode, ProviderData, RunnerMode, RunRecord, StageOverride, StageOverrides } from "@/lib/harness/types";

import { KanbanBoard } from "./_components/kanban-board";
import { NewRunDialog } from "./_components/new-run-dialog";
import { RepoManagementDialog } from "./_components/repo-management-dialog";
import { RunDetailSheet } from "./_components/run-detail-sheet";
import { RunsTable } from "./_components/runs-table";
import { TopBar, type ViewMode } from "./_components/top-bar";
import { getBoardStage, useRuns } from "./_hooks/use-runs";
import { useRunActions } from "./_hooks/use-run-actions";
import { useRepos } from "./_hooks/use-repos";

const STAGE_OVERRIDES_KEY = "code-factory:stage-overrides";

function loadStageOverrides(): StageOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STAGE_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as StageOverrides) : {};
  } catch {
    return {};
  }
}

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
    cancelRun,
    archiveRun,
    unarchiveRun,
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
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [detailStage, setDetailStage] = useState<string>("Plan");

  // View mode and archive toggle
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [showArchived, setShowArchived] = useState(false);

  // Run-level runner mode (lifted from new-run dialog for column chips)
  const [runnerMode, setRunnerMode] = useState<RunnerMode>("mock");

  // Per-stage overrides with localStorage persistence
  const [stageOverrides, setStageOverrides] = useState<StageOverrides>(loadStageOverrides);

  useEffect(() => {
    localStorage.setItem(STAGE_OVERRIDES_KEY, JSON.stringify(stageOverrides));
  }, [stageOverrides]);

  // Providers cache
  const [providers, setProviders] = useState<ProviderData[]>([]);

  useEffect(() => {
    void fetch("/api/providers")
      .then((res) => res.json())
      .then((data: { providers: ProviderData[] }) => {
        setProviders(data.providers ?? []);
      })
      .catch(() => {});
  }, []);

  const handleOverrideChange = useCallback((stageName: string, override: StageOverride | null) => {
    setStageOverrides((prev) => {
      const next = { ...prev };
      if (override) {
        next[stageName] = override;
      } else {
        delete next[stageName];
      }
      return next;
    });
  }, []);

  const selectedTemplate = useMemo(() => getTemplateOrDefault(selectedTemplateId), [selectedTemplateId]);
  const boardStageNames = useMemo(() => [...selectedTemplate.stages.map((s) => s.name), "Done"], [selectedTemplate]);

  // Filter runs by selected workspace and archive status
  const filteredRuns = useMemo(() => {
    let result = runs;
    if (selectedWorkspaceId) {
      result = result.filter((r) => r.repoId === selectedWorkspaceId);
    }
    if (!showArchived) {
      result = result.filter((r) => !r.archived);
    }
    return result;
  }, [runs, selectedWorkspaceId, showArchived]);

  const filteredBoardColumns = useMemo(() => {
    const columns: Record<string, RunRecord[]> = {};
    for (const name of boardStageNames) {
      columns[name] = [];
    }
    for (const run of filteredRuns) {
      const stage = getBoardStage(run);
      if (columns[stage]) {
        columns[stage].push(run);
      }
    }
    for (const key of Object.keys(columns)) {
      columns[key].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    }
    return columns;
  }, [filteredRuns, boardStageNames]);

  const filteredTotals = useMemo(
    () => ({
      total: filteredRuns.length,
      running: filteredRuns.filter((r) => r.status === "running").length,
      failed: filteredRuns.filter((r) => r.status === "failed").length,
      done: filteredRuns.filter((r) => r.status === "done").length,
    }),
    [filteredRuns],
  );

  // Close detail sheet if run disappears
  const runStillExists = detailRunId !== null && runs.some((r) => r.id === detailRunId);
  const effectiveDetailRunId = runStillExists ? detailRunId : null;

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === effectiveDetailRunId) ?? null,
    [runs, effectiveDetailRunId],
  );

  const openRunDetail = useCallback((run: RunRecord, stageName: string) => {
    setDetailRunId(run.id);
    setDetailStage(stageName);
  }, []);

  const handleCreateRun = useCallback(
    async (params: {
      ticket: string;
      repoPath: string;
      repoId?: string;
      runnerMode: RunnerMode;
      testCommand: string;
      prMode: PrMode;
      templateId: string;
      model?: string;
      thinkingLevel?: string;
    }) => {
      const result = await createRun({
        ...params,
        stageOverrides,
      });
      if (result) {
        setDetailRunId(result.id);
        setDetailStage(getBoardStage(result));
      }
      return result;
    },
    [createRun, stageOverrides],
  );

  const combinedError = error || actionError;

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        totals={filteredTotals}
        repos={repos}
        selectedWorkspaceId={selectedWorkspaceId}
        onWorkspaceChange={setSelectedWorkspaceId}
        templates={BUILTIN_TEMPLATES}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={setSelectedTemplateId}
        onNewRun={() => setNewRunOpen(true)}
        onManageRepos={() => setRepoDialogOpen(true)}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
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
        {viewMode === "board" ? (
          <KanbanBoard
            stageNames={boardStageNames}
            boardColumns={filteredBoardColumns}
            repos={repos}
            onCardClick={openRunDetail}
            stageDefinitions={selectedTemplate.stages}
            stageOverrides={stageOverrides}
            onOverrideChange={handleOverrideChange}
            providers={providers}
            runnerMode={runnerMode}
          />
        ) : (
          <RunsTable
            runs={filteredRuns}
            repos={repos}
            onRowClick={openRunDetail}
          />
        )}
      </main>

      <NewRunDialog
        open={newRunOpen}
        loading={actionLoading}
        repos={repos}
        initialRepoId={selectedWorkspaceId}
        onSubmit={handleCreateRun}
        onClose={() => setNewRunOpen(false)}
        onBrowseDirectory={browseDirectory}
        onRunnerModeChange={setRunnerMode}
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
        onCancelRun={(id) => void cancelRun(id)}
        onArchiveRun={(id) => void archiveRun(id)}
        onUnarchiveRun={(id) => void unarchiveRun(id)}
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
