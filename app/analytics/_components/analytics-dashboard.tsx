"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useAnalytics, type RecentFailure, type StageMetrics } from "./use-analytics";

function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = Math.round(seconds % 60);
  return `${minutes}m ${remainingSec}s`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "--";
  return `${(value * 100).toFixed(1)}%`;
}

function SummaryCards({
  totalRuns,
  successRate,
  avgDurationMs,
  activeRuns,
}: {
  totalRuns: number;
  successRate: number | null;
  avgDurationMs: number | null;
  activeRuns: number;
}) {
  const cards = [
    { label: "Total Runs", value: String(totalRuns) },
    { label: "Success Rate", value: formatPercent(successRate) },
    { label: "Avg Duration", value: formatDuration(avgDurationMs) },
    { label: "Active Runs", value: String(activeRuns) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="py-4">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StageBreakdownTable({ stages }: { stages: StageMetrics[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Stage Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Stage</th>
                <th className="text-right py-2 px-3 font-medium">Runs</th>
                <th className="text-right py-2 px-3 font-medium">Success</th>
                <th className="text-right py-2 px-3 font-medium">Failed</th>
                <th className="text-right py-2 px-3 font-medium">Skipped</th>
                <th className="text-right py-2 pl-3 font-medium">Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.name} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{stage.name}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{stage.total}</td>
                  <td className="text-right py-2 px-3 tabular-nums text-[var(--status-done)]">{stage.success}</td>
                  <td className="text-right py-2 px-3 tabular-nums text-[var(--status-failed)]">{stage.failed}</td>
                  <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">{stage.skipped}</td>
                  <td className="text-right py-2 pl-3 tabular-nums">{formatDuration(stage.avgDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentFailuresList({ failures }: { failures: RecentFailure[] }) {
  if (failures.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Failures</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No failures recorded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Recent Failures</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {failures.map((failure, idx) => (
          <div key={`${failure.runId}-${failure.stage}-${idx}`} className="flex flex-col gap-1 rounded-md border p-2.5">
            <div className="flex items-center gap-2">
              <Link href={`/?run=${failure.runId}`} className="font-mono text-[11px] text-primary hover:underline">
                {failure.runId.slice(0, 8)}
              </Link>
              <Badge variant="secondary" className="bg-[var(--status-failed-soft)] text-[var(--status-failed)] hover:bg-[var(--status-failed-soft)] text-[10px]">
                {failure.stage}
              </Badge>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {new Date(failure.failedAt).toLocaleString()}
              </span>
            </div>
            {failure.ticket && (
              <p className="text-[11px] text-muted-foreground truncate">{failure.ticket}</p>
            )}
            {failure.error && (
              <p className="text-[11px] text-destructive/80 font-mono truncate">{failure.error}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const { data, loading, error } = useAnalytics();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 items-center border-b bg-card px-3 md:px-4 shrink-0 gap-3">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
          <Link href="/">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Board</span>
          </Link>
        </Button>
        <h1 className="text-sm font-bold tracking-tight">Analytics</h1>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-4 max-w-5xl mx-auto w-full">
        {error && (
          <div className="bg-destructive/10 px-4 py-1.5 text-xs text-destructive rounded-md">
            {error}
          </div>
        )}

        {loading && !data && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading analytics...</p>
        )}

        {data && (
          <>
            <SummaryCards
              totalRuns={data.totalRuns}
              successRate={data.successRate}
              avgDurationMs={data.avgDurationMs}
              activeRuns={data.runsByStatus.running}
            />
            <StageBreakdownTable stages={data.stages} />
            <RecentFailuresList failures={data.recentFailures} />
          </>
        )}

        {!loading && data && data.totalRuns === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No runs yet. Create a run from the board to see analytics.
          </p>
        )}
      </main>
    </div>
  );
}
