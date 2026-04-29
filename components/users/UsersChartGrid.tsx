"use client";

import { useMemo } from "react";
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
import { useFilters } from "@/hooks/use-filters";
import type { UserStats, NormalizedPR } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Props {
  users: UserStats[];
  prs?: NormalizedPR[];
}

const TOP_N = 12;
const ANIM_MS = 600;

const TOOLTIP = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

export function UsersChartGrid({ users, prs = [] }: Props) {
  const [, setFilters] = useFilters();
  const top = useMemo(
    () =>
      [...users]
        .filter((u) => !u.isBot)
        .sort((a, b) => b.commentsGiven - a.commentsGiven)
        .slice(0, TOP_N)
        .map((u) => ({
          name: u.login,
          R1: u.R1_commentsGiven,
          R2: u.R2_commentsGiven,
        }))
        .reverse(),
    [users],
  );

  const reviewOutcomes = useMemo(
    () =>
      [...users]
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
        .reverse(),
    [users],
  );

  const onSelectUser = (login: string) => {
    if (!login) return;
    setFilters({ users: [login] });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle title="Click a row to scope the dashboard to that user">
            Top contributors — comments by reviewer type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top}
                layout="vertical"
                margin={{ left: 10 }}
                onClick={(state) => {
                  const label = (state as { activeLabel?: string }).activeLabel;
                  if (label) onSelectUser(label);
                }}
              >
                <defs>
                  <linearGradient id="bar-r1" x1="0" x2="1" y1="0" y2="0">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.85}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={1}
                    />
                  </linearGradient>
                  <linearGradient id="bar-r2" x1="0" x2="1" y1="0" y2="0">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-3))"
                      stopOpacity={0.85}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-3))"
                      stopOpacity={1}
                    />
                  </linearGradient>
                </defs>
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
                  contentStyle={TOOLTIP}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="R1"
                  stackId="a"
                  fill="url(#bar-r1)"
                  animationDuration={ANIM_MS}
                />
                <Bar
                  dataKey="R2"
                  stackId="a"
                  fill="url(#bar-r2)"
                  radius={[0, 4, 4, 0]}
                  animationDuration={ANIM_MS}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle title="Click a row to scope the dashboard to that user">
            Review outcomes per user
          </CardTitle>
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
                  onClick={(state) => {
                    const label = (state as { activeLabel?: string })
                      .activeLabel;
                    if (label) onSelectUser(label);
                  }}
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
                    contentStyle={TOOLTIP}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="Approved"
                    stackId="a"
                    fill="hsl(var(--success))"
                    animationDuration={ANIM_MS}
                  >
                    {reviewOutcomes.map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="Changes requested"
                    stackId="a"
                    fill="hsl(var(--warning))"
                    radius={[0, 4, 4, 0]}
                    animationDuration={ANIM_MS}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {prs.length > 0 && (
        <Card className="lg:col-span-2">
          <ReviewerLoadHeatmap users={users} prs={prs} />
        </Card>
      )}
    </div>
  );
}

/**
 * Reviewer × repo heatmap. Each cell color intensity = number of comments
 * the reviewer left on PRs in that repo. Surfaces over-loaded reviewers and
 * single-reviewer bus factors.
 */
function ReviewerLoadHeatmap({
  users,
  prs,
}: {
  users: UserStats[];
  prs: NormalizedPR[];
}) {
  const { reviewers, repos, matrix, max } = useMemo(() => {
    // count = comments per (reviewer, repo)
    const counts = new Map<string, Map<string, number>>();
    for (const pr of prs) {
      for (const c of pr.comments) {
        if (c.author.toLowerCase() === pr.author.toLowerCase()) continue;
        const inner = counts.get(c.author) ?? new Map<string, number>();
        inner.set(pr.fullName, (inner.get(pr.fullName) ?? 0) + 1);
        counts.set(c.author, inner);
      }
    }
    const reviewerTotals = new Map<string, number>();
    for (const [reviewer, inner] of counts) {
      let total = 0;
      for (const v of inner.values()) total += v;
      reviewerTotals.set(reviewer, total);
    }
    const reviewers = [...reviewerTotals.entries()]
      .filter(([login]) => {
        const u = users.find((x) => x.login === login);
        return !u?.isBot;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([login]) => login);

    const repoTotals = new Map<string, number>();
    for (const pr of prs) {
      const cnt = pr.comments.length;
      repoTotals.set(pr.fullName, (repoTotals.get(pr.fullName) ?? 0) + cnt);
    }
    const repos = [...repoTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([fullName]) => fullName);

    const matrix: number[][] = reviewers.map((rev) =>
      repos.map((repo) => counts.get(rev)?.get(repo) ?? 0),
    );
    const max = Math.max(0, ...matrix.flat());
    return { reviewers, repos, matrix, max };
  }, [prs, users]);

  if (reviewers.length === 0 || repos.length === 0) return null;

  return (
    <>
      <CardHeader>
        <CardTitle>Reviewer load heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card text-left font-medium text-muted-foreground" />
                {repos.map((r) => (
                  <th
                    key={r}
                    className="px-1 pb-2 text-left font-normal text-muted-foreground"
                    title={r}
                  >
                    <div className="max-w-[8ch] truncate">
                      {r.split("/")[1] ?? r}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviewers.map((rev, i) => (
                <tr key={rev}>
                  <th className="sticky left-0 z-10 bg-card pr-2 text-left font-medium">
                    <div className="max-w-[14ch] truncate">{rev}</div>
                  </th>
                  {repos.map((repo, j) => {
                    const v = matrix[i][j];
                    const opacity = max === 0 ? 0 : v / max;
                    return (
                      <td
                        key={repo}
                        title={`${rev} → ${repo}: ${v} comment${v === 1 ? "" : "s"}`}
                        className="rounded text-center transition-colors"
                        style={{
                          background: `hsl(var(--chart-1) / ${0.05 + opacity * 0.85})`,
                          color:
                            opacity > 0.5 ? "white" : "hsl(var(--foreground))",
                          minWidth: 36,
                          height: 28,
                        }}
                      >
                        {v > 0 ? v : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex h-2 w-32 overflow-hidden rounded-full">
              {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((t, i) => (
                <div
                  key={i}
                  className="h-full flex-1"
                  style={{ background: `hsl(var(--chart-1) / ${t})` }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </>
  );
}
