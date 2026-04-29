"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { Footer } from "@/components/Footer";
import { PRList } from "@/components/pr/PRList";
import { Sparkline } from "@/components/Sparkline";
import { TopBar } from "@/components/TopBar";
import { TopProgressBar } from "@/components/TopProgressBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, EmptyState } from "@/components/states/States";
import { Skeleton } from "@/components/ui/skeleton";
import { useAggregate } from "@/hooks/use-aggregate";
import { useFilters } from "@/hooks/use-filters";
import {
  computeBestReviewers,
  computeDevInsights,
  computeUserHealth,
  HEALTH_LABEL,
  summarizeConcerns,
} from "@/lib/intelligence";
import { CheckCircle2, TriangleAlert, Star } from "lucide-react";
import { formatNumber } from "@/lib/utils";

const ANIM_MS = 600;
const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

export default function UserPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const [filters] = useFilters();
  const { data, isLoading, error, isFetching } = useAggregate(filters);

  const user = useMemo(
    () =>
      data?.users.find((u) => u.login.toLowerCase() === username.toLowerCase()),
    [data, username],
  );
  const userPRs = useMemo(
    () =>
      data?.prs.filter(
        (p) => p.author.toLowerCase() === username.toLowerCase(),
      ) ?? [],
    [data, username],
  );
  const userComments = useMemo(
    () =>
      data?.prs.filter((p) =>
        p.comments.some(
          (c) => c.author.toLowerCase() === username.toLowerCase(),
        ),
      ) ?? [],
    [data, username],
  );

  // 30-day activity buckets
  const { sparkPRs, sparkComments } = useMemo(() => {
    const days = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const sparkPRs = new Array(days).fill(0);
    const sparkComments = new Array(days).fill(0);
    if (data) {
      for (const p of data.prs) {
        if (p.author.toLowerCase() === username.toLowerCase()) {
          const idx = dayKeys.indexOf(p.createdAt.slice(0, 10));
          if (idx >= 0) sparkPRs[idx]++;
        }
        for (const c of p.comments) {
          if (c.author.toLowerCase() !== username.toLowerCase()) continue;
          const idx = dayKeys.indexOf(c.createdAt.slice(0, 10));
          if (idx >= 0) sparkComments[idx]++;
        }
      }
    }
    return { sparkPRs, sparkComments };
  }, [data, username]);

  const r1r2Pie = useMemo(() => {
    if (!user) return [];
    return [
      {
        name: "R1 comments",
        value: user.R1_commentsGiven,
        color: "hsl(var(--chart-1))",
      },
      {
        name: "R2 comments",
        value: user.R2_commentsGiven,
        color: "hsl(var(--chart-3))",
      },
    ].filter((d) => d.value > 0);
  }, [user]);

  const concernPie = useMemo(() => {
    if (!user || !data) return [];
    const givenComments = data.prs.flatMap((p) =>
      p.comments.filter(
        (c) => c.author.toLowerCase() === username.toLowerCase() && !c.isBot,
      ),
    );
    const counts = summarizeConcerns(givenComments);
    return [
      {
        name: "Functional",
        value: counts.functional,
        color: "hsl(var(--destructive))",
      },
      {
        name: "Cosmetic",
        value: counts.cosmetic,
        color: "hsl(var(--chart-1))",
      },
      {
        name: "Other",
        value: counts.other,
        color: "hsl(var(--muted-foreground))",
      },
    ].filter((d) => d.value > 0);
  }, [user, data, username]);

  const insights = useMemo(
    () => (user ? computeDevInsights(user, data?.prs ?? []) : null),
    [user, data?.prs],
  );
  const userHealth = useMemo(
    () => (user ? computeUserHealth(user, data?.prs ?? []) : null),
    [user, data?.prs],
  );
  const bestReviewerRank = useMemo(() => {
    if (!user || !data) return null;
    const top = computeBestReviewers(data.users, data.prs, 10);
    const found = top.find((b) => b.login === user.login);
    return found?.rank ?? null;
  }, [user, data]);

  const reviewerInteractions = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const p of userPRs) {
      for (const c of p.comments) {
        if (c.author.toLowerCase() === username.toLowerCase()) continue;
        counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([login, count]) => ({ login, count }))
      .reverse();
  }, [data, userPRs, username]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopProgressBar active={isFetching} />
      <TopBar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 space-y-6 animate-page-in">
        <Link href="/" className="inline-flex">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>

        {error && (
          <ErrorState
            title="Could not load user data"
            description={error instanceof Error ? error.message : String(error)}
          />
        )}

        {isLoading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {data && !user && (
          <EmptyState
            title={`No activity for ${username}`}
            description="This user has no PRs or comments in the current filter window."
          />
        )}

        {user && (
          <>
            <Card className="p-6">
              <div className="flex items-start gap-4">
                {user.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-16 w-16 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                      {user.login}
                    </h1>
                    <Badge
                      variant={
                        user.isBot
                          ? "bot"
                          : user.reviewerType === "R1"
                            ? "r1"
                            : "r2"
                      }
                    >
                      {user.isBot ? "BOT" : user.reviewerType}
                    </Badge>
                    {userHealth && (
                      <Badge
                        variant={
                          userHealth.band === "good"
                            ? "success"
                            : userHealth.band === "ok"
                              ? "warning"
                              : "destructive"
                        }
                        title={`Engineering health score: ${userHealth.raw}`}
                      >
                        {HEALTH_LABEL[userHealth.band]} health ·{" "}
                        {userHealth.raw}
                      </Badge>
                    )}
                    {bestReviewerRank && (
                      <Badge
                        variant="warning"
                        className="inline-flex items-center gap-1"
                        title={`Top reviewer rank #${bestReviewerRank}`}
                      >
                        <Star className="h-3 w-3 fill-current" />
                        Top reviewer #{bestReviewerRank}
                      </Badge>
                    )}
                    <a
                      href={`https://github.com/${user.login}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Open ${user.login} on GitHub`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  {user.name && (
                    <div className="text-sm text-muted-foreground">
                      {user.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="PRs authored" value={user.prsAuthored} />
                <Stat label="Merged" value={user.prsMerged} tone="success" />
                <Stat label="Open" value={user.prsOpen} tone="warning" />
                <Stat label="Closed" value={user.prsClosed} tone="muted" />
                <Stat
                  label="R1 comments given"
                  value={user.R1_commentsGiven}
                  tone="chart-1"
                />
                <Stat
                  label="R2 comments given"
                  value={user.R2_commentsGiven}
                  tone="chart-3"
                />
                <Stat
                  label="Approvals given"
                  value={user.approvalsGiven}
                  tone="success"
                />
                <Stat
                  label="Avg time-to-first-review"
                  value={
                    user.avgTimeToFirstReviewHours == null
                      ? null
                      : `${user.avgTimeToFirstReviewHours.toFixed(1)} h`
                  }
                />
              </div>
            </Card>

            {insights &&
              (insights.strengths.length > 0 ||
                insights.weaknesses.length > 0) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {insights.strengths.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">
                          Nothing notable yet — this user&apos;s pattern is
                          still forming.
                        </div>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {insights.strengths.map((s) => (
                            <li
                              key={s}
                              className="rounded-md border border-success/20 bg-success/5 px-3 py-1.5"
                            >
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TriangleAlert className="h-4 w-4 text-warning" />
                        Watch-outs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {insights.weaknesses.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">
                          No issues detected.
                        </div>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {insights.weaknesses.map((s) => (
                            <li
                              key={s}
                              className="rounded-md border border-warning/20 bg-warning/5 px-3 py-1.5"
                            >
                              {s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>30-day PRs opened</CardTitle>
                </CardHeader>
                <CardContent>
                  <Sparkline
                    values={sparkPRs}
                    width={400}
                    height={60}
                    color="hsl(var(--chart-1))"
                  />
                  <div className="mt-2 text-xs text-muted-foreground tabular-nums">
                    Total: {sparkPRs.reduce((a, b) => a + b, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>30-day comments given</CardTitle>
                </CardHeader>
                <CardContent>
                  <Sparkline
                    values={sparkComments}
                    width={400}
                    height={60}
                    color="hsl(var(--chart-3))"
                  />
                  <div className="mt-2 text-xs text-muted-foreground tabular-nums">
                    Total: {sparkComments.reduce((a, b) => a + b, 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>R1 vs R2 mix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40">
                    {r1r2Pie.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No comments given.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={r1r2Pie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={32}
                            outerRadius={56}
                            paddingAngle={3}
                            animationDuration={ANIM_MS}
                          >
                            {r1r2Pie.map((d, i) => (
                              <Cell
                                key={i}
                                fill={d.color}
                                stroke="hsl(var(--card))"
                              />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle title="What this user's review comments focus on">
                    Comment focus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40">
                    {concernPie.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No comments given.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={concernPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={32}
                            outerRadius={56}
                            paddingAngle={3}
                            animationDuration={ANIM_MS}
                          >
                            {concernPie.map((d, i) => (
                              <Cell
                                key={i}
                                fill={d.color}
                                stroke="hsl(var(--card))"
                              />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {reviewerInteractions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Top reviewers on {user.login}&apos;s PRs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={reviewerInteractions}
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
                          dataKey="login"
                          type="category"
                          width={120}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar
                          dataKey="count"
                          fill="hsl(var(--chart-1))"
                          radius={[0, 4, 4, 0]}
                          animationDuration={ANIM_MS}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {user.topRepos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top repos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.topRepos.map((r) => (
                      <Badge
                        key={r.fullName}
                        variant="outline"
                        className="text-xs"
                      >
                        {r.fullName} · {r.prs} PR{r.prs === 1 ? "" : "s"} ·{" "}
                        {r.comments} comment{r.comments === 1 ? "" : "s"}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                PRs authored ({userPRs.length})
              </h2>
              {userPRs.length === 0 ? (
                <EmptyState title="No PRs authored in this window" />
              ) : (
                <PRList prs={userPRs} />
              )}
            </div>

            {userComments.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  PRs reviewed ({userComments.length})
                </h2>
                <PRList prs={userComments} />
              </div>
            )}
          </>
        )}
      </main>
      <Footer data={data} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string | null | undefined;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="mt-0.5 text-xl font-semibold tabular-nums"
        style={tone ? { color: `hsl(var(--${tone}))` } : undefined}
      >
        {value == null
          ? "—"
          : typeof value === "number"
            ? formatNumber(value)
            : value}
      </div>
    </div>
  );
}
