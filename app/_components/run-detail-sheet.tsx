"use client";

import { useMemo, useState } from "react";
import { Pencil, Play, RotateCcw, SkipForward } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { RunRecord, StageName } from "@/lib/harness/types";
import { STAGE_ORDER } from "@/lib/harness/types";

import { EditPromptDialog } from "./edit-prompt-dialog";
import { SkipStageDialog } from "./skip-stage-dialog";
import { StageDetail } from "./stage-detail";
import { StatusBadge } from "./status-badge";

function shortText(value: string, limit = 120): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}...`;
}

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

const stageShort: Record<StageName, string> = {
  Plan: "Plan",
  Implement: "Impl",
  Verify: "Vrfy",
  Test: "Test",
  PR: "PR",
};

export function RunDetailSheet({
  run,
  activeTab,
  onTabChange,
  open,
  onClose,
  onRetryStage,
  onRetryFrom,
  onEditPrompt,
  onSkipStage,
  actionLoading,
}: {
  run: RunRecord | null;
  activeTab: StageName;
  onTabChange: (stage: StageName) => void;
  open: boolean;
  onClose: () => void;
  onRetryStage: (runId: string, stage: StageName) => void;
  onRetryFrom: (runId: string, stage: StageName) => void;
  onEditPrompt: (runId: string, stage: StageName, prompt: string) => void;
  onSkipStage: (runId: string, stage: StageName, reason: string) => void;
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

  if (!run) return null;

  const isRunning = run.status === "running";

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-[500px] sm:w-[500px] sm:max-w-[500px] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm font-mono">
                {run.id.slice(0, 8)}
              </SheetTitle>
              <StatusBadge status={run.status} />
            </div>
            <SheetDescription className="text-xs leading-relaxed">
              {shortText(run.ticket)}
            </SheetDescription>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="truncate max-w-[200px]" title={run.repoPath}>
                {run.repoPath}
              </span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                {run.runnerMode}
              </Badge>
              <span>{relativeTime(run.updatedAt)}</span>
            </div>
          </SheetHeader>

          <Separator />

          <Tabs
            value={activeTab}
            onValueChange={(v) => onTabChange(v as StageName)}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-9 shrink-0">
              {STAGE_ORDER.map((stage) => {
                const stageData = run.stages.find((s) => s.name === stage);
                return (
                  <TabsTrigger
                    key={stage}
                    value={stage}
                    className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2"
                  >
                    {stageShort[stage]}
                    {stageData && stageData.status !== "queued" && (
                      <span className="ml-1 text-[9px] text-muted-foreground">
                        ({stageData.status === "done" ? "\u2713" : stageData.status === "failed" ? "\u2717" : stageData.status === "running" ? "\u25CF" : stageData.status})
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <ScrollArea className="flex-1">
              {STAGE_ORDER.map((stage) => {
                const stageData = run.stages.find((s) => s.name === stage);
                return (
                  <TabsContent key={stage} value={stage} className="px-4 mt-0">
                    {stageData ? (
                      <StageDetail stage={stageData} />
                    ) : (
                      <p className="text-xs text-muted-foreground py-4">
                        No data for this stage.
                      </p>
                    )}
                  </TabsContent>
                );
              })}
            </ScrollArea>
          </Tabs>

          <Separator />

          <div className="flex items-center gap-1.5 px-4 py-2.5 shrink-0 bg-muted/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={isRunning || actionLoading}
                  onClick={() => onRetryStage(run.id, activeTab)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry this stage</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={isRunning || actionLoading}
                  onClick={() => onRetryFrom(run.id, activeTab)}
                >
                  <Play className="h-3 w-3" />
                  Retry from
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry from this stage onward</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={isRunning || actionLoading}
                  onClick={() => setEditPromptOpen(true)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit prompt for this stage</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={isRunning || actionLoading}
                  onClick={() => setSkipStageOpen(true)}
                >
                  <SkipForward className="h-3 w-3" />
                  Skip
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skip this stage</TooltipContent>
            </Tooltip>
          </div>
        </SheetContent>
      </Sheet>

      <EditPromptDialog
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
