"use client";

import type { RunRecord, StageName } from "@/lib/harness/types";
import { STAGE_ORDER } from "@/lib/harness/types";

import { BoardColumn } from "./board-column";

export function KanbanBoard({
  boardColumns,
  onCardClick,
}: {
  boardColumns: Record<StageName, RunRecord[]>;
  onCardClick: (run: RunRecord, stageName: StageName) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 h-full">
      {STAGE_ORDER.map((stageName) => (
        <BoardColumn
          key={stageName}
          stageName={stageName}
          runs={boardColumns[stageName]}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}
