"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RepoConfig, RunRecord } from "@/lib/harness/types";
import { cn } from "@/lib/utils";

import { StatusBadge } from "./status-badge";
import { getBoardStage } from "../_hooks/use-runs";

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

function shortText(value: string, limit = 60): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}...`;
}

export function RunsTable({
  runs,
  repos,
  onRowClick,
}: {
  runs: RunRecord[];
  repos: RepoConfig[];
  onRowClick: (run: RunRecord, stageName: string) => void;
}) {
  const sorted = [...runs].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  return (
    <ScrollArea className="h-full">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 px-3 font-semibold">Title</th>
            <th className="py-2 px-3 font-semibold w-[100px]">Template</th>
            <th className="py-2 px-3 font-semibold w-[120px]">Repo</th>
            <th className="py-2 px-3 font-semibold w-[100px]">Stage</th>
            <th className="py-2 px-3 font-semibold w-[90px]">Status</th>
            <th className="py-2 px-3 font-semibold w-[80px]">Created</th>
            <th className="py-2 px-3 font-semibold w-[90px]">Runner</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-12 text-center text-muted-foreground">
                No runs found
              </td>
            </tr>
          ) : (
            sorted.map((run) => {
              const repoName = run.repoId
                ? repos.find((r) => r.id === run.repoId)?.name ?? null
                : null;
              const boardStage = getBoardStage(run);

              return (
                <tr
                  key={run.id}
                  className={cn(
                    "border-b cursor-pointer hover:bg-muted/50 transition-colors",
                    run.archived && "opacity-40",
                  )}
                  onClick={() => onRowClick(run, boardStage)}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {run.id.slice(0, 8)}
                      </code>
                      <span className="font-medium truncate">{shortText(run.ticket)}</span>
                      {run.archived && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">archived</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                      {run.templateId ?? "custom"}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 truncate font-mono text-muted-foreground" title={run.repoPath}>
                    {repoName ?? "-"}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {boardStage}
                  </td>
                  <td className="py-2 px-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {relativeTime(run.createdAt)}
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {run.runnerMode}{run.model ? ` / ${run.model}` : ""}
                    </Badge>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </ScrollArea>
  );
}
