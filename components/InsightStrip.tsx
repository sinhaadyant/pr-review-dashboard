"use client";

import { ArrowDown, ArrowRight, ArrowUp, Sparkles } from "lucide-react";
import type { DeltaInsight } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

interface Props {
  insights: DeltaInsight[];
  /** Friendly label for the previous window (e.g. "vs previous 14 days"). */
  comparisonLabel?: string;
}

/**
 * Auto-phrased trend insights as a horizontal strip of mini-cards. Renders
 * nothing if `insights` is empty so it gracefully no-ops when no comparison
 * window is available.
 */
export function InsightStrip({ insights, comparisonLabel }: Props) {
  if (!insights || insights.length === 0) return null;

  return (
    <section
      aria-label="Sprint trend insights"
      className="rounded-xl border border-border bg-card p-3 stagger"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-warning" />
        Sprint insights{" "}
        {comparisonLabel && (
          <span className="ml-1 text-muted-foreground/80 normal-case font-normal">
            {comparisonLabel}
          </span>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {insights.map((i) => (
          <li
            key={i.id}
            className={cn(
              "rounded-lg border p-2.5 transition-colors hover:bg-accent/30",
              i.severity === "good"
                ? "border-success/30 bg-success/5"
                : i.severity === "bad"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-background",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {i.metric}
              </span>
              <DeltaPill insight={i} />
            </div>
            <div className="mt-1 text-sm leading-snug">{i.sentence}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeltaPill({ insight }: { insight: DeltaInsight }) {
  const Icon =
    insight.delta > 0 ? ArrowUp : insight.delta < 0 ? ArrowDown : ArrowRight;
  const tone =
    insight.severity === "good"
      ? "text-success"
      : insight.severity === "bad"
        ? "text-destructive"
        : "text-muted-foreground";
  const pct = Number.isFinite(insight.deltaPct)
    ? `${insight.delta > 0 ? "+" : ""}${Math.round(insight.deltaPct * 100)}%`
    : "—";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
        tone,
      )}
    >
      <Icon className="h-3 w-3" />
      {pct}
    </span>
  );
}
