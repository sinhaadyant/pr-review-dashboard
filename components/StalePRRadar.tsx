"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { useNow } from "@/hooks/use-now";
import type { NormalizedPR } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface Props {
  prs: NormalizedPR[];
  thresholdDays?: number;
}

/**
 * Surfaces open PRs whose latest activity is older than `thresholdDays`.
 * "Latest activity" = max(createdAt, last comment createdAt). Sorted oldest
 * first so the most-stale PRs are at the top.
 */
export function StalePRRadar({ prs, thresholdDays = 7 }: Props) {
  const [days, setDays] = useState(thresholdDays);
  const now = useNow();

  const stale = useMemo(() => {
    const threshold = days * 24 * 60 * 60 * 1000;
    return prs
      .filter((p) => p.state === "open")
      .map((p) => {
        const lastCommentAt = p.comments.length
          ? Math.max(...p.comments.map((c) => Date.parse(c.createdAt)))
          : 0;
        const lastActivity = Math.max(Date.parse(p.createdAt), lastCommentAt);
        return { pr: p, lastActivity, age: now - lastActivity };
      })
      .filter((x) => x.age > threshold)
      .sort((a, b) => b.age - a.age)
      .slice(0, 25);
  }, [prs, days, now]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            Stale PR radar
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Stale threshold"
          >
            <option value={3}>&gt; 3 days</option>
            <option value={7}>&gt; 7 days</option>
            <option value={14}>&gt; 14 days</option>
            <option value={30}>&gt; 30 days</option>
          </select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stale.length === 0 ? (
          <div className="rounded-lg bg-success/10 p-4 text-center text-sm text-success">
            All open PRs have activity within the last {days} days.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {stale.map(({ pr, age }) => {
              const ageDays = Math.floor(age / (24 * 60 * 60 * 1000));
              const tone =
                ageDays > 30
                  ? "destructive"
                  : ageDays > 14
                    ? "warning"
                    : "default";
              return (
                <li key={pr.id}>
                  <a
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {pr.title}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {pr.fullName}#{pr.number} · by {pr.author}
                      </div>
                    </div>
                    <Badge variant={tone}>{ageDays}d stale</Badge>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
