"use client";

import { Archive, FolderGit2, List, Plus, TableProperties } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PipelineTemplate } from "@/lib/harness/pipeline-templates";
import type { RepoConfig } from "@/lib/harness/types";

const ALL_WORKSPACES = "__all__";

export type ViewMode = "board" | "table";

export function TopBar({
  totals,
  repos,
  selectedWorkspaceId,
  onWorkspaceChange,
  templates,
  selectedTemplateId,
  onTemplateChange,
  onNewRun,
  onManageRepos,
  showArchived,
  onShowArchivedChange,
  viewMode,
  onViewModeChange,
}: {
  totals: { total: number; running: number; failed: number; done: number };
  repos: RepoConfig[];
  selectedWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
  templates: PipelineTemplate[];
  selectedTemplateId: string;
  onTemplateChange: (templateId: string) => void;
  onNewRun: () => void;
  onManageRepos: () => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-3 md:px-4 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-tight">Code Factory</h1>

        {repos.length > 0 && (
          <Select
            value={selectedWorkspaceId ?? ALL_WORKSPACES}
            onValueChange={(v) => onWorkspaceChange(v === ALL_WORKSPACES ? null : v)}
          >
            <SelectTrigger className="h-7 w-[160px] md:w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_WORKSPACES}>All workspaces</SelectItem>
              {repos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {viewMode === "board" && (
          <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
            <SelectTrigger className="h-7 w-[120px] md:w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-3">
        <div className="flex items-center gap-2 text-xs">
          {totals.running > 0 && (
            <Badge variant="secondary" className="bg-[var(--status-running-soft)] text-[var(--status-running)] hover:bg-[var(--status-running-soft)] text-[10px] font-mono">
              {totals.running} <span className="hidden md:inline">running</span>
            </Badge>
          )}
          {totals.failed > 0 && (
            <Badge variant="secondary" className="bg-[var(--status-failed-soft)] text-[var(--status-failed)] hover:bg-[var(--status-failed-soft)] text-[10px] font-mono">
              {totals.failed} <span className="hidden md:inline">failed</span>
            </Badge>
          )}
          {totals.done > 0 && (
            <Badge variant="secondary" className="bg-[var(--status-done-soft)] text-[var(--status-done)] hover:bg-[var(--status-done-soft)] text-[10px] font-mono">
              {totals.done} <span className="hidden md:inline">done</span>
            </Badge>
          )}
          {totals.total === 0 && (
            <span className="text-muted-foreground">No runs</span>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onShowArchivedChange(!showArchived)}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{showArchived ? "Hide archived" : "Show archived"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onViewModeChange(viewMode === "board" ? "table" : "board")}
            >
              {viewMode === "board" ? (
                <TableProperties className="h-3.5 w-3.5" />
              ) : (
                <List className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{viewMode === "board" ? "All Runs table" : "Board view"}</TooltipContent>
        </Tooltip>

        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onManageRepos}>
          <FolderGit2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Repos</span>
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={onNewRun}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Run</span>
        </Button>
      </div>
    </header>
  );
}
