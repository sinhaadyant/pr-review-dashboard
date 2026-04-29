"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import type { AggregatedResponse } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const TOOLTIP = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

const ANIM_MS = 600;

export function ActivityCharts({ data }: { data: AggregatedResponse }) {
  const [, setFilters] = useFilters();
  const stateData = useMemo(
    () =>
      [
        {
          name: "Merged",
          state: "merged" as const,
          value: data.stats.merged,
          color: "hsl(var(--chart-1))",
        },
        {
          name: "Open",
          state: "open" as const,
          value: data.stats.open,
          color: "hsl(var(--success))",
        },
        {
          name: "Closed",
          state: "closed" as const,
          value: data.stats.closed,
          color: "hsl(var(--muted-foreground))",
        },
      ].filter((d) => d.value > 0),
    [data.stats.merged, data.stats.open, data.stats.closed],
  );

  const dailyData = useMemo(() => {
    const buckets = new Map<
      string,
      { date: string; opened: number; merged: number; comments: number }
    >();
    const ensure = (d: string) => {
      let b = buckets.get(d);
      if (!b) {
        b = { date: d, opened: 0, merged: 0, comments: 0 };
        buckets.set(d, b);
      }
      return b;
    };
    for (const pr of data.prs) {
      ensure(pr.createdAt.slice(0, 10)).opened++;
      if (pr.mergedAt) ensure(pr.mergedAt.slice(0, 10)).merged++;
      for (const c of pr.comments) ensure(c.createdAt.slice(0, 10)).comments++;
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [data.prs]);

  const sizeVsReviewData = useMemo(() => {
    return data.prs
      .filter(
        (pr) =>
          pr.timeToFirstReviewHours != null && pr.additions + pr.deletions > 0,
      )
      .map((pr) => ({
        size: pr.additions + pr.deletions,
        ttfr: pr.timeToFirstReviewHours,
        title: pr.title,
        repo: pr.fullName,
        number: pr.number,
        state: pr.state,
      }));
  }, [data.prs]);

  const botVsHumanData = useMemo(() => {
    let botComments = 0;
    let humanComments = 0;
    let botPRs = 0;
    let humanPRs = 0;
    for (const u of data.users) {
      if (u.isBot) {
        botComments += u.commentsGiven;
        botPRs += u.prsAuthored;
      } else {
        humanComments += u.commentsGiven;
        humanPRs += u.prsAuthored;
      }
    }
    return [
      { metric: "PRs", Humans: humanPRs, Bots: botPRs },
      { metric: "Comments", Humans: humanComments, Bots: botComments },
    ];
  }, [data.users]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>PR state distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {stateData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No PRs
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {stateData.map((d, i) => (
                      <radialGradient key={i} id={`pie-grad-${i}`}>
                        <stop
                          offset="0%"
                          stopColor={d.color}
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor={d.color}
                          stopOpacity={0.7}
                        />
                      </radialGradient>
                    ))}
                  </defs>
                  <Pie
                    data={stateData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    animationDuration={ANIM_MS}
                    onClick={(d) => {
                      const slice = d as unknown as (typeof stateData)[number];
                      if (slice?.state) setFilters({ state: slice.state });
                    }}
                    cursor="pointer"
                  >
                    {stateData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={`url(#pie-grad-${i})`}
                        stroke="hsl(var(--card))"
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Activity over time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {dailyData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No activity
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient
                      id="grad-opened"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--chart-2))"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--chart-2))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="grad-merged"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="grad-comments"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--chart-4))"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--chart-4))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(d) => d.slice(5)}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={28}
                  />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    name="PRs opened"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    fill="url(#grad-opened)"
                    animationDuration={ANIM_MS}
                  />
                  <Area
                    type="monotone"
                    dataKey="merged"
                    name="PRs merged"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#grad-merged)"
                    animationDuration={ANIM_MS}
                  />
                  <Area
                    type="monotone"
                    dataKey="comments"
                    name="Comments"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    fill="url(#grad-comments)"
                    animationDuration={ANIM_MS}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>PR size vs time-to-first-review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {sizeVsReviewData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No reviewed PRs to plot. Once PRs receive a first review, they
                show up here.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    dataKey="size"
                    name="PR size (additions + deletions)"
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) =>
                      v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                    }
                    label={{
                      value: "PR size (lines changed)",
                      position: "insideBottom",
                      offset: -2,
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="ttfr"
                    name="Time to first review (h)"
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                    label={{
                      value: "TTFR (hours)",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <ZAxis range={[40, 40]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={TOOLTIP}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]
                        .payload as (typeof sizeVsReviewData)[number];
                      return (
                        <div className="rounded-md border border-border bg-card p-2 text-xs shadow-lg">
                          <div className="font-medium">
                            {p.repo}#{p.number}
                          </div>
                          <div className="mt-1 truncate text-muted-foreground max-w-xs">
                            {p.title}
                          </div>
                          <div className="mt-1.5">
                            {p.size} lines · TTFR {p.ttfr?.toFixed(1)}h ·{" "}
                            {p.state}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={sizeVsReviewData}
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.7}
                    animationDuration={ANIM_MS}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Bot vs human activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {botVsHumanData.map((row) => {
              const total = row.Humans + row.Bots;
              const humanPct = total === 0 ? 0 : (row.Humans / total) * 100;
              return (
                <div key={row.metric}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.metric}</span>
                    <span className="tabular-nums">
                      <span className="text-foreground">{row.Humans}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-muted-foreground">
                        {row.Bots} bot
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-chart-1 transition-all duration-500 ease-out"
                      style={{ width: `${humanPct}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(humanPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Human ${row.metric} share`}
                    />
                    <div
                      className="bg-chart-3 transition-all duration-500 ease-out"
                      style={{ width: `${100 - humanPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-1" />
                Humans
              </span>
              <span className="mx-3">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-3" />
                Bots
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
