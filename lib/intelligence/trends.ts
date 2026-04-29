import type { AggregatedResponse, NormalizedPR } from "@/lib/types";

/**
 * Trend intelligence — compares the current sprint window to the
 * immediately-preceding window of equal length. Produces auto-phrased
 * insights without needing an LLM.
 */

export interface DeltaInsight {
  /** Stable id so React can key on it without reordering churn. */
  id: string;
  metric: string;
  current: number;
  previous: number;
  /** Δ as a plain number (current − previous). */
  delta: number;
  /** Δ as a fraction of `previous` (or 1 if previous was 0). */
  deltaPct: number;
  /** Whether higher = better (so red/green coloring can flip if needed). */
  direction: "higher-is-better" | "lower-is-better" | "neutral";
  /** A short human-readable sentence ready to drop into the UI. */
  sentence: string;
  severity: "good" | "bad" | "neutral";
}

export interface TrendInput {
  current: AggregatedResponse;
  /** PR set from the previous window. May be undefined if not available. */
  previousPRs?: NormalizedPR[];
}

function pct(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 1;
  return (curr - prev) / prev;
}

function classify(
  delta: number,
  direction: DeltaInsight["direction"],
): DeltaInsight["severity"] {
  if (delta === 0) return "neutral";
  if (direction === "neutral") return "neutral";
  const goodIfPositive = direction === "higher-is-better";
  const positive = delta > 0;
  return positive === goodIfPositive ? "good" : "bad";
}

function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${Math.round(p * 100)}%`;
}

function summarizeWindow(prs: NormalizedPR[]) {
  let r1 = 0,
    r2 = 0,
    merged = 0,
    ttfrSum = 0,
    ttfrCount = 0;
  for (const p of prs) {
    r1 += p.R1Comments;
    r2 += p.R2Comments;
    if (p.state === "merged") merged++;
    if (p.timeToFirstReviewHours != null) {
      ttfrSum += p.timeToFirstReviewHours;
      ttfrCount++;
    }
  }
  return {
    total: prs.length,
    merged,
    r1,
    r2,
    avgTTFR: ttfrCount === 0 ? 0 : ttfrSum / ttfrCount,
  };
}

export function computeTrendInsights({
  current,
  previousPRs,
}: TrendInput): DeltaInsight[] {
  if (!previousPRs || previousPRs.length === 0) return [];

  const cur = summarizeWindow(current.prs);
  const prev = summarizeWindow(previousPRs);
  const out: DeltaInsight[] = [];

  // Total PRs
  {
    const delta = cur.total - prev.total;
    const dPct = pct(cur.total, prev.total);
    out.push({
      id: "total-prs",
      metric: "Total PRs",
      current: cur.total,
      previous: prev.total,
      delta,
      deltaPct: dPct,
      direction: "higher-is-better",
      sentence: `Total PRs ${cur.total} vs ${prev.total} previous window (${fmtPct(dPct)}).`,
      severity: classify(delta, "higher-is-better"),
    });
  }

  // R1 / R2 mix
  {
    const delta = cur.r1 - prev.r1;
    const dPct = pct(cur.r1, prev.r1);
    out.push({
      id: "r1-comments",
      metric: "Internal (R1) comments",
      current: cur.r1,
      previous: prev.r1,
      delta,
      deltaPct: dPct,
      direction: "higher-is-better",
      sentence:
        delta >= 0
          ? `Internal review activity is up ${fmtPct(dPct)} — team is engaged.`
          : `Internal review activity is down ${fmtPct(dPct)} — consider why R1 reviewers are quieter.`,
      severity: classify(delta, "higher-is-better"),
    });
  }
  {
    const delta = cur.r2 - prev.r2;
    const dPct = pct(cur.r2, prev.r2);
    out.push({
      id: "r2-comments",
      metric: "External (R2) comments",
      current: cur.r2,
      previous: prev.r2,
      delta,
      deltaPct: dPct,
      direction: "lower-is-better",
      sentence:
        delta > 0
          ? `External (R2) comments increased ${fmtPct(dPct)} — external dependency is growing.`
          : delta < 0
            ? `External (R2) comments decreased ${fmtPct(dPct)} — internal review is taking over.`
            : "External review volume is unchanged.",
      severity: classify(delta, "lower-is-better"),
    });
  }

  // Avg TTFR (lower is better)
  {
    const delta = cur.avgTTFR - prev.avgTTFR;
    const dPct = pct(cur.avgTTFR, prev.avgTTFR);
    out.push({
      id: "avg-ttfr",
      metric: "Avg time to first review",
      current: Math.round(cur.avgTTFR * 10) / 10,
      previous: Math.round(prev.avgTTFR * 10) / 10,
      delta: Math.round(delta * 10) / 10,
      deltaPct: dPct,
      direction: "lower-is-better",
      sentence:
        delta < 0
          ? `Reviews are faster — average first-review latency dropped by ${fmtPct(Math.abs(dPct))}.`
          : delta > 0
            ? `Reviews are slower — average first-review latency rose by ${fmtPct(dPct)}.`
            : "Review latency is unchanged.",
      severity: classify(delta, "lower-is-better"),
    });
  }

  // Merge rate
  {
    const curRate = cur.total === 0 ? 0 : cur.merged / cur.total;
    const prevRate = prev.total === 0 ? 0 : prev.merged / prev.total;
    const delta = curRate - prevRate;
    out.push({
      id: "merge-rate",
      metric: "Merge rate",
      current: Math.round(curRate * 100) / 100,
      previous: Math.round(prevRate * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      deltaPct: pct(curRate, prevRate),
      direction: "higher-is-better",
      sentence: `Merge rate ${Math.round(curRate * 100)}% vs ${Math.round(prevRate * 100)}% previously.`,
      severity: classify(delta, "higher-is-better"),
    });
  }

  return out;
}
