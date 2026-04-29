"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { PRList } from "@/components/pr/PRList";
import { Footer } from "@/components/Footer";
import { TopBar } from "@/components/TopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, EmptyState } from "@/components/states/States";
import { Skeleton } from "@/components/ui/skeleton";
import { useAggregate } from "@/hooks/use-aggregate";
import { useFilters } from "@/hooks/use-filters";
import { formatNumber } from "@/lib/utils";

export default function UserPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const [filters] = useFilters();
  const { data, isLoading, error } = useAggregate(filters);

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

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 space-y-6">
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
                    <a
                      href={`https://github.com/${user.login}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
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
                <Stat label="Merged" value={user.prsMerged} />
                <Stat label="Comments given" value={user.commentsGiven} />
                <Stat label="Comments received" value={user.commentsReceived} />
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

              {user.topRepos.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Top repos
                  </div>
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
                </div>
              )}
            </Card>

            <div>
              <h2 className="mb-2 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                PRs authored ({userPRs.length})
              </h2>
              {userPRs.length === 0 ? (
                <EmptyState title="No PRs authored in this window" />
              ) : (
                <PRList prs={userPRs} />
              )}
            </div>
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
