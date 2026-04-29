"use client";

import { Clock, Database, GitBranch, Sparkles, Users } from "lucide-react";
import type { AggregatedResponse } from "@/lib/types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { formatNumber } from "@/lib/utils";

export function DashboardHero({
  data,
  sprintLabel,
}: {
  data?: AggregatedResponse;
  sprintLabel: string;
}) {
  const repoLabel =
    data == null
      ? "Preparing repository scope"
      : data.appliedFilters.repos.length > 0
        ? `${data.appliedFilters.repos.length} selected repo${
            data.appliedFilters.repos.length === 1 ? "" : "s"
          }`
        : `${data.stats.reposCount} repo${
            data.stats.reposCount === 1 ? "" : "s"
          } with PR activity`;

  return (
    <Card className="overflow-hidden border-primary/15 bg-linear-to-br from-card via-card to-[hsl(var(--chart-1)/0.08)]">
      <div className="relative p-6">
        <div className="absolute right-6 top-6 hidden rounded-full bg-primary/5 p-3 text-primary md:block">
          <Sparkles className="h-5 w-5" />
        </div>

        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Live GitHub data</Badge>
            <Badge variant="outline">{sprintLabel}</Badge>
            {data?.cache.hit && <Badge variant="success">cache hit</Badge>}
            {data && !data.cache.hit && (
              <Badge variant="warning">fresh fetch</Badge>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            PR analytics across your selected GitHub data set
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
            User-first dashboard with R1/R2 review classification, PR state
            trends, review decisions, and export-ready reporting.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <HeroMetric
            icon={GitBranch}
            label="Scope"
            value={repoLabel}
            muted={!data}
          />
          <HeroMetric
            icon={Users}
            label="Contributors"
            value={
              data ? formatNumber(data.stats.contributorsCount) : "Loading…"
            }
            muted={!data}
          />
          <HeroMetric
            icon={Database}
            label="Cache"
            value={
              data
                ? data.cache.hit
                  ? "Served instantly"
                  : "Refreshed"
                : "Checking…"
            }
            muted={!data}
          />
          <HeroMetric
            icon={Clock}
            label="Generated"
            value={
              data
                ? new Date(data.generatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "In progress"
            }
            muted={!data}
          />
        </div>
      </div>
    </Card>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/75 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div
        className={`mt-1 truncate text-sm font-semibold ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
