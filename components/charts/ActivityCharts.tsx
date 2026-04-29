"use client";

import { useMemo } from "react";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AggregatedResponse } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const TOOLTIP = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export function ActivityCharts({ data }: { data: AggregatedResponse }) {
  const stateData = [
    { name: "Merged", value: data.stats.merged, color: "hsl(var(--chart-1))" },
    { name: "Open", value: data.stats.open, color: "hsl(var(--success))" },
    {
      name: "Closed",
      value: data.stats.closed,
      color: "hsl(var(--muted-foreground))",
    },
  ].filter((d) => d.value > 0);

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
                  <Pie
                    data={stateData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {stateData.map((d, i) => (
                      <Cell key={i} fill={d.color} stroke="hsl(var(--card))" />
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
          <CardTitle>Activity over time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {dailyData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No activity
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
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
                  <Line
                    type="monotone"
                    dataKey="opened"
                    name="PRs opened"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="merged"
                    name="PRs merged"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="comments"
                    name="Comments"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
