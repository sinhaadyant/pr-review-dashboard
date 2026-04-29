"use client";

import {
  Clock,
  Hourglass,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeLatencyReport, formatHours } from "@/lib/intelligence";
import type { NormalizedPR } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const CHART_TOOLTIP = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

const ANIM_MS = 600;

const TTFR_BUCKETS: { label: string; max: number }[] = [
  { label: "<1h", max: 1 },
  { label: "1–4h", max: 4 },
  { label: "4–12h", max: 12 },
  { label: "12–24h", max: 24 },
  { label: "1–3d", max: 72 },
  { label: "3–7d", max: 168 },
  { label: "7d+", max: Infinity },
];

const TTFR_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--success))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-1))",
  "hsl(var(--warning))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
];

interface Props {
  prs: NormalizedPR[];
}

/**
 * Latency analytics: p50/p90/avg for time-to-first-review and time-to-merge,
 * plus a ranked list of slowest PRs and per-author averages. All derived
 * client-side from the existing aggregate.
 */
export function LatencyPanel({ prs }: Props) {
  const report = useMemo(() => computeLatencyReport(prs), [prs]);

  const ttfrHistogram = useMemo(() => {
    const buckets = TTFR_BUCKETS.map((b) => ({ name: b.label, count: 0 }));
    for (const p of prs) {
      const h = p.timeToFirstReviewHours;
      if (h == null) continue;
      const idx = TTFR_BUCKETS.findIndex((b) => h < b.max);
      const safeIdx = idx === -1 ? TTFR_BUCKETS.length - 1 : idx;
      buckets[safeIdx].count++;
    }
    return buckets;
  }, [prs]);

  const slowestAuthors = useMemo(
    () => report.byAuthor.filter((a) => a.count >= 2).slice(0, 6),
    [report.byAuthor],
  );

  if (report.ttfr.count === 0 && report.ttm.count === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-chart-1" />
          Review latency analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<Hourglass className="h-3.5 w-3.5" />}
            label="Avg TTFR"
            value={formatHours(report.ttfr.avg)}
            sub={`p50 ${formatHours(report.ttfr.p50)} · p90 ${formatHours(report.ttfr.p90)}`}
          />
          <Stat
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Slowest TTFR"
            value={formatHours(report.ttfr.max)}
            sub={`across ${report.ttfr.count} reviewed PR${report.ttfr.count === 1 ? "" : "s"}`}
          />
          <Stat
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Avg TTM"
            value={formatHours(report.ttm.avg)}
            sub={`p50 ${formatHours(report.ttm.p50)} · p90 ${formatHours(report.ttm.p90)}`}
          />
          <Stat
            icon={<TrendingDown className="h-3.5 w-3.5" />}
            label="Slowest TTM"
            value={formatHours(report.ttm.max)}
            sub={`across ${report.ttm.count} merged PR${report.ttm.count === 1 ? "" : "s"}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Time-to-first-review distribution">
            {report.ttfr.count === 0 ? (
              <Empty />
            ) : (
              <div className="h-44 rounded-md border border-border bg-background p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ttfrHistogram}
                    margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                      contentStyle={CHART_TOOLTIP}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      animationDuration={ANIM_MS}
                    >
                      {ttfrHistogram.map((_, i) => (
                        <Cell key={i} fill={TTFR_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="Authors waiting longest (avg TTFR)">
            {slowestAuthors.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-1.5">
                {slowestAuthors.map((row) => (
                  <li
                    key={row.login}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {row.login}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {row.count} PR{row.count === 1 ? "" : "s"}
                    </span>
                    <Badge variant="warning">{formatHours(row.avgTTFR)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Slowest first reviews">
            {report.slowestTTFR.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-1.5">
                {report.slowestTTFR.slice(0, 6).map((row) => (
                  <li
                    key={row.pr.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                  >
                    <a
                      href={row.pr.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {row.pr.fullName}#{row.pr.number}
                      </span>{" "}
                      <span className="font-medium">{row.pr.title}</span>
                    </a>
                    <Badge variant="warning">{formatHours(row.hours)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Slowest merge times">
            {report.slowestTTM.length === 0 ? (
              <Empty />
            ) : (
              <ul className="space-y-1.5">
                {report.slowestTTM.slice(0, 6).map((row) => (
                  <li
                    key={row.pr.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                  >
                    <a
                      href={row.pr.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {row.pr.fullName}#{row.pr.number}
                      </span>{" "}
                      <span className="font-medium">{row.pr.title}</span>
                    </a>
                    <Badge variant="primary">{formatHours(row.hours)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        {sub}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
      Not enough data yet.
    </div>
  );
}
