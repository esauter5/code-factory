"use client";

import { useMemo, useState } from "react";
import {
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
import type { RepoConfig, RunRecord, StageName } from "@/lib/harness/types";
import { STAGE_ORDER } from "@/lib/harness/types";
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
};

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
  actionLoading,
}: {
  run: RunRecord | null;
  repos: RepoConfig[];
  activeTab: StageName;
  onTabChange: (stage: StageName) => void;
  open: boolean;
  onClose: () => void;
  onRetryStage: (runId: string, stage: StageName) => void;
  onRetryFrom: (runId: string, stage: StageName) => void;
  onEditPrompt: (runId: string, stage: StageName, prompt: string) => void;
  onSkipStage: (runId: string, stage: StageName, reason: string) => void;
  onCleanWorkspace: (runId: string) => void;
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

  if (!run) return null;

  const isRunning = run.status === "running";
  const stageCount = run.stages.filter(
    (s) => s.status === "done" || s.status === "skipped",
  ).length;
  const hasActiveWorktree = run.worktree !== null && run.worktree.status === "ready";
  const canClean = hasActiveWorktree && !isRunning;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full md:w-[680px] md:max-w-[680px] p-0 flex flex-col gap-0">
          {/* ── Header ── */}
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
                {run.runnerMode}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {elapsed(run.createdAt, run.status === "done" || run.status === "failed" ? run.updatedAt : null)}
              </span>
              <span>{stageCount}/{STAGE_ORDER.length} stages</span>
            </div>

            {/* stage progress bar */}
            <div className="flex items-center gap-1 pt-1">
              {STAGE_ORDER.map((name, i) => {
                const sd = run.stages.find((s) => s.name === name);
                const status = sd?.status ?? "queued";
                return (
                  <div key={name} className="flex items-center gap-1 flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            statusDot[status],
                          )}
                          onClick={() => onTabChange(name)}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">
                        {name}: {status}
                      </TooltipContent>
                    </Tooltip>
                    {i < STAGE_ORDER.length - 1 && (
                      <div className="w-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </SheetHeader>

          <Separator />

          {/* ── Tabs ── */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => onTabChange(v as StageName)}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-3 md:px-5 h-10 shrink-0 overflow-x-auto flex-nowrap">
              {STAGE_ORDER.map((stage) => {
                const stageData = run.stages.find((s) => s.name === stage);
                const status = stageData?.status ?? "queued";
                return (
                  <TabsTrigger
                    key={stage}
                    value={stage}
                    className="text-xs gap-1.5 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        statusDot[status],
                      )}
                    />
                    {stage}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {STAGE_ORDER.map((stage) => {
                const stageData = run.stages.find((s) => s.name === stage);
                return (
                  <TabsContent key={stage} value={stage} className="px-3 md:px-5 mt-0 pb-4">
                    {stageData ? (
                      <StageDetail stage={stageData} />
                    ) : (
                      <p className="text-xs text-muted-foreground py-8 text-center">
                        No data for this stage yet.
                      </p>
                    )}
                  </TabsContent>
                );
              })}
            </div>
          </Tabs>

          <Separator />

          {/* ── Action bar ── */}
          <div className="flex items-center gap-2 px-3 md:px-5 py-3 shrink-0 bg-muted/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={isRunning || actionLoading}
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
                  disabled={isRunning || actionLoading}
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
                  disabled={isRunning || actionLoading}
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={isRunning || actionLoading}
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
