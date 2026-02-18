"use client";

import { useCallback, useState } from "react";
import { Check, ChevronDown, Clock, Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StageRun } from "@/lib/harness/types";
import { cn } from "@/lib/utils";

import { StatusBadge } from "./status-badge";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--status-done)]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{copied ? "Copied" : "Copy to clipboard"}</TooltipContent>
    </Tooltip>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  text,
}: {
  title: string;
  defaultOpen?: boolean;
  text: string;
}) {
  const isEmpty = !text || text.startsWith("(no ") || text === "(none)";

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors group">
        <span>{title}</span>
        <div className="flex items-center gap-1.5">
          {isEmpty && (
            <span className="text-[10px] font-normal text-muted-foreground">empty</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative rounded-md border bg-muted/30 mt-1 max-h-[420px] overflow-y-auto">
          {!isEmpty && (
            <div className="sticky top-0 right-0 float-right p-1.5 z-10">
              <CopyButton text={text} />
            </div>
          )}
          <pre className={cn(
            "text-xs whitespace-pre-wrap break-words font-mono leading-relaxed p-3",
            isEmpty && "text-muted-foreground italic",
          )}>
            {text}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
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

export function StageDetail({ stage }: { stage: StageRun }) {
  const latest = stage.attempts.at(-1);

  return (
    <div className="flex flex-col gap-3 py-3">
      {/* status + timing */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={stage.status} />
          {stage.attempts.length > 1 && (
            <span className="text-[10px] text-muted-foreground">
              {stage.attempts.length} attempts
            </span>
          )}
        </div>
        {stage.startedAt && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {elapsed(stage.startedAt, stage.endedAt)}
          </span>
        )}
      </div>

      {/* content sections */}
      <div className="flex flex-col gap-1.5">
        <CollapsibleSection
          title="Prompt"
          defaultOpen={false}
          text={latest?.prompt || "(no prompt)"}
        />

        <CollapsibleSection
          title="Artifact Output"
          defaultOpen={true}
          text={latest?.outputPreview || "(no output)"}
        />

        <CollapsibleSection
          title="Logs"
          defaultOpen={false}
          text={latest?.logsPreview || "(no logs)"}
        />

        {(stage.lastError || latest?.error) && (
          <CollapsibleSection
            title="Error"
            defaultOpen={true}
            text={stage.lastError || latest?.error || "(none)"}
          />
        )}

        {stage.skipReason && (
          <div className="rounded-md border border-dashed bg-muted/30 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Skip reason</p>
            <p className="text-xs">{stage.skipReason}</p>
          </div>
        )}
      </div>

      {/* attempts history */}
      {stage.attempts.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">
              Attempt history
            </p>
            <div className="flex flex-col gap-1.5">
              {stage.attempts.map((attempt) => (
                <div
                  key={attempt.attempt}
                  className={cn(
                    "rounded-md border p-3 text-xs",
                    attempt === latest
                      ? "border-primary/30 bg-muted/50"
                      : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Attempt {attempt.attempt}
                      </span>
                      {attempt === latest && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          latest
                        </Badge>
                      )}
                    </div>
                    <StatusBadge status={attempt.status} />
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{displayDate(attempt.startedAt)}</span>
                    {attempt.endedAt && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {elapsed(attempt.startedAt, attempt.endedAt)}
                      </span>
                    )}
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
