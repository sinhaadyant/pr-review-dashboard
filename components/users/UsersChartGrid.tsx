"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UserStats } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Props {
  users: UserStats[];
}

const TOP_N = 12;

export function UsersChartGrid({ users }: Props) {
  const top = [...users]
    .filter((u) => !u.isBot)
    .sort((a, b) => b.commentsGiven - a.commentsGiven)
    .slice(0, TOP_N)
    .map((u) => ({
      name: u.login,
      R1: u.R1_commentsGiven,
      R2: u.R2_commentsGiven,
    }))
    .reverse();

  const reviewOutcomes = [...users]
    .filter((u) => u.approvalsGiven + u.changesRequestedGiven > 0)
    .sort(
      (a, b) =>
        b.approvalsGiven +
        b.changesRequestedGiven -
        (a.approvalsGiven + a.changesRequestedGiven),
    )
    .slice(0, TOP_N)
    .map((u) => ({
      name: u.login,
      Approved: u.approvalsGiven,
      "Changes requested": u.changesRequestedGiven,
    }))
    .reverse();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Top contributors — comments by reviewer type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid
                  horizontal={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="R1"
                  stackId="a"
                  fill="hsl(var(--chart-1))"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="R2"
                  stackId="a"
                  fill="hsl(var(--chart-3))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Review outcomes per user</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {reviewOutcomes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No review submissions in this window
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reviewOutcomes}
                  layout="vertical"
                  margin={{ left: 10 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="Approved"
                    stackId="a"
                    fill="hsl(var(--success))"
                  >
                    {reviewOutcomes.map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="Changes requested"
                    stackId="a"
                    fill="hsl(var(--warning))"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
