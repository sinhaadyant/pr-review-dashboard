"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Inbox,
  KeyRound,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import type { CacheMeta, DiscoveryResult } from "@/lib/types";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const tokenIssue =
    description?.toLowerCase().includes("token") ||
    description?.toLowerCase().includes("credential") ||
    description?.toLowerCase().includes("401");
  const Icon = tokenIssue ? KeyRound : AlertTriangle;
  return (
    <Card className="p-12 flex flex-col items-center text-center max-w-2xl mx-auto">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full mb-4"
        style={{
          background: "hsl(var(--destructive) / 0.12)",
          color: "hsl(var(--destructive))",
        }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          {description}
        </p>
      )}
      {tokenIssue && (
        <p className="mt-3 text-xs text-muted-foreground max-w-md">
          Set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">GITHUB_TOKEN</code>{" "}
          in your{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code>{" "}
          file with a PAT that has{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">repo</code> or{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">public_repo</code>{" "}
          scope.
        </p>
      )}
      {onRetry && (
        <Button className="mt-5" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card className="p-12 flex flex-col items-center text-center max-w-xl mx-auto">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          {description}
        </p>
      )}
    </Card>
  );
}

export function StaleDataBanner({ cache }: { cache: CacheMeta }) {
  if (!cache.stale) return null;
  return (
    <div className="rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] px-3 py-2 text-xs flex items-center gap-2">
      <ShieldAlert className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
      <span className="text-[hsl(var(--warning))] font-medium">
        Showing stale data
      </span>
      <span className="text-muted-foreground">
        — generated {new Date(cache.generatedAt).toLocaleString()}
      </span>
    </div>
  );
}

export function PartialDataBanner({
  reposSkipped,
}: {
  reposSkipped?: string[];
}) {
  if (!reposSkipped || reposSkipped.length === 0) return null;
  return (
    <div className="rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.08)] px-3 py-2 text-xs flex items-center gap-2">
      <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
      <span className="text-[hsl(var(--warning))] font-medium">
        Partial data
      </span>
      <span className="text-muted-foreground">
        — {reposSkipped.length} repo{reposSkipped.length === 1 ? "" : "s"} not
        included in this run. Increase the repo cap or filter to a smaller scope
        if you need exhaustive coverage.
      </span>
    </div>
  );
}

export function DetailedLoadingState({
  discovery,
  discoveryLoading,
  sprintLabel,
}: {
  discovery?: DiscoveryResult;
  discoveryLoading: boolean;
  sprintLabel?: string;
}) {
  const repos = discovery?.repos ?? [];
  const repoNames = repos.map((r) => r.fullName);
  const stages = [
    {
      label: "Discovering token-accessible repositories",
      detail: discoveryLoading
        ? "Calling GitHub /user and resolving configured public sample repos"
        : `${repos.length} repo${repos.length === 1 ? "" : "s"} ready`,
      done: !discoveryLoading && !!discovery,
      active: discoveryLoading,
    },
    {
      label: "Fetching pull requests",
      detail: `${repoNames.slice(0, 3).join(", ")}${repoNames.length > 3 ? ` + ${repoNames.length - 3} more` : ""}`,
      done: false,
      active: !discoveryLoading,
    },
    {
      label: "Fetching comments, inline reviews, and review decisions",
      detail:
        "Merging issue comments, review comments, and APPROVED / CHANGES_REQUESTED reviews",
      done: false,
      active: !discoveryLoading,
    },
    {
      label: "Classifying R1 / R2 and computing dashboard metrics",
      detail:
        "Building Users, Repos, and Activity views, then storing a 20-minute cache entry",
      done: false,
      active: !discoveryLoading,
    },
  ];

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-[hsl(var(--chart-1)/0.08)]">
      <div className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Live GitHub aggregation in progress
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              Fetching PR analytics
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {sprintLabel ? `Scanning ${sprintLabel}. ` : null}
              First load fetches PRs and review data from GitHub; repeat loads
              are served from cache.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
              <div className="text-lg font-semibold tabular-nums">
                {discoveryLoading ? "…" : repos.length}
              </div>
              <div className="text-muted-foreground">repos</div>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
              <div className="text-lg font-semibold tabular-nums">3</div>
              <div className="text-muted-foreground">data sources</div>
            </div>
            <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
              <div className="text-lg font-semibold tabular-nums">20m</div>
              <div className="text-muted-foreground">cache TTL</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const Icon = stage.done
                ? CheckCircle2
                : stage.active
                  ? Loader2
                  : CircleDashed;
              return (
                <div
                  key={stage.label}
                  className="flex gap-3 rounded-lg border border-border bg-background/70 p-3"
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon
                      className={`h-4 w-4 ${
                        stage.active && !stage.done ? "animate-spin" : ""
                      } ${stage.done ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {index + 1}. {stage.label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {stage.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-background/70 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Repositories being scanned
            </div>
            {discoveryLoading ? (
              <div className="space-y-2">
                <div className="h-8 rounded-md bg-muted animate-pulse" />
                <div className="h-8 rounded-md bg-muted animate-pulse" />
                <div className="h-8 rounded-md bg-muted animate-pulse" />
              </div>
            ) : repos.length === 0 ? (
              <div className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                Waiting for discovery results…
              </div>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {repos.map((repo) => (
                  <li
                    key={repo.fullName}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                  >
                    <span className="truncate font-medium">
                      {repo.fullName}
                    </span>
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-muted-foreground">
                      {repo.isPrivate ? "private" : "public"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
