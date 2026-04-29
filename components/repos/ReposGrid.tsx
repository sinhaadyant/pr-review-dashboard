"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, ExternalLink, GitBranch, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useFilters, buildAggregateQuery } from "@/hooks/use-filters";
import { Sparkline } from "@/components/Sparkline";
import type { NormalizedPR, RepoStats } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Card } from "../ui/card";

interface Props {
  repos: RepoStats[];
  prs?: NormalizedPR[];
}

type SortKey = "prs" | "merged" | "comments" | "contributors" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "prs", label: "PRs" },
  { key: "merged", label: "Merged" },
  { key: "comments", label: "R1+R2 comments" },
  { key: "contributors", label: "Contributors" },
  { key: "name", label: "Name" },
];

export function ReposGrid({ repos, prs = [] }: Props) {
  const [filters, setFilters] = useFilters();
  const qc = useQueryClient();
  const [sort, setSort] = useState<SortKey>("prs");

  // Build last-14-day daily bucket per repo for sparkline
  const sparklineByRepo = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const byRepo = new Map<string, number[]>();
    for (const pr of prs) {
      const day = pr.createdAt.slice(0, 10);
      const idx = dayKeys.indexOf(day);
      if (idx === -1) continue;
      const arr = byRepo.get(pr.fullName) ?? new Array(days).fill(0);
      arr[idx]++;
      byRepo.set(pr.fullName, arr);
    }
    return byRepo;
  }, [prs]);

  const sortedRepos = useMemo(() => {
    const arr = [...repos];
    arr.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.fullName.localeCompare(b.fullName);
        case "merged":
          return b.prsMerged - a.prsMerged;
        case "comments":
          return b.R1_comments + b.R2_comments - (a.R1_comments + a.R2_comments);
        case "contributors":
          return b.contributorsCount - a.contributorsCount;
        case "prs":
        default:
          return b.prsTotal - a.prsTotal;
      }
    });
    return arr;
  }, [repos, sort]);

  const prefetchRepo = (fullName: string) => {
    const next = { ...filters, repos: [fullName] };
    const query = buildAggregateQuery(next);
    qc.prefetchQuery({
      queryKey: ["aggregate", query, 0],
      queryFn: async ({ signal }) => {
        const res = await fetch(`/api/github/aggregate?${query}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      },
      staleTime: 60_000,
    });
  };

  if (repos.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-muted-foreground">
        No repos with activity in this window.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {repos.length} repo{repos.length === 1 ? "" : "s"}
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Sort repositories"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
        {sortedRepos.map((r) => {
          const sparkline = sparklineByRepo.get(r.fullName);
          return (
            <Card
              key={r.fullName}
              className="group p-4 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-ring"
              onClick={() => setFilters({ repos: [r.fullName] })}
              onMouseEnter={() => prefetchRepo(r.fullName)}
              onFocus={() => prefetchRepo(r.fullName)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFilters({ repos: [r.fullName] });
                }
              }}
              aria-label={`Filter dashboard to ${r.fullName}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GitBranch className="h-3 w-3" />
                    <span className="truncate">{r.fullName.split("/")[0]}</span>
                  </div>
                  <div className="mt-0.5 truncate font-semibold">
                    {r.fullName.split("/")[1]}
                  </div>
                </div>
                <a
                  href={`https://github.com/${r.fullName}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Open ${r.fullName} on GitHub`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {sparkline && sparkline.some((v) => v > 0) && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    14-day PRs
                  </span>
                  <Sparkline
                    values={sparkline}
                    ariaLabel={`${r.fullName} PR activity over 14 days`}
                  />
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">PRs</div>
                  <div className="text-base font-semibold tabular-nums">
                    {formatNumber(r.prsTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Merged</div>
                  <div className="text-base font-semibold tabular-nums text-success">
                    {formatNumber(r.prsMerged)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Contributors
                  </div>
                  <div className="inline-flex items-center gap-1 text-base font-semibold tabular-nums">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    {formatNumber(r.contributorsCount)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-xs">
                <span className="text-chart-1 font-medium">
                  R1 {formatNumber(r.R1_comments)}
                </span>
                <span className="text-chart-3 font-medium">
                  R2 {formatNumber(r.R2_comments)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
