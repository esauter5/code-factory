"use client";

import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { StageRun } from "@/lib/harness/types";
import { cn } from "@/lib/utils";

import { StatusBadge } from "./status-badge";

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted transition-colors group">
        <span>{title}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-md border bg-muted/30 p-2 mt-1">
          <ScrollArea className="max-h-64">
            <pre className="text-xs whitespace-pre-wrap break-words font-mono leading-relaxed">
              {children}
            </pre>
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function StageDetail({ stage }: { stage: StageRun }) {
  const latest = stage.attempts.at(-1);

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex items-center gap-2 px-1">
        <StatusBadge status={stage.status} />
        {stage.startedAt && (
          <span className="text-[10px] text-muted-foreground">
            Started {displayDate(stage.startedAt)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <CollapsibleSection title="Prompt" defaultOpen={false}>
          {latest?.prompt || "(no prompt)"}
        </CollapsibleSection>

        <CollapsibleSection title="Artifact Output" defaultOpen={true}>
          {latest?.outputPreview || "(no output)"}
        </CollapsibleSection>

        <CollapsibleSection title="Logs" defaultOpen={false}>
          {latest?.logsPreview || "(no logs)"}
        </CollapsibleSection>

        {(stage.lastError || latest?.error) && (
          <CollapsibleSection title="Error" defaultOpen={true}>
            {stage.lastError || latest?.error || "(none)"}
          </CollapsibleSection>
        )}

        {stage.skipReason && (
          <div className="rounded-md border border-dashed bg-muted/30 p-2">
            <p className="text-xs font-medium text-muted-foreground">Skip reason</p>
            <p className="text-xs mt-0.5">{stage.skipReason}</p>
          </div>
        )}
      </div>

      {stage.attempts.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
              Attempts: {stage.attempts.length}
            </p>
            <div className="flex flex-col gap-1.5">
              {stage.attempts.map((attempt) => (
                <div
                  key={attempt.attempt}
                  className={cn(
                    "rounded-md border p-2 text-xs",
                    attempt === latest ? "border-primary/30 bg-muted/50" : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Attempt {attempt.attempt}
                    </span>
                    <StatusBadge status={attempt.status} />
                  </div>
                  <div className="flex gap-3 text-muted-foreground mt-1">
                    <span>Started: {displayDate(attempt.startedAt)}</span>
                    <span>Ended: {displayDate(attempt.endedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
