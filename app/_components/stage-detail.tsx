"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clock, Copy } from "lucide-react";

import { ExternalLink } from "lucide-react";

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

// ---------------------------------------------------------------------------
// Log entry types
// ---------------------------------------------------------------------------

type LogEntry =
  | { kind: "tool"; id: string; name: string; param: string; resultPreview: string | null; resultTotalLines: number; status: "pending" | "done" | "error" }
  | { kind: "text"; preview: string }
  | { kind: "system"; label: string }
  | { kind: "result"; label: string }
  | { kind: "raw"; text: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip workspace prefix, show last 2-3 path segments. */
function shortenPath(fullPath: string): string {
  // Match worktree pattern like `-cf-<hex>/` or generic long hex dir
  const cfMatch = fullPath.match(/-cf-[0-9a-f]+\//i);
  if (cfMatch) {
    const afterCf = fullPath.slice(cfMatch.index! + cfMatch[0].length);
    return afterCf || fullPath.split("/").slice(-2).join("/");
  }
  // Fallback: last 2 segments
  const segments = fullPath.split("/").filter(Boolean);
  return segments.length <= 2 ? fullPath : segments.slice(-2).join("/");
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

/** Extract the key display parameter for a tool call. */
function getToolDisplayParam(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Read":
    case "Edit":
    case "Write":
      return typeof input.file_path === "string" ? shortenPath(input.file_path) : "";
    case "Bash":
      return typeof input.command === "string" ? truncate(input.command, 60) : "";
    case "Glob":
      return typeof input.pattern === "string" ? truncate(input.pattern, 60) : "";
    case "Grep":
      return typeof input.pattern === "string" ? truncate(input.pattern, 60) : "";
    case "Task":
      return typeof input.description === "string" ? truncate(input.description, 50) : "";
    case "WebFetch":
      return typeof input.url === "string" ? truncate(input.url, 60) : "";
    case "WebSearch":
      return typeof input.query === "string" ? truncate(input.query, 60) : "";
    default:
      return "";
  }
}

/** Extract a short preview from a tool_result content block. */
function extractResultPreview(
  content: Array<{ type?: string; text?: string }> | string | undefined,
): { preview: string; totalLines: number } {
  let raw = "";
  if (typeof content === "string") {
    raw = content;
  } else if (Array.isArray(content)) {
    const textBlock = content.find((b) => b.type === "text" && b.text);
    raw = textBlock?.text ?? "";
  }
  if (!raw) return { preview: "", totalLines: 0 };

  const lines = raw.split("\n");
  const totalLines = lines.length;
  // Strip Read tool line-number prefixes like "     1→"
  const cleaned = lines.slice(0, 3).map((l) => l.replace(/^\s*\d+[→→]\s?/, ""));
  return { preview: cleaned.join("\n"), totalLines };
}

// ---------------------------------------------------------------------------
// Log parser — correlates tool calls with results
// ---------------------------------------------------------------------------

interface StreamEvent {
  type?: string;
  subtype?: string;
  hook_name?: string;
  outcome?: string;
  model?: string;
  content?: string | Array<{ type?: string; text?: string }>;
  text?: string;
  status?: string;
  message?: {
    model?: string;
    content?: Array<{
      type?: string;
      text?: string;
      name?: string;
      id?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      content?: Array<{ type?: string; text?: string }> | string;
      is_error?: boolean;
    }>;
  };
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  item?: Record<string, unknown>;
}

function parseLogEntries(rawContent: string): LogEntry[] {
  const lines = rawContent.split("\n").filter((l) => l.trim());
  const entries: LogEntry[] = [];
  const toolMap = new Map<string, LogEntry & { kind: "tool" }>();

  for (const line of lines) {
    let event: StreamEvent;
    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      // Non-JSON line — show raw
      entries.push({ kind: "raw", text: line });
      continue;
    }

    // --- Claude / Gemini stream-json format ---
    if (event.type === "system") {
      let label = "";
      if (event.subtype === "init") {
        label = `${event.model ?? "provider"} session started`;
      } else if (event.subtype === "hook_started") {
        label = `${event.hook_name ?? "hook"} ...`;
      } else if (event.subtype === "hook_response") {
        label = `${event.hook_name ?? "hook"} ${event.outcome ?? "done"}`;
      }
      if (label) entries.push({ kind: "system", label });
      continue;
    }

    if (event.type === "result") {
      const status = event.subtype === "success" ? "completed" : "error";
      const cost = event.total_cost_usd ? ` ($${event.total_cost_usd.toFixed(3)})` : "";
      const dur = event.duration_ms ? ` ${(event.duration_ms / 1000).toFixed(1)}s` : "";
      const turns = event.num_turns ? ` ${event.num_turns} turns` : "";
      entries.push({ kind: "result", label: `${status}${dur}${turns}${cost}` });
      continue;
    }

    if (event.type === "assistant" && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === "tool_use" && block.name && block.id) {
          const param = getToolDisplayParam(block.name, (block.input ?? {}) as Record<string, unknown>);
          const entry: LogEntry & { kind: "tool" } = {
            kind: "tool",
            id: block.id,
            name: block.name,
            param,
            resultPreview: null,
            resultTotalLines: 0,
            status: "pending",
          };
          toolMap.set(block.id, entry);
          entries.push(entry);
        } else if (block.type === "text" && block.text) {
          entries.push({ kind: "text", preview: truncate(block.text, 200) });
        }
        // skip thinking blocks
      }
      continue;
    }

    if (event.type === "user" && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === "tool_result" && block.tool_use_id) {
          const parent = toolMap.get(block.tool_use_id);
          if (parent) {
            parent.status = block.is_error ? "error" : "done";
            const { preview, totalLines } = extractResultPreview(block.content);
            parent.resultPreview = preview || null;
            parent.resultTotalLines = totalLines;
          }
          // Don't push a new entry — result folds into existing tool entry
        }
      }
      continue;
    }

    // --- Codex JSONL format (newer: item envelope) ---
    if (event.item) {
      const item = event.item;
      if (item.type === "agent_message" && typeof item.text === "string") {
        entries.push({ kind: "text", preview: truncate(item.text as string, 200) });
      } else if (item.type === "command_execution" && typeof item.command === "string") {
        const cmd = item.command as string;
        const output = typeof item.aggregated_output === "string" ? (item.aggregated_output as string) : "";
        const isDone = item.status === "completed";
        const exitInfo = isDone ? ` → exit ${item.exit_code ?? "?"}` : "";
        const { preview, totalLines } = extractResultPreview(output);
        entries.push({
          kind: "tool",
          id: `codex-${entries.length}`,
          name: "Bash",
          param: truncate(cmd, 60) + exitInfo,
          resultPreview: preview || null,
          resultTotalLines: totalLines,
          status: isDone ? (item.exit_code === 0 ? "done" : "error") : "pending",
        });
      } else if (item.type === "error") {
        entries.push({
          kind: "system",
          label: `error: ${(item.message as string) || (item.text as string) || "unknown error"}`,
        });
      }
      // skip reasoning blocks
      continue;
    }

    // --- Codex JSONL format (legacy) ---
    if (event.type === "message" && typeof event.content === "string") {
      entries.push({ kind: "text", preview: truncate(event.content, 200) });
      continue;
    }
    if (event.type === "text" && event.text) {
      entries.push({ kind: "text", preview: truncate(event.text, 200) });
      continue;
    }
    if (event.type === "error") {
      const msg = (typeof event.content === "string" ? event.content : "") || event.text || "unknown error";
      entries.push({ kind: "system", label: `error: ${msg}` });
      continue;
    }

    // Unknown JSON event — skip
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Log rendering components
// ---------------------------------------------------------------------------

