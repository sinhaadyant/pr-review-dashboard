"use client";

import { Crown, Medal, Star } from "lucide-react";
import { useMemo } from "react";
import Link from "next/link";
import { computeBestReviewers } from "@/lib/intelligence";
import type { NormalizedPR, UserStats } from "@/lib/types";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Props {
  users: UserStats[];
  prs: NormalizedPR[];
  topN?: number;
}

/**
 * Surfaces the top reviewers by composite score (volume × actionable share ×
 * functional share × R1 share, with a cosmetic-only penalty). The component
 * shows each reviewer's rationale (`reasons[]`), so the score is explainable
 * at a glance — i.e. *why* this person is rank #1.
 */
export function BestReviewersPanel({ users, prs, topN = 5 }: Props) {
  const top = useMemo(
    () => computeBestReviewers(users, prs, topN),
    [users, prs, topN],
  );

  if (top.length === 0) {
    return null;
  }

  const userByLogin = new Map(users.map((u) => [u.login, u]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Crown className="h-3.5 w-3.5 text-warning" />
          Top reviewers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {top.map((r) => {
            const u = userByLogin.get(r.login);
            return (
              <li
                key={r.login}
                className="flex items-start gap-3 rounded-md border border-border bg-background p-3"
              >
                <RankPill rank={r.rank} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/users/${encodeURIComponent(r.login)}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {r.login}
                    </Link>
                    {u && !u.isBot && (
                      <Badge variant={u.reviewerType === "R1" ? "r1" : "r2"}>
                        {u.reviewerType}
                      </Badge>
                    )}
                    <Badge variant="outline" className="tabular-nums">
                      score {r.raw}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {r.totalComments} comment
                      {r.totalComments === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums sm:grid-cols-3">
                    <span>
                      Functional:{" "}
                      <span className="text-destructive font-medium">
                        {Math.round(r.functionalShare * 100)}%
                      </span>
                    </span>
                    <span>
                      Actionable:{" "}
                      <span className="text-foreground font-medium">
                        {Math.round(r.actionableShare * 100)}%
                      </span>
                    </span>
                    <span>
                      R1 share:{" "}
                      <span className="text-chart-1 font-medium">
                        {Math.round(r.r1Share * 100)}%
                      </span>
                    </span>
                  </div>
                  {r.reasons.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {r.reasons.map((reason) => (
                        <li
                          key={reason}
                          className="inline-flex items-center gap-1.5"
                        >
                          <Star className="h-3 w-3 shrink-0 text-warning" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function RankPill({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning"
        title="Rank 1"
      >
        <Crown className="h-4 w-4 fill-current" />
      </span>
    );
  }
  if (rank <= 3) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-chart-1/15 text-chart-1"
        title={`Rank ${rank}`}
      >
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-semibold tabular-nums"
      title={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}
