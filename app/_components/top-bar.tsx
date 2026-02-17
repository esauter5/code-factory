"use client";

import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function TopBar({
  totals,
  onNewRun,
}: {
  totals: { total: number; running: number; failed: number; done: number };
  onNewRun: () => void;
}) {
  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-4 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-tight">Code Harness</h1>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Pipeline Kanban
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          {totals.running > 0 && (
            <Badge variant="secondary" className="bg-[var(--status-running-soft)] text-[var(--status-running)] hover:bg-[var(--status-running-soft)] text-[10px] font-mono">
              {totals.running} running
            </Badge>
          )}
          {totals.failed > 0 && (
            <Badge variant="secondary" className="bg-[var(--status-failed-soft)] text-[var(--status-failed)] hover:bg-[var(--status-failed-soft)] text-[10px] font-mono">
              {totals.failed} failed
            </Badge>
          )}
          {totals.done > 0 && (
            <Badge variant="secondary" className="bg-[var(--status-done-soft)] text-[var(--status-done)] hover:bg-[var(--status-done-soft)] text-[10px] font-mono">
              {totals.done} done
            </Badge>
          )}
          {totals.total === 0 && (
            <span className="text-muted-foreground">No runs</span>
          )}
        </div>

        <Button size="sm" className="h-7 text-xs gap-1" onClick={onNewRun}>
          <Plus className="h-3.5 w-3.5" />
          New Run
        </Button>
      </div>
    </header>
  );
}
