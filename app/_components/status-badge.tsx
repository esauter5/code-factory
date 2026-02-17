import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "queued" | "running" | "failed" | "done" | "skipped" | "needs_approval" | "blocked";

const styleByStatus: Record<Status, string> = {
  running: "bg-[var(--status-running-soft)] text-[var(--status-running)] hover:bg-[var(--status-running-soft)]",
  failed: "bg-[var(--status-failed-soft)] text-[var(--status-failed)] hover:bg-[var(--status-failed-soft)]",
  done: "bg-[var(--status-done-soft)] text-[var(--status-done)] hover:bg-[var(--status-done-soft)]",
  queued: "bg-[var(--status-queued-soft)] text-[var(--status-queued)] hover:bg-[var(--status-queued-soft)]",
  skipped: "bg-[var(--status-skipped-soft)] text-[var(--status-skipped)] hover:bg-[var(--status-skipped-soft)]",
  needs_approval: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  blocked: "bg-red-100 text-red-700 hover:bg-red-100",
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wide border-0",
        styleByStatus[status],
        className,
      )}
    >
      {status.replace("_", " ")}
    </Badge>
  );
}