function ToolEntryRow({ entry }: { entry: LogEntry & { kind: "tool" } }) {
  const dot =
    entry.status === "done" ? "●"
    : entry.status === "error" ? "●"
    : "○";
  const dotClass =
    entry.status === "done" ? "text-[var(--status-done)]"
    : entry.status === "error" ? "text-[var(--status-failed)]"
    : "text-[var(--status-running)]";

  return (
    <div>
      <div>
        <span className={dotClass}>{dot}</span>{" "}
        <span className="text-green-300/90">{entry.name}</span>
        {entry.param && <span className="text-green-400/60">({entry.param})</span>}
      </div>
      {entry.resultPreview && (
        <div className="text-green-400/40 pl-3">
          <span className="text-green-400/20">⎿ </span>
          {entry.resultPreview.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <><br />{"  "}</>}
              {line}
            </span>
          ))}
          {entry.resultTotalLines > 3 && (
            <><br />{"  "}… +{entry.resultTotalLines - 3} lines</>
          )}
        </div>
      )}
    </div>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  switch (entry.kind) {
    case "tool":
      return <ToolEntryRow entry={entry} />;
    case "text":
      return <div className="text-green-400/80">{entry.preview}</div>;
    case "system":
      return <div className="text-green-400/30">{entry.label}</div>;
    case "result":
      return <div className="text-green-400/80">✓ {entry.label}</div>;
    case "raw":
      return <div className="text-green-400/60">{entry.text}</div>;
  }
}

