"use client";

import { GitPullRequest } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import { AutoRefreshControl } from "./AutoRefreshControl";
import { DensityToggle } from "./DensityToggle";
import { ExportButton } from "./ExportButton";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { RefreshButton } from "./RefreshButton";
import { SavedViews } from "./SavedViews";
import { ShareLinkButton } from "./ShareLinkButton";
import { SprintPicker } from "./SprintPicker";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  const [filters] = useFilters();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-2 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GitPullRequest className="h-4 w-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold tracking-tight">
              {process.env.NEXT_PUBLIC_APP_NAME ?? "PR Analytics"}
            </div>
            <ScopeSubtitle />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <SprintPicker />
          <SavedViews />
          <AutoRefreshControl />
          <RefreshButton filters={filters} />
          <ExportButton filters={filters} />
          <ShareLinkButton />
          <DensityToggle />
          <ThemeToggle />
        </div>
      </div>
      <KeyboardShortcuts />
    </header>
  );
}

function ScopeSubtitle() {
  const [filters] = useFilters();
  const parts: string[] = [];
  if (filters.repos.length === 1) parts.push(filters.repos[0]);
  else if (filters.orgs.length === 1) parts.push(filters.orgs[0]);
  else if (filters.repos.length > 1)
    parts.push(`${filters.repos.length} repos`);
  else if (filters.orgs.length > 1) parts.push(`${filters.orgs.length} orgs`);
  else parts.push("All repos");
  return (
    <div className="truncate text-xs text-muted-foreground">{parts.join(" · ")}</div>
  );
}
