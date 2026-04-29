"use client";

import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Sparkline } from "../Sparkline";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { NormalizedPR, UserStats } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  user: UserStats | null;
  prs: NormalizedPR[];
  onClose: () => void;
}

/**
 * Slide-in side drawer with the deeper view of a user's activity. Filters
 * `prs` to those authored or commented on by the user. Renders a 14-day
 * activity sparkline + top-10 PRs list. Pressing Esc or clicking outside
 * dismisses.
 */
export function UserDrawer({ user, prs, onClose }: Props) {
  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [user, onClose]);

  if (!user) return null;

  const lower = user.login.toLowerCase();
  const authored = prs.filter((p) => p.author.toLowerCase() === lower);
  const commented = prs.filter((p) =>
    p.comments.some((c) => c.author.toLowerCase() === lower),
  );

  const days = 14;
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
  for (const p of authored) {
    const idx = dayKeys.indexOf(p.createdAt.slice(0, 10));
    if (idx >= 0) sparkPRs[idx]++;
  }
  for (const p of prs) {
    for (const c of p.comments) {
      if (c.author.toLowerCase() !== lower) continue;
      const idx = dayKeys.indexOf(c.createdAt.slice(0, 10));
      if (idx >= 0) sparkComments[idx]++;
    }
  }

  const recentPRs = [...authored, ...commented]
    .filter((v, i, a) => a.findIndex((p) => p.id === v.id) === i)
    .sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    )
    .slice(0, 10);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Activity drawer for ${user.login}`}
      className="fixed inset-0 z-70 flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <aside
        className="relative h-full w-full max-w-[520px] overflow-y-auto border-l border-border bg-card shadow-2xl animate-tab-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            {user.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{user.login}</h2>
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
              </div>
              {user.name && (
                <div className="truncate text-xs text-muted-foreground">
                  {user.name}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`https://github.com/${user.login}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="View on GitHub"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <Link
              href={`/users/${encodeURIComponent(user.login)}`}
              className="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Open profile
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="space-y-5 p-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="PRs authored" value={user.prsAuthored} />
            <Stat label="Merged" value={user.prsMerged} tone="success" />
            <Stat
              label="Comments given"
              value={user.commentsGiven}
              tone="chart-1"
            />
            <Stat
              label="Approvals"
              value={user.approvalsGiven}
              tone="success"
            />
            <Stat
              label="R1 comments"
              value={user.R1_commentsGiven}
              tone="chart-1"
            />
            <Stat
              label="R2 comments"
              value={user.R2_commentsGiven}
              tone="chart-3"
            />
            <Stat label="Received" value={user.commentsReceived} />
            <Stat
              label="Avg TTFR"
              value={
                user.avgTimeToFirstReviewHours == null
                  ? "—"
                  : `${user.avgTimeToFirstReviewHours.toFixed(1)} h`
              }
            />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Last 14 days
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">PRs opened</div>
                <Sparkline values={sparkPRs} width={200} height={40} />
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs text-muted-foreground">
                  Comments given
                </div>
                <Sparkline
                  values={sparkComments}
                  width={200}
                  height={40}
                  color="hsl(var(--chart-3))"
                />
              </div>
            </div>
          </section>

          {user.topRepos.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Top repos
              </h3>
              <ul className="space-y-1">
                {user.topRepos.slice(0, 5).map((r) => (
                  <li
                    key={r.fullName}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">{r.fullName}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.prs} PR{r.prs === 1 ? "" : "s"} · {r.comments} comment
                      {r.comments === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recent activity ({recentPRs.length} of {authored.length + commented.length - new Set(authored.concat(commented).map(p => p.id)).size + new Set(authored.concat(commented).map(p => p.id)).size})
            </h3>
            {recentPRs.length === 0 ? (
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                No PRs in this window.
              </div>
            ) : (
              <ul className="space-y-1">
                {recentPRs.map((p) => (
                  <li key={p.id}>
                    <a
                      href={p.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.title}</div>
                        <div className="truncate text-muted-foreground">
                          {p.fullName}#{p.number} · {p.state} ·{" "}
                          {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatNumber(p.totalComments)} comments
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string | null;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="mt-0.5 text-lg font-semibold tabular-nums"
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