// ---------------------------------------------------------------------------
// LiveOutput component
// ---------------------------------------------------------------------------

function LiveOutput({ runId, stageName, active }: { runId: string; stageName: string; active: boolean }) {
  const [content, setContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const entries = useMemo(() => (content ? parseLogEntries(content) : []), [content]);

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
          <div
            ref={scrollRef}
            className="flex flex-col gap-0.5 font-mono text-xs leading-snug p-3 whitespace-pre-wrap break-words"
          >
            {entries.length > 0
              ? entries.map((entry, i) => <LogEntryRow key={i} entry={entry} />)
              : active && (
                  <span className="text-xs text-green-400/60">
                    Waiting for Claude to start streaming...
                  </span>
                )}
          </div>
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

function extractPrUrl(stage: StageRun, prUrl?: string | null): string | null {
  if (prUrl) return prUrl;
  if (stage.name !== "PR" || stage.status !== "done") return null;
  const latest = stage.attempts.at(-1);
  if (!latest?.outputPreview) return null;
  const match = latest.outputPreview.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
  return match?.[0] ?? null;
}

export function StageDetail({ stage, runId, prUrl }: { stage: StageRun; runId: string; prUrl?: string | null }) {
  const [selectedAttemptIdx, setSelectedAttemptIdx] = useState<number | null>(null);
  const latest = stage.attempts.at(-1) ?? null;
  const viewing = selectedAttemptIdx !== null ? stage.attempts[selectedAttemptIdx] ?? latest : latest;
  const detectedPrUrl = extractPrUrl(stage, prUrl);

  return (
    <div className="flex flex-col gap-3 py-3">
      {/* PR URL link */}
      {detectedPrUrl && (
        <a
          href={detectedPrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border bg-primary/10 text-primary px-3 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors w-fit"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {detectedPrUrl}
        </a>
      )}

      {/* status + timing + attempt selector */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={stage.status} />
          {stage.attempts.length > 1 && (
            <select
              className="text-[10px] bg-muted rounded px-1.5 py-0.5 border text-foreground cursor-pointer"
              value={selectedAttemptIdx ?? stage.attempts.length - 1}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setSelectedAttemptIdx(idx === stage.attempts.length - 1 ? null : idx);
              }}
            >
              {stage.attempts.map((a, i) => (
                <option key={a.attempt} value={i}>
                  Attempt {a.attempt}{a.cycle ? ` (cycle ${a.cycle})` : ""}{i === stage.attempts.length - 1 ? " (latest)" : ""}
                </option>
              ))}
            </select>
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

      {/* content sections — show selected attempt's data */}
      <div className="flex flex-col gap-1.5">
        <CollapsibleSection
          title="Prompt"
          defaultOpen={false}
          text={viewing?.prompt || "(no prompt)"}
        />

        <CollapsibleSection
          title="Artifact Output"
          defaultOpen={true}
          text={viewing?.outputPreview || "(no output)"}
        />

        <CollapsibleSection
          title="Logs"
          defaultOpen={false}
          text={viewing?.logsPreview || "(no logs)"}
        />

        {(viewing?.error || stage.lastError) && (
          <CollapsibleSection
            title="Error"
            defaultOpen={true}
            text={viewing?.error || stage.lastError || "(none)"}
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
              {stage.attempts.map((attempt, idx) => (
                <button
                  type="button"
                  key={attempt.attempt}
                  className={cn(
                    "rounded-md border p-3 text-xs text-left transition-colors",
                    (selectedAttemptIdx === null ? attempt === latest : idx === selectedAttemptIdx)
                      ? "border-primary/30 bg-muted/50"
                      : "border-border hover:bg-muted/30",
                  )}
                  onClick={() => setSelectedAttemptIdx(idx === stage.attempts.length - 1 ? null : idx)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        Attempt {attempt.attempt}
                      </span>
                      {attempt.cycle && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          cycle {attempt.cycle}
                        </Badge>
                      )}
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
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
