"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProviderData, RepoConfig, RunRecord, StageOverride } from "@/lib/harness/types";

import { RunCard } from "./run-card";
import { StageSettingsPopover } from "./stage-settings-popover";

export function BoardColumn({
  stageName,
  runs,
  repos,
  onCardClick,
  executionType,
  defaultTimeoutMs,
  defaultTemplateOrCommand,
  override,
  onOverrideChange,
  providers,
  runnerMode,
}: {
  stageName: string;
  runs: RunRecord[];
  repos: RepoConfig[];
  onCardClick: (run: RunRecord, stageName: string) => void;
  executionType: "claude-prompt" | "shell-command";
  defaultTimeoutMs: number;
  defaultTemplateOrCommand: string;
  override: StageOverride | undefined;
  onOverrideChange: (stageName: string, override: StageOverride | null) => void;
  providers: ProviderData[];
  runnerMode: string;
}) {
  // Resolve the effective provider/model for display
  const effectiveProvider = override?.provider || runnerMode;

  let resolvedLabel: string | null = null;
  if (executionType === "claude-prompt" && effectiveProvider !== "mock") {
    const providerData = providers.find((p) => p.id === effectiveProvider);
    const effectiveModelId = override?.model || providerData?.defaultModel;
    // Use the model ID directly — it's what the CLI receives and won't go stale
    const modelDisplay = effectiveModelId ?? effectiveProvider;

    resolvedLabel = modelDisplay;
    if (override?.thinkingLevel) {
      resolvedLabel += ` · ${override.thinkingLevel}`;
    }
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            {stageName}
          </h3>
          <StageSettingsPopover
            stageName={stageName}
            executionType={executionType}
            defaultTimeoutMs={defaultTimeoutMs}
            defaultTemplateOrCommand={defaultTemplateOrCommand}
            override={override}
            onOverrideChange={onOverrideChange}
            providers={providers}
          />
          {resolvedLabel && (
            <span className="text-[10px] font-mono text-muted-foreground/60 truncate" title={resolvedLabel}>
              {resolvedLabel}
            </span>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono shrink-0">
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
