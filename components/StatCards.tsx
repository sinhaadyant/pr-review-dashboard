"use client";

import {
  Check,
  Clock,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Info,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { useCountUp } from "@/hooks/use-count-up";
import { useNumberAnimMode, type NumberAnimMode } from "@/hooks/use-number-anim";
import type { AggregatedResponse } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Sparkline } from "./Sparkline";
import { Tooltip } from "./ui/tooltip";
import { FlipNumber } from "./FlipNumber";

interface Props {
  data?: AggregatedResponse;
  loading?: boolean;
}

interface Tile {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  format?: (n: number) => string;
  hint: string;
  /** 30-day daily series for the in-tile sparkline. */
  spark?: number[];
}

const SPARK_DAYS = 30;

function computeSparkSeries(data: AggregatedResponse | undefined) {
  const empty = new Array(SPARK_DAYS).fill(0);
  if (!data) {
    return {
      total: empty,
      merged: empty,
      open: empty,
      r1: empty,
      r2: empty,
      approvals: empty,
      closed: empty,
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayKeys: string[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const idxOf = new Map(dayKeys.map((k, i) => [k, i]));
  const total = new Array(SPARK_DAYS).fill(0);
  const merged = new Array(SPARK_DAYS).fill(0);
  const open = new Array(SPARK_DAYS).fill(0);
  const closed = new Array(SPARK_DAYS).fill(0);
  const r1 = new Array(SPARK_DAYS).fill(0);
  const r2 = new Array(SPARK_DAYS).fill(0);
  const approvals = new Array(SPARK_DAYS).fill(0);

  for (const pr of data.prs) {
    const i = idxOf.get(pr.createdAt.slice(0, 10));
    if (i != null) {
      total[i]++;
      if (pr.state === "open") open[i]++;
      else if (pr.state === "closed") closed[i]++;
    }
    if (pr.mergedAt) {
      const mi = idxOf.get(pr.mergedAt.slice(0, 10));
      if (mi != null) merged[mi]++;
    }
    for (const c of pr.comments) {
      const ci = idxOf.get(c.createdAt.slice(0, 10));
      if (ci == null) continue;
      if (c.reviewerType === "R1") r1[ci]++;
      else r2[ci]++;
      if (c.reviewState === "APPROVED") approvals[ci]++;
    }
  }
  return { total, merged, open, r1, r2, approvals, closed };
}

export function StatCards({ data, loading }: Props) {
  const sparks = useMemo(() => computeSparkSeries(data), [data]);
  const [animMode, setAnimMode] = useNumberAnimMode();

  const tiles: Tile[] = [
    {
      label: "Total PRs",
      value: data?.stats.totalPRs,
      icon: GitPullRequest,
      tone: "chart-1",
      hint: "Pull requests created within the active sprint window across all selected repos.",
      spark: sparks.total,
    },
    {
      label: "Merged",
      value: data?.stats.merged,
      icon: GitMerge,
      tone: "success",
      hint: "PRs whose merge_commit_sha was set during the window. Excludes closed-without-merge.",
      spark: sparks.merged,
    },
    {
      label: "Open",
      value: data?.stats.open,
      icon: GitPullRequest,
      tone: "warning",
      hint: "PRs still open at the time of aggregation. Reflects current GitHub state, not historical.",
      spark: sparks.open,
    },
    {
      label: "R1 comments",
      value: data?.stats.R1_comments,
      icon: MessageSquare,
      tone: "chart-1",
      hint: "Comments by team members listed in data/team.json. Counts issue comments + review comments + APPROVED/CHANGES_REQUESTED reviews.",
      spark: sparks.r1,
    },
    {
      label: "R2 comments",
      value: data?.stats.R2_comments,
      icon: MessageSquare,
      tone: "chart-3",
      hint: "Comments by external reviewers (anyone NOT in the R1 team list). Excludes bots when 'Exclude bots' is on.",
      spark: sparks.r2,
    },
    {
      label: "Approvals",
      value: data?.stats.approvals,
      icon: Check,
      tone: "success",
      hint: "PR review submissions with state APPROVED. Only the most recent review per reviewer per PR counts.",
      spark: sparks.approvals,
    },
    {
      label: "Avg time-to-first-review",
      value: data?.stats.avg_time_to_first_review_hours,
      icon: Clock,
      tone: "chart-2",
      format: (n: number) => (n > 0 ? `${n.toFixed(1)} h` : "—"),
      hint: "Mean of (first non-author review timestamp – PR created_at) in hours, across PRs that received at least one review.",
    },
    {
      label: "Closed (not merged)",
      value: data?.stats.closed,
      icon: GitPullRequestClosed,
      tone: "muted",
      hint: "PRs closed without merge. Often signals abandoned or rejected work.",
      spark: sparks.closed,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <NumberAnimToggle value={animMode} onChange={setAnimMode} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger">
        {tiles.map((t) => (
        <Card
          key={t.label}
          className="group relative p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-[hsl(var(--chart-1)/0.3)]"
        >
          <Tooltip content={t.hint}>
            <button
              type="button"
              className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`How is "${t.label}" computed?`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground font-medium truncate">
                {t.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {loading || data == null ? (
                  <Skeleton className="h-8 w-16" />
                ) : animMode === "flip" && t.format == null ? (
                  // FlipNumber works best with integer values; fall back to
                  // the tween for fractional metrics like "Avg TTFR".
                  <FlipNumber
                    value={t.value ?? 0}
                    format={(n: number) => formatNumber(Math.round(n))}
                  />
                ) : (
                  <AnimatedNumber
                    value={t.value ?? 0}
                    format={
                      t.format ?? ((n: number) => formatNumber(Math.round(n)))
                    }
                  />
                )}
              </div>
              {t.spark && t.spark.some((v) => v > 0) && (
                <div className="mt-1.5">
                  <Sparkline
                    values={t.spark}
                    width={120}
                    height={20}
                    color={`hsl(var(--${t.tone}))`}
                    ariaLabel={`${t.label} 30-day trend`}
                  />
                </div>
              )}
            </div>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-110"
              style={{
                background: `hsl(var(--${t.tone}) / 0.12)`,
                color: `hsl(var(--${t.tone}))`,
              }}
            >
              <t.icon className="h-4 w-4" />
            </div>
          </div>
        </Card>
        ))}
      </div>
    </div>
  );
}

function NumberAnimToggle({
  value,
  onChange,
}: {
  value: NumberAnimMode;
  onChange: (m: NumberAnimMode) => void;
}) {
  const opts: { id: NumberAnimMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "tween", label: "Tween", icon: TrendingUp },
    { id: "flip", label: "Flip", icon: Sparkles },
  ];
  return (
    <Tooltip content="Switch number animation. Tween = ease-out count-up, Flip = per-digit shuffle. Saved to localStorage.">
      <div
        role="radiogroup"
        aria-label="Number animation mode"
        className="inline-flex h-6 items-center rounded-full border border-border bg-muted/40 p-0.5 text-[11px]"
      >
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 h-5 transition-colors",
              value === o.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="h-3 w-3" />
            {o.label}
          </button>
        ))}
      </div>
    </Tooltip>
  );
}

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const display = useCountUp(value, 600);
  return <span>{format(display)}</span>;
}
