"use client";

import {
  Check,
  Clock,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Info,
  MessageSquare,
} from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";
import type { AggregatedResponse } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Tooltip } from "./ui/tooltip";

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
}

export function StatCards({ data, loading }: Props) {
  const tiles: Tile[] = [
    {
      label: "Total PRs",
      value: data?.stats.totalPRs,
      icon: GitPullRequest,
      tone: "chart-1",
      hint: "Pull requests created within the active sprint window across all selected repos.",
    },
    {
      label: "Merged",
      value: data?.stats.merged,
      icon: GitMerge,
      tone: "success",
      hint: "PRs whose merge_commit_sha was set during the window. Excludes closed-without-merge.",
    },
    {
      label: "Open",
      value: data?.stats.open,
      icon: GitPullRequest,
      tone: "warning",
      hint: "PRs still open at the time of aggregation. Reflects current GitHub state, not historical.",
    },
    {
      label: "R1 comments",
      value: data?.stats.R1_comments,
      icon: MessageSquare,
      tone: "chart-1",
      hint: "Comments by team members listed in data/team.json. Counts issue comments + review comments + APPROVED/CHANGES_REQUESTED reviews.",
    },
    {
      label: "R2 comments",
      value: data?.stats.R2_comments,
      icon: MessageSquare,
      tone: "chart-3",
      hint: "Comments by external reviewers (anyone NOT in the R1 team list). Excludes bots when 'Exclude bots' is on.",
    },
    {
      label: "Approvals",
      value: data?.stats.approvals,
      icon: Check,
      tone: "success",
      hint: "PR review submissions with state APPROVED. Only the most recent review per reviewer per PR counts.",
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
    },
  ];

  return (
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
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium truncate">
                {t.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {loading || data == null ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <AnimatedNumber
                    value={t.value ?? 0}
                    format={
                      t.format ?? ((n: number) => formatNumber(Math.round(n)))
                    }
                  />
                )}
              </div>
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
