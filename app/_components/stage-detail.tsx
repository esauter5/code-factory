"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function formatLogLine(line: string): string {
  try {
    const event = JSON.parse(line) as {
      type?: string;
      subtype?: string;
      hook_name?: string;
      outcome?: string;
      model?: string;
      message?: {
        model?: string;
        content?: Array<{ type?: string; text?: string; name?: string }>;
      };
      total_cost_usd?: number;
      duration_ms?: number;
      num_turns?: number;
    };

    if (event.type === "system") {
      if (event.subtype === "init") {
        return `[init] ${event.model ?? "claude"} session started`;
      }
      if (event.subtype === "hook_started") {
        return `[hook] ${event.hook_name ?? "hook"} ...`;
      }
      if (event.subtype === "hook_response") {
        return `[hook] ${event.hook_name ?? "hook"} ${event.outcome ?? "done"}`;
      }
      // skip other system events
      return "";
    }

    if (event.type === "result") {
      const status = event.subtype === "success" ? "completed" : "error";
      const cost = event.total_cost_usd ? ` ($${event.total_cost_usd.toFixed(3)})` : "";
      const dur = event.duration_ms ? ` ${(event.duration_ms / 1000).toFixed(1)}s` : "";
      const turns = event.num_turns ? ` ${event.num_turns} turns` : "";
      return `[result] ${status}${dur}${turns}${cost}`;
    }

    if (event.type === "assistant" && event.message?.content) {
      const parts: string[] = [];
      for (const block of event.message.content) {
        if (block.type === "text" && block.text) {
          const preview = block.text.length > 200 ? `${block.text.slice(0, 200)}...` : block.text;
          parts.push(`[text] ${preview}`);
        } else if (block.type === "tool_use" && block.name) {
          parts.push(`[tool] ${block.name}`);
        }
      }
      return parts.join("\n") || "";
    }

    if (event.type === "user") {
      return "[tool_result] ...";
    }

    return "";
  } catch {
    return line;
  }
}

function LiveOutput({ runId, stageName, active }: { runId: string; stageName: string; active: boolean }) {
  const [content, setContent] = useState("");
  const scrollRef = useRef<HTMLPreElement>(null);
  const hasFetchedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/logs?stage=${stageName}`);
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { content: string };
          setContent(data.content || "");
          hasFetchedOnce.current = true;
        }
      } catch {
        // ignore fetch errors
      }
    };

    void poll();

    // Only poll repeatedly while the stage is actively running
    let interval: ReturnType<typeof setInterval> | undefined;
    if (active) {
      interval = setInterval(() => void poll(), 2000);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [runId, stageName, active]);

  // Auto-scroll to bottom on new content while active
  useEffect(() => {
    if (active && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, active]);

  const formatted = content
    ? content
        .split("\n")
        .filter((l) => l.trim())
        .map(formatLogLine)
        .filter((l) => l)
        .join("\n")
    : active
      ? "Waiting for Claude to start streaming..."
      : "";

  // Don't render if completed with no log content
  if (!active && !content) return null;

  return (
    <Collapsible defaultOpen={active}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors group">
        <span className="flex items-center gap-2">
          {active ? "Live Output" : "Stream Log"}
          {active && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--status-running)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--status-running)]" />
            </span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative rounded-md border bg-black/90 mt-1 max-h-[320px] overflow-y-auto">
          {content && (
            <div className="sticky top-0 right-0 float-right p-1.5 z-10">
              <CopyButton text={content} />
            </div>
          )}
          <pre
            ref={scrollRef}
            className={cn(
              "text-xs whitespace-pre-wrap break-words font-mono leading-relaxed p-3",
              active ? "text-green-400/90" : "text-green-400/60",
            )}
          >
            {formatted}
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

export function StageDetail({ stage, runId }: { stage: StageRun; runId: string }) {
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

      {/* stream log — live when running, static when complete */}
      {stage.attempts.length > 0 && (
        <LiveOutput runId={runId} stageName={stage.name} active={stage.status === "running"} />
      )}

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
