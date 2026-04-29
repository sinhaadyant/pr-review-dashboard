import type { NormalizedPR } from "@/lib/types";

/**
 * Splits a PR list into "current window" vs "previous window of equal length"
 * by calendar date, so trend insights can be computed without a second API
 * call. The split point is the midpoint of the date range spanned by the PRs.
 *
 * Returns the previous window only (the caller already has the full set
 * which is treated as the current window).
 */
export function splitPreviousWindow(prs: NormalizedPR[]): {
  previous: NormalizedPR[];
  current: NormalizedPR[];
  comparisonLabel: string;
} | null {
  if (prs.length < 4) return null;

  const dates = prs.map((p) => Date.parse(p.createdAt)).filter((n) => Number.isFinite(n));
  if (dates.length === 0) return null;
  const minTs = Math.min(...dates);
  const maxTs = Math.max(...dates);
  const span = maxTs - minTs;
  if (span < 24 * 60 * 60 * 1000) return null; // <1 day span — no meaningful split

  const midTs = minTs + span / 2;

  const previous: NormalizedPR[] = [];
  const current: NormalizedPR[] = [];
  for (const p of prs) {
    const t = Date.parse(p.createdAt);
    if (!Number.isFinite(t)) continue;
    if (t < midTs) previous.push(p);
    else current.push(p);
  }
  if (previous.length === 0 || current.length === 0) return null;

  const halfDays = Math.round(span / 2 / (24 * 60 * 60 * 1000));
  const comparisonLabel = `vs previous ${halfDays} day${halfDays === 1 ? "" : "s"}`;
  return { previous, current, comparisonLabel };
}
