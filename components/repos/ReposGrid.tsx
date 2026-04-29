"use client";

import { ExternalLink, GitBranch, Users } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import type { RepoStats } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Card } from "../ui/card";

interface Props {
  repos: RepoStats[];
}

export function ReposGrid({ repos }: Props) {
  const [, setFilters] = useFilters();

  if (repos.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-muted-foreground">
        No repos with activity in this window.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
      {repos.map((r) => (
        <Card
          key={r.fullName}
          className="group p-4 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-ring"
          onClick={() => setFilters({ repos: [r.fullName] })}
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
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
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
              <div className="text-xs text-muted-foreground">Contributors</div>
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
      ))}
    </div>
  );
}
