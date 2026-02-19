"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RepoConfig, RunRecord, StageName } from "@/lib/harness/types";
import { STAGE_ORDER } from "@/lib/harness/types";

import { BoardColumn } from "./board-column";
import { RunCard } from "./run-card";

export function KanbanBoard({
  boardColumns,
  repos,
  onCardClick,
}: {
  boardColumns: Record<StageName, RunRecord[]>;
  repos: RepoConfig[];
  onCardClick: (run: RunRecord, stageName: StageName) => void;
}) {
  const [mobileTab, setMobileTab] = useState<StageName>("Plan");

  return (
    <>
      {/* Desktop: 5-column grid */}
      <div className="hidden md:grid h-full min-w-[980px] grid-cols-5 gap-2">
        {STAGE_ORDER.map((stageName) => (
          <BoardColumn
            key={stageName}
            stageName={stageName}
            runs={boardColumns[stageName]}
            repos={repos}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      {/* Mobile: tabbed single-column */}
      <div className="md:hidden h-full flex flex-col">
        <Tabs
          value={mobileTab}
          onValueChange={(v) => setMobileTab(v as StageName)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-1 h-10 shrink-0 overflow-x-auto flex-nowrap">
            {STAGE_ORDER.map((stage) => (
              <TabsTrigger
                key={stage}
                value={stage}
                className="text-xs gap-1 data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-2 shrink-0"
              >
                {stage}
                {boardColumns[stage].length > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-0.5">
                    {boardColumns[stage].length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {STAGE_ORDER.map((stage) => (
            <TabsContent
              key={stage}
              value={stage}
              className="flex-1 min-h-0 overflow-y-auto mt-0 px-1 pb-2"
            >
              {boardColumns[stage].length === 0 ? (
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
