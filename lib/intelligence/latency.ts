import type { NormalizedPR } from "@/lib/types";

/**
 * Latency analytics — derived from PR data we already have:
 *  - timeToFirstReviewHours
 *  - timeToMergeHours
 *
 * Provides p50/p90/avg, slowest-PR list, and per-author / per-reviewer
 * breakdowns. All in pure functions; no external API calls.
 */

export interface LatencyStat {
  count: number;
  avg: number;
  p50: number;
  p90: number;
  max: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1))),
  );
  return sorted[idx];
}

function summarize(values: number[]): LatencyStat {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) {
    return { count: 0, avg: 0, p50: 0, p90: 0, max: 0 };
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    avg: round1(sum / sorted.length),
    p50: round1(percentile(sorted, 50)),
    p90: round1(percentile(sorted, 90)),
    max: round1(sorted[sorted.length - 1]),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface LatencyReport {
  ttfr: LatencyStat;
  ttm: LatencyStat;
  slowestTTFR: { pr: NormalizedPR; hours: number }[];
  slowestTTM: { pr: NormalizedPR; hours: number }[];
  byAuthor: { login: string; avgTTFR: number; count: number }[];
}

export function computeLatencyReport(prs: NormalizedPR[]): LatencyReport {
  const ttfrValues: number[] = [];
  const ttmValues: number[] = [];

  for (const p of prs) {
    if (p.timeToFirstReviewHours != null) ttfrValues.push(p.timeToFirstReviewHours);
    if (p.timeToMergeHours != null) ttmValues.push(p.timeToMergeHours);
  }

  const slowestTTFR = prs
    .filter((p) => p.timeToFirstReviewHours != null)
    .map((p) => ({ pr: p, hours: p.timeToFirstReviewHours! }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  const slowestTTM = prs
    .filter((p) => p.timeToMergeHours != null)
    .map((p) => ({ pr: p, hours: p.timeToMergeHours! }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  const authorBuckets = new Map<string, number[]>();
  for (const p of prs) {
    if (p.timeToFirstReviewHours == null) continue;
    const arr = authorBuckets.get(p.author) ?? [];
    arr.push(p.timeToFirstReviewHours);
    authorBuckets.set(p.author, arr);
  }
  const byAuthor = Array.from(authorBuckets.entries())
    .map(([login, arr]) => ({
      login,
      avgTTFR: round1(arr.reduce((a, b) => a + b, 0) / arr.length),
      count: arr.length,
    }))
    .sort((a, b) => b.avgTTFR - a.avgTTFR);

  return {
    ttfr: summarize(ttfrValues),
    ttm: summarize(ttmValues),
    slowestTTFR,
    slowestTTM,
    byAuthor,
  };
}

/**
 * Format hours as a compact label like "3.2 h", "2.4 d", "1.1 w".
 */
export function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} m`;
  if (h < 24) return `${round1(h)} h`;
  const d = h / 24;
  if (d < 14) return `${round1(d)} d`;
  return `${round1(d / 7)} w`;
}
