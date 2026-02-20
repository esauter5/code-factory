"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Ban,
  Clock,
  GitBranch,
  Pencil,
  Play,
  RotateCcw,
  SkipForward,
  Terminal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RepoConfig, RunRecord, StageAttempt } from "@/lib/harness/types";
import { cn } from "@/lib/utils";

import { EditPromptDialog } from "./edit-prompt-dialog";
import { SkipStageDialog } from "./skip-stage-dialog";
import { StageDetail } from "./stage-detail";
import { StatusBadge } from "./status-badge";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function elapsed(from: string, to: string | null): string {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const statusDot: Record<string, string> = {
  done: "bg-[var(--status-done)]",
  skipped: "bg-[var(--status-skipped)]",
  running: "bg-[var(--status-running)] animate-pulse",
  failed: "bg-[var(--status-failed)]",
  queued: "bg-muted-foreground/25",
  cancelled: "bg-[var(--status-cancelled)]",
};

interface CycleNode {
  stageName: string;
  status: "done" | "failed" | "running" | "skipped";
}

interface CycleInfo {
  cycle: number;
  nodes: CycleNode[];
}

function buildCycleTimeline(run: RunRecord): CycleInfo[] {
  // Collect all attempts across all stages, group by cycle
  const cycleMap = new Map<number, { stageName: string; attempt: StageAttempt }[]>();

  for (const stage of run.stages) {
    for (const attempt of stage.attempts) {
      const cycle = attempt.cycle || 1;
      if (!cycleMap.has(cycle)) cycleMap.set(cycle, []);
      cycleMap.get(cycle)!.push({ stageName: stage.name, attempt });
    }
  }

  const cycles: CycleInfo[] = [];
  const sortedKeys = [...cycleMap.keys()].sort((a, b) => a - b);

  for (const cycleNum of sortedKeys) {
    const entries = cycleMap.get(cycleNum)!;
    // Deduplicate stages (take the last attempt per stage in this cycle)
    const stageMap = new Map<string, StageAttempt>();
    for (const { stageName, attempt } of entries) {
      stageMap.set(stageName, attempt);
    }
    const nodes: CycleNode[] = [];
    // Preserve original stage order
    for (const stage of run.stages) {
      const attempt = stageMap.get(stage.name);
      if (attempt) {
        nodes.push({
          stageName: stage.name,
          status: attempt.status === "running" ? "running" : attempt.status,
        });
      }
    }
    if (nodes.length > 0) {
      cycles.push({ cycle: cycleNum, nodes });
    }
  }

  return cycles;
}

const timelineStatusIcon: Record<string, string> = {
  done: "text-[var(--status-done)]",
  failed: "text-[var(--status-failed)]",
  running: "text-[var(--status-running)]",
  skipped: "text-[var(--status-skipped)]",
};

function CycleTimeline({
  cycles,
  onSelectStage,
}: {
  cycles: CycleInfo[];
  onSelectStage: (stageName: string) => void;
}) {
  if (cycles.length <= 1) return null;

  return (
    <div className="flex flex-col gap-1 px-1 py-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
        Pipeline Journey
      </p>
      {cycles.map((cycle) => (
        <div key={cycle.cycle} className="flex items-center gap-1 text-[10px]">
          <span className="text-muted-foreground font-mono w-14 shrink-0">
            Cycle {cycle.cycle}:
          </span>
          <div className="flex items-center gap-0.5 flex-wrap">
            {cycle.nodes.map((node, i) => (
              <span key={`${cycle.cycle}-${node.stageName}`} className="flex items-center gap-0.5">
                <button
                  type="button"
                  className={cn(
                    "hover:underline cursor-pointer font-medium",
                    timelineStatusIcon[node.status],
                  )}
                  onClick={() => onSelectStage(node.stageName)}
                >
                  {node.stageName}
                  {node.status === "done" && " \u2713"}
                  {node.status === "failed" && " \u2717"}
                  {node.status === "running" && " ..."}
                </button>
                {i < cycle.nodes.length - 1 && (
                  <span className="text-muted-foreground/50 mx-0.5">{"\u2192"}</span>
                )}
              </span>
            ))}
            {/* Show Done at end if all passed in this cycle */}
            {cycle.nodes.length > 0 && cycle.nodes.every((n) => n.status === "done") && (
              <span className="text-muted-foreground/50 mx-0.5">
                {"\u2192"} <span className="text-[var(--status-done)] font-medium">Done</span>
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RunDetailSheet({
  run,
  repos,
  activeTab,
  onTabChange,
  open,
  onClose,
  onRetryStage,
  onRetryFrom,
  onEditPrompt,
  onSkipStage,
  onCleanWorkspace,
  onCancelRun,
  onArchiveRun,
  onUnarchiveRun,
  actionLoading,
}: {
  run: RunRecord | null;
  repos: RepoConfig[];
  activeTab: string;
  onTabChange: (stage: string) => void;
  open: boolean;
  onClose: () => void;
  onRetryStage: (runId: string, stage: string) => void;
  onRetryFrom: (runId: string, stage: string) => void;
  onEditPrompt: (runId: string, stage: string, prompt: string) => void;
  onSkipStage: (runId: string, stage: string, reason: string) => void;
  onCleanWorkspace: (runId: string) => void;
  onCancelRun: (runId: string) => void;
  onArchiveRun: (runId: string) => void;
  onUnarchiveRun: (runId: string) => void;
  actionLoading: boolean;
}) {
  const [editPromptOpen, setEditPromptOpen] = useState(false);
  const [skipStageOpen, setSkipStageOpen] = useState(false);

  const selectedStage = useMemo(
    () => run?.stages.find((s) => s.name === activeTab) ?? null,
    [run, activeTab],
  );

  const currentPrompt = useMemo(() => {
    if (!selectedStage) return "";
    return selectedStage.attempts.at(-1)?.prompt ?? "";
  }, [selectedStage]);

  const repoName = useMemo(() => {
    if (!run?.repoId) return null;
    return repos.find((r) => r.id === run.repoId)?.name ?? null;
  }, [run, repos]);

  const cycleTimeline = useMemo(() => (run ? buildCycleTimeline(run) : []), [run]);

  if (!run) return null;

  const isRunning = run.status === "running";
  const isCancelled = run.status === "cancelled";
  const stageCount = run.stages.filter(
    (s) => s.status === "done" || s.status === "skipped",
  ).length;
  const hasActiveWorktree = run.worktree != null && run.worktree.status === "ready";
  const canClean = hasActiveWorktree && !isRunning;

  // Determine if the selected stage has a PR URL
  const isPrStage = run.stages.some((s) => s.name === activeTab && s.name === "PR");

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full md:w-[680px] md:max-w-[680px] p-0 flex flex-col gap-0">
          {/* -- Header -- */}
          <SheetHeader className="px-3 md:px-5 pt-5 pb-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SheetTitle className="text-base font-semibold font-mono tracking-tight">
                  {run.id.slice(0, 8)}
                </SheetTitle>
                <StatusBadge status={run.status} />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {relativeTime(run.updatedAt)}
              </span>
            </div>

            <SheetDescription className="text-sm leading-relaxed line-clamp-3">
              {run.ticket}
            </SheetDescription>

            {/* meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                <span className="truncate max-w-[160px] md:max-w-[260px] font-mono" title={run.repoPath}>
                  {repoName ?? run.repoPath}
                </span>
              </span>
              {run.worktree && (
                <span className="inline-flex items-center gap-1 font-mono">
                  {run.worktree.branch}
                  {run.worktree.status === "cleaned" && (
                    <span className="text-muted-foreground/60">(cleaned)</span>
                  )}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                {run.runnerMode}{run.model ? ` / ${run.model}` : ""}
              </span>
              {run.thinkingLevel && (
                <span className="inline-flex items-center gap-1">
                  thinking: {run.thinkingLevel}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {elapsed(run.createdAt, run.status === "done" || run.status === "failed" || run.status === "cancelled" ? run.updatedAt : null)}
              </span>
              <span>{stageCount}/{run.stages.length} stages</span>
            </div>

            {/* stage progress bar */}
            <div className="flex items-center gap-1 pt-1">
              {run.stages.map((sd, i) => {
                const status = sd.status;
                return (
                  <div key={sd.name} className="flex items-center gap-1 flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            statusDot[status],
                          )}
                          onClick={() => onTabChange(sd.name)}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">
                        {sd.name}: {status}
                      </TooltipContent>
                    </Tooltip>
                    {i < run.stages.length - 1 && (
                      <div className="w-1" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* cycle timeline — only shown when multiple cycles exist */}
            <CycleTimeline cycles={cycleTimeline} onSelectStage={onTabChange} />
          </SheetHeader>

          <Separator />

          {/* -- Tabs -- */}
          <Tabs
            value={activeTab}
            onValueChange={onTabChange}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-3 md:px-5 h-10 shrink-0 overflow-x-auto flex-nowrap">
              {run.stages.map((stageData) => {
                const status = stageData.status;
                return (
                  <TabsTrigger
                    key={stageData.name}
                    value={stageData.name}
                    className="text-xs gap-1.5 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        statusDot[status],
                      )}
                    />
                    {stageData.name}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {run.stages.map((stageData) => (
                <TabsContent key={stageData.name} value={stageData.name} className="px-3 md:px-5 mt-0 pb-4">
                  <StageDetail stage={stageData} runId={run.id} prUrl={stageData.name === "PR" ? run.prUrl : undefined} />
                </TabsContent>
              ))}
            </div>
          </Tabs>

          <Separator />

          {/* -- Action bar -- */}
          <div className="flex flex-wrap items-center gap-2 px-3 md:px-5 py-3 shrink-0 bg-muted/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={isRunning || isCancelled || actionLoading}
                  onClick={() => onRetryStage(run.id, activeTab)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Retry stage</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Re-run this stage only</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={isRunning || isCancelled || actionLoading}
                  onClick={() => onRetryFrom(run.id, activeTab)}
                >
                  <Play className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Retry from here</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Re-run from this stage onward</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={isRunning || isCancelled || actionLoading}
                  onClick={() => setEditPromptOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit prompt</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Modify the prompt for this stage</TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            {canClean && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={actionLoading}
                    onClick={() => onCleanWorkspace(run.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Clean workspace</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove worktree and branch</TooltipContent>
              </Tooltip>
            )}

            {run.archived ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={actionLoading}
                    onClick={() => onUnarchiveRun(run.id)}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Unarchive</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore this run from archive</TooltipContent>
              </Tooltip>
            ) : (run.status === "done" || run.status === "failed" || run.status === "cancelled") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={actionLoading}
                    onClick={() => onArchiveRun(run.id)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Archive</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide this run from the board</TooltipContent>
              </Tooltip>
            )}

            {(run.status === "failed" || run.status === "queued") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-[var(--status-cancelled)]"
                    disabled={isRunning || actionLoading}
                    onClick={() => onCancelRun(run.id)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abandon this run</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={isRunning || isCancelled || actionLoading}
                  onClick={() => setSkipStageOpen(true)}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Skip</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skip this stage and proceed</TooltipContent>
            </Tooltip>
          </div>
        </SheetContent>
      </Sheet>

      <EditPromptDialog
        key={`${run.id}:${activeTab}:${currentPrompt}`}
        open={editPromptOpen}
        stageName={activeTab}
        currentPrompt={currentPrompt}
        loading={actionLoading}
        onSubmit={(prompt) => {
          onEditPrompt(run.id, activeTab, prompt);
          setEditPromptOpen(false);
        }}
        onClose={() => setEditPromptOpen(false)}
      />

      <SkipStageDialog
        open={skipStageOpen}
        stageName={activeTab}
        loading={actionLoading}
        onSubmit={(reason) => {
          onSkipStage(run.id, activeTab, reason);
          setSkipStageOpen(false);
        }}
        onClose={() => setSkipStageOpen(false)}
      />
    </>
  );
}
