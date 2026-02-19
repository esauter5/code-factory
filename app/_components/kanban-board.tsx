"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StageDefinition } from "@/lib/harness/pipeline-templates";
import type { ProviderData, RepoConfig, RunRecord, StageOverride, StageOverrides } from "@/lib/harness/types";

import { BoardColumn } from "./board-column";
import { RunCard } from "./run-card";

export function KanbanBoard({
  stageNames,
  boardColumns,
  repos,
  onCardClick,
  stageDefinitions,
  stageOverrides,
  onOverrideChange,
  providers,
  runnerMode,
}: {
  stageNames: string[];
  boardColumns: Record<string, RunRecord[]>;
  repos: RepoConfig[];
  onCardClick: (run: RunRecord, stageName: string) => void;
  stageDefinitions: StageDefinition[];
  stageOverrides: StageOverrides;
  onOverrideChange: (stageName: string, override: StageOverride | null) => void;
  providers: ProviderData[];
  runnerMode: string;
}) {
  const [mobileTab, setMobileTab] = useState(stageNames[0] ?? "Plan");

  const colCount = stageNames.length;
  const minWidth = Math.max(colCount * 196, 600);

  function getStageDef(name: string): StageDefinition | undefined {
    return stageDefinitions.find((d) => d.name === name);
  }

  return (
    <>
      {/* Desktop: dynamic-column grid */}
      <div
        className="hidden md:grid h-full gap-2"
        style={{
          gridTemplateColumns: `repeat(${colCount}, 1fr)`,
          minWidth: `${minWidth}px`,
        }}
      >
        {stageNames.map((stageName) => {
          const def = getStageDef(stageName);
          return (
            <BoardColumn
              key={stageName}
              stageName={stageName}
              runs={boardColumns[stageName] ?? []}
              repos={repos}
              onCardClick={onCardClick}
              executionType={def?.executionType ?? "claude-prompt"}
              defaultTimeoutMs={def?.timeoutMs ?? 120_000}
              defaultTemplateOrCommand={def?.templateOrCommand ?? stageName.toLowerCase()}
              override={stageOverrides[stageName]}
              onOverrideChange={onOverrideChange}
              providers={providers}
              runnerMode={runnerMode}
            />
          );
        })}
      </div>

      {/* Mobile: tabbed single-column */}
      <div className="md:hidden h-full flex flex-col">
        <Tabs
          value={mobileTab}
          onValueChange={setMobileTab}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-1 h-10 shrink-0 overflow-x-auto flex-nowrap">
            {stageNames.map((stage) => {
              const def = getStageDef(stage);
              const ov = stageOverrides[stage];
              const effectiveProvider = ov?.provider || runnerMode;
              const isPrompt = (def?.executionType ?? "claude-prompt") === "claude-prompt";

              let chipLabel: string | null = null;
              if (isPrompt && effectiveProvider !== "mock") {
                const pd = providers.find((p) => p.id === effectiveProvider);
                const modelId = ov?.model || pd?.defaultModel;
                chipLabel = modelId ?? effectiveProvider;
                if (ov?.thinkingLevel) {
                  chipLabel += ` · ${ov.thinkingLevel}`;
                }
              }

              return (
                <TabsTrigger
                  key={stage}
                  value={stage}
                  className="text-xs gap-1 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 shrink-0"
                >
                  <span>{stage}</span>
                  {chipLabel && (
                    <span className="text-[8px] font-mono text-muted-foreground/70">{chipLabel}</span>
                  )}
                  {(boardColumns[stage]?.length ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-0.5">
                      {boardColumns[stage].length}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {stageNames.map((stage) => (
            <TabsContent
              key={stage}
              value={stage}
              className="flex-1 min-h-0 overflow-y-auto mt-0 px-1 pb-2"
            >
              {(boardColumns[stage]?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  No runs in {stage}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 pt-1.5">
                  {boardColumns[stage].map((run) => (
                    <RunCard
                      key={run.id}
                      run={run}
                      repos={repos}
                      onClick={() => onCardClick(run, stage)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}
