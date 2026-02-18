"use client";

import { Badge } from "@/components/ui/badge";
import type { RunRecord, RunStatus } from "@/lib/harness/types";
import { STAGE_ORDER } from "@/lib/harness/types";
import { cn } from "@/lib/utils";

import { StatusBadge } from "./status-badge";

const borderByStatus: Record<RunStatus, string> = {
  running: "border-l-[var(--status-running)]",
  failed: "border-l-[var(--status-failed)]",
  done: "border-l-[var(--status-done)]",
  queued: "border-l-[var(--status-queued)]",
};

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

function shortText(value: string, limit = 72): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}...`;
}

export function RunCard({
  run,
  onClick,
}: {
  run: RunRecord;
  onClick: () => void;
}) {
  const stageProgress = STAGE_ORDER.map((name) => {
    const stage = run.stages.find((s) => s.name === name);
    if (!stage) return "queued" as const;
    return stage.status;
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border border-l-[3px] bg-card p-2.5 text-left transition-all",
        "hover:shadow-md hover:border-primary/30 active:scale-[0.98] active:shadow-sm",
        borderByStatus[run.status],
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <StatusBadge status={run.status} />
        <span className="text-[10px] text-muted-foreground">{relativeTime(run.updatedAt)}</span>
      </div>

      <p className="text-sm font-medium leading-snug line-clamp-2 mb-1.5">
        {shortText(run.ticket)}
      </p>

      <div className="flex items-center justify-between gap-2">
        <code className="text-[10px] text-muted-foreground font-mono">{run.id.slice(0, 8)}</code>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            {run.runnerMode}
          </Badge>
          <div className="flex gap-0.5 ml-1">
            {stageProgress.map((status, i) => (
              <span
                key={STAGE_ORDER[i]}
                className={cn(
                  "block h-1.5 w-1.5 rounded-full",
                  status === "done" || status === "skipped"
                    ? "bg-[var(--status-done)]"
                    : status === "running"
                      ? "bg-[var(--status-running)] animate-pulse"
                      : status === "failed"
                        ? "bg-[var(--status-failed)]"
                        : "bg-muted-foreground/25",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
