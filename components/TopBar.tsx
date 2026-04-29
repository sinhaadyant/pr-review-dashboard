"use client";

import { Command, GitPullRequest } from "lucide-react";
import { useFilters } from "@/hooks/use-filters";
import { AutoRefreshControl } from "./AutoRefreshControl";
import { CommandPalette } from "./CommandPalette";
import { DensityToggle } from "./DensityToggle";
import { ExportButton } from "./ExportButton";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { RefreshButton } from "./RefreshButton";
import { SavedViews } from "./SavedViews";
import { ShareLinkButton } from "./ShareLinkButton";
import { SprintPicker } from "./SprintPicker";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";

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
          <CommandPaletteTrigger />
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
      <CommandPalette />
    </header>
  );
}

function CommandPaletteTrigger() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        // Reuse the global ⌘K hook.
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            bubbles: true,
          }),
        );
      }}
      className="hidden md:inline-flex gap-2"
      title="Command palette (⌘K)"
      aria-label="Open command palette"
    >
      <Command className="h-3.5 w-3.5" />
      <span className="text-muted-foreground">Search…</span>
      <kbd className="ml-1 rounded border border-border bg-muted px-1 text-[10px] font-mono text-muted-foreground">
        ⌘K
      </kbd>
    </Button>
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
    <div className="truncate text-xs text-muted-foreground">
      {parts.join(" · ")}
    </div>
  );
}
