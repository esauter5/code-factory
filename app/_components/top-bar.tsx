"use client";

import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TopBar({
  totals,
  onNewRun,
}: {
  totals: { total: number; running: number; failed: number; done: number };
  onNewRun: () => void;
}) {
  return (
    <header className="flex h-12 items-center justify-between border-b bg-card px-3 md:px-4 shrink-0">
      <div className="flex items-center">
        <h1 className="text-sm font-bold tracking-tight">Code Factory</h1>
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

        <Button size="sm" className="h-7 text-xs gap-1" onClick={onNewRun}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Run</span>
        </Button>
      </div>
    </header>
  );
}
