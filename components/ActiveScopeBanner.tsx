"use client";

import { Eye, X } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import { Badge } from "./ui/badge";

/**
 * Plain-English summary of the active filter set, rendered as a thin banner
 * just above the tab content. Intended to answer "why am I seeing this?"
 * after a command-palette jump, a chart click, or a saved-view apply.
 *
 * Each chip is removable so the banner doubles as a quick filter reset.
 * If no filters are active, the banner renders nothing.
 */
export function ActiveScopeBanner({ totalPRs }: { totalPRs: number }) {
  const [filters, setFilters] = useFilters();

  const chips: { key: string; label: string; clear: () => void }[] = [];

  for (const o of filters.orgs) {
    chips.push({
      key: `org-${o}`,
      label: `org: ${o}`,
      clear: () => setFilters({ orgs: filters.orgs.filter((x) => x !== o) }),
    });
  }
  for (const r of filters.repos) {
    chips.push({
      key: `repo-${r}`,
      label: `repo: ${r}`,
      clear: () => setFilters({ repos: filters.repos.filter((x) => x !== r) }),
    });
  }
  for (const u of filters.users) {
    chips.push({
      key: `user-${u}`,
      label: `user: ${u}`,
      clear: () => setFilters({ users: filters.users.filter((x) => x !== u) }),
    });
  }
  if (filters.state !== "all") {
    chips.push({
      key: "state",
      label: `state: ${filters.state}`,
      clear: () => setFilters({ state: null }),
    });
  }
  if (filters.reviewerType !== "all") {
    chips.push({
      key: "reviewerType",
      label: `${filters.reviewerType} only`,
      clear: () => setFilters({ reviewerType: null }),
    });
  }
  if (filters.problematic !== "off") {
    chips.push({
      key: "problematic",
      label: `quick: ${filters.problematic}`,
      clear: () => setFilters({ problematic: null }),
    });
  }
  if (filters.q) {
    chips.push({
      key: "q",
      label: `search: "${filters.q}"`,
      clear: () => setFilters({ q: null }),
    });
  }
  if (filters.from && filters.to) {
    const f = filters.from.slice(0, 10);
    const t = filters.to.slice(0, 10);
    chips.push({
      key: "range",
      label: `range: ${f} → ${t}`,
      clear: () => setFilters({ from: null, to: null }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
      <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground">Viewing</span>
      <Badge variant="primary" className="tabular-nums">
        {totalPRs} PR{totalPRs === 1 ? "" : "s"}
      </Badge>
      <span className="text-muted-foreground">scoped to</span>
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background pl-2 pr-0.5 py-0.5 text-xs"
        >
          {c.label}
          <button
            type="button"
            onClick={c.clear}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={`Remove ${c.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() =>
          setFilters({
            orgs: null,
            repos: null,
            users: null,
            state: null,
            reviewerType: null,
            problematic: null,
            q: null,
            from: null,
            to: null,
          })
        }
        className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
