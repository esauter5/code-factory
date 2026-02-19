"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RepoConfig, RunRecord, StageName } from "@/lib/harness/types";

import { RunCard } from "./run-card";

export function BoardColumn({
  stageName,
  runs,
  repos,
  onCardClick,
}: {
  stageName: StageName;
  runs: RunRecord[];
  repos: RepoConfig[];
  onCardClick: (run: RunRecord, stageName: StageName) => void;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {stageName}
        </h3>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
          {runs.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 rounded-md bg-[var(--column-bg)] p-1.5">
        <div className="flex flex-col gap-1.5">
          {runs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No runs
            </div>
          ) : (
            runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                repos={repos}
                onClick={() => onCardClick(run, stageName)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
