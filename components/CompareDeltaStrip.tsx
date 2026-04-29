"use client";

import { ArrowDown, ArrowRight, ArrowUp, GitCompare, Minus, X } from "lucide-react";
import type { AggregatedResponse } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

interface DeltaProps {
  current: AggregatedResponse;
  compare: AggregatedResponse;
  compareSprintId: string;
  compareLabel: string;
  onClear: () => void;
  isFetching?: boolean;
}

interface MetricRow {
  label: string;
  cur: number;
  prev: number;
  format?: (n: number) => string;
  /** When true, a DROP is good (e.g., time-to-first-review). */
  inverse?: boolean;
}

/**
 * Side-by-side delta strip rendered above the main content when the user
 * picks a comparison sprint. Shows per-metric current → previous, percentage
 * change, and an up/down chip colored by whether the change is good or bad.
 */
export function CompareDeltaStrip({
  current,
  compare,
  compareLabel,
  onClear,
  isFetching,
}: DeltaProps) {
  const metrics: MetricRow[] = [
    { label: "Total PRs", cur: current.stats.totalPRs, prev: compare.stats.totalPRs },
    { label: "Merged", cur: current.stats.merged, prev: compare.stats.merged },
    {
      label: "R1 comments",
      cur: current.stats.R1_comments,
      prev: compare.stats.R1_comments,
    },
    {
      label: "R2 comments",
      cur: current.stats.R2_comments,
      prev: compare.stats.R2_comments,
    },
    {
      label: "Approvals",
      cur: current.stats.approvals,
      prev: compare.stats.approvals,
    },
    {
      label: "Avg TTFR (h)",
      cur: current.stats.avg_time_to_first_review_hours,
      prev: compare.stats.avg_time_to_first_review_hours,
      format: (n: number) => (n > 0 ? n.toFixed(1) : "—"),
      inverse: true,
    },
  ];

  return (
    <Card className="border-primary/20 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <GitCompare className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Sprint comparison</div>
            <div className="text-xs text-muted-foreground">
              Comparing current view against{" "}
              <span className="font-medium">{compareLabel}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Clear comparison"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {metrics.map((m) => (
          <DeltaTile key={m.label} m={m} loading={isFetching} />
        ))}
      </div>
    </Card>
  );
}

function DeltaTile({ m, loading }: { m: MetricRow; loading?: boolean }) {
  const fmt = m.format ?? ((n: number) => formatNumber(Math.round(n)));
  const diff = m.cur - m.prev;
  const denom = m.prev || 0;
  const pct = denom === 0 ? (m.cur === 0 ? 0 : 100) : (diff / Math.abs(denom)) * 100;
  const isFlat = Math.abs(diff) < 1e-6 || (denom === 0 && m.cur === 0);
  const isUp = !isFlat && diff > 0;
  // For inverse metrics (TTFR), a DROP is good.
  const good = m.inverse ? !isUp : isUp;
  const tone = isFlat
    ? "text-muted-foreground bg-muted/30 border-border"
    : good
      ? "text-success bg-success/10 border-success/30"
      : "text-destructive bg-destructive/10 border-destructive/30";

  const Icon = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-background/50 p-2.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-1.5 h-6 w-24" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background/50 p-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {m.label}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-sm tabular-nums">
        <span className="font-semibold">{fmt(m.cur)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">{fmt(m.prev)}</span>
      </div>
      <div
        className={cn(
          "mt-1 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
          tone,
        )}
      >
        <Icon className="h-3 w-3" />
        {isFlat ? "no change" : `${Math.abs(pct).toFixed(0)}%`}
      </div>
    </div>
  );
}
