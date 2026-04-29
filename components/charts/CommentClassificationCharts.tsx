"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MessageSquare } from "lucide-react";
import { summarizeConcerns, summarizeKinds } from "@/lib/intelligence";
import type { NormalizedPR } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const TOOLTIP = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

const ANIM_MS = 600;

interface Props {
  prs: NormalizedPR[];
}

/**
 * Aggregate comment classification across all PRs in the current window.
 *
 *  - "Concern" donut splits human comments into functional / cosmetic / other
 *    — answers "are reviewers catching real issues or polishing style?"
 *  - "Kind" bar shows the conventional-comment style breakdown (issue,
 *    suggestion, question, nit, todo, note, praise, approval).
 *
 * Bots are excluded so noisy automated reviewers don't dominate the picture.
 */
export function CommentClassificationCharts({ prs }: Props) {
  const allComments = useMemo(
    () => prs.flatMap((p) => p.comments.filter((c) => !c.isBot)),
    [prs],
  );

  const concernData = useMemo(() => {
    const c = summarizeConcerns(allComments);
    return [
      {
        name: "Functional",
        value: c.functional,
        color: "hsl(var(--destructive))",
      },
      { name: "Cosmetic", value: c.cosmetic, color: "hsl(var(--chart-1))" },
      { name: "Other", value: c.other, color: "hsl(var(--muted-foreground))" },
    ].filter((d) => d.value > 0);
  }, [allComments]);

  const kindData = useMemo(() => {
    const k = summarizeKinds(allComments);
    return [
      { name: "Issue", value: k.issue, color: "hsl(var(--destructive))" },
      { name: "Suggestion", value: k.suggestion, color: "hsl(var(--chart-1))" },
      { name: "Question", value: k.question, color: "hsl(var(--chart-2))" },
      { name: "Nit", value: k.nitpick, color: "hsl(var(--muted-foreground))" },
      { name: "TODO", value: k.todo, color: "hsl(var(--warning))" },
      { name: "Note", value: k.note, color: "hsl(var(--chart-4))" },
      { name: "Praise", value: k.praise, color: "hsl(var(--success))" },
      { name: "Approval", value: k.approval, color: "hsl(var(--success))" },
    ]
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [allComments]);

  const total = allComments.length;
  const functionalShare =
    total === 0
      ? 0
      : (concernData.find((d) => d.name === "Functional")?.value ?? 0) / total;

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Comment classification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No human review comments in this window.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle
            className="flex items-center gap-1.5"
            title="Functional concerns flag behavior, correctness, performance, security. Cosmetic concerns flag style, formatting, naming, typos."
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Comment focus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={concernData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                  animationDuration={ANIM_MS}
                >
                  {concernData.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="hsl(var(--card))" />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            <span className="text-destructive font-semibold tabular-nums">
              {Math.round(functionalShare * 100)}%
            </span>{" "}
            of {total} comment{total === 1 ? "" : "s"} flag functional concerns
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle title="Conventional-comments style breakdown across all PRs in the current window">
            Comment kinds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kindData} layout="vertical" margin={{ left: 8 }}>
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
                  width={80}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                  contentStyle={TOOLTIP}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  animationDuration={ANIM_MS}
                >
                  {kindData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
