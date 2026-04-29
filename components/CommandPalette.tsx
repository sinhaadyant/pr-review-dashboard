"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  CalendarRange,
  Filter as FilterIcon,
  GitBranch,
  HeartCrack,
  Keyboard,
  Moon,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  Sun,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAggregate } from "@/hooks/use-aggregate";
import { useDiscover, useConfig } from "@/hooks/use-discover";
import { useFilters } from "@/hooks/use-filters";
import { cn } from "@/lib/utils";

type Group = "Sprints" | "Users" | "Repos" | "Filters" | "Actions";

interface CommandItem {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Lower-cased haystack used for fuzzy matching. */
  search: string;
  run: () => void | Promise<void>;
}

/**
 * Cross-cutting command palette (⌘K / Ctrl+K).
 *
 * Aggregates four kinds of commands:
 *   - Navigation: jump to a user profile, scope the dashboard to a repo, switch sprint
 *   - Filters: apply quick filters (high-risk, stale, unhealthy)
 *   - Actions: refresh, clear filters, toggle theme, scroll to top
 *
 * Uses a tiny custom fuzzy-rank that prefers prefix matches and consecutive
 * subsequence matches without bringing in an extra dep.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [filters, setFilters] = useFilters();
  const { data: discover } = useDiscover();
  const { data: config } = useConfig();
  const { data, forceRefresh } = useAggregate(filters);
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  // Open / close + keyboard hooks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setActive(0);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      // Plain `k` (no modifier) opens too — but only outside inputs.
      if (e.key === "k" && !inField && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setActive(0);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Focus the input once the dialog mounts.
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Close any time filters change *via* a command — but we re-scope manually
  // below so the runs themselves close the palette.

  const items = useMemo<CommandItem[]>(() => {
    const out: CommandItem[] = [];

    const close = () => {
      setOpen(false);
      setQuery("");
    };

    // --- Sprints
    for (const s of config?.sprints ?? []) {
      out.push({
        id: `sprint-${s.id}`,
        group: "Sprints",
        label: s.name,
        hint: `${s.startDate.slice(0, 10)} → ${s.endDate.slice(0, 10)}`,
        icon: CalendarRange,
        search: `sprint ${s.name} ${s.id}`.toLowerCase(),
        run: () => {
          setFilters({ sprint: s.id, from: null, to: null });
          close();
        },
      });
    }

    // --- Users (top contributors, capped — full list searchable but trimmed)
    const userPool = (data?.users ?? []).filter((u) => !u.isBot).slice(0, 200);
    for (const u of userPool) {
      out.push({
        id: `user-${u.login}`,
        group: "Users",
        label: u.login,
        hint: u.name ?? `${u.commentsGiven} comments · ${u.prsAuthored} PRs`,
        icon: UsersIcon,
        search: `user ${u.login} ${u.name ?? ""}`.toLowerCase(),
        run: () => {
          router.push(`/users/${encodeURIComponent(u.login)}`);
          close();
        },
      });
    }

    // --- Repos (from discover + filtered to repos with PRs in the active set)
    const repoPool = discover?.repos ?? [];
    for (const r of repoPool.slice(0, 300)) {
      out.push({
        id: `repo-${r.fullName}`,
        group: "Repos",
        label: r.fullName,
        hint: r.isPrivate ? "private" : "public",
        icon: GitBranch,
        search: `repo ${r.fullName} ${r.owner} ${r.name}`.toLowerCase(),
        run: () => {
          setFilters({ repos: [r.fullName] });
          close();
        },
      });
    }

    // --- Quick filters
    out.push(
      {
        id: "filter-risk",
        group: "Filters",
        label: "Show high-risk PRs",
        icon: AlertOctagon,
        search: "filter high risk problematic",
        run: () => {
          setFilters({ problematic: "risk", tab: "activity" });
          close();
        },
      },
      {
        id: "filter-stale",
        group: "Filters",
        label: "Show stale open PRs",
        icon: HeartCrack,
        search: "filter stale open old problematic",
        run: () => {
          setFilters({ problematic: "stale", tab: "activity" });
          close();
        },
      },
      {
        id: "filter-unhealthy",
        group: "Filters",
        label: "Show unhealthy reviews",
        icon: HeartCrack,
        search: "filter unhealthy poor health problematic",
        run: () => {
          setFilters({ problematic: "unhealthy", tab: "activity" });
          close();
        },
      },
      {
        id: "filter-state-open",
        group: "Filters",
        label: "Only open PRs",
        icon: FilterIcon,
        search: "filter state open",
        run: () => {
          setFilters({ state: "open" });
          close();
        },
      },
      {
        id: "filter-state-merged",
        group: "Filters",
        label: "Only merged PRs",
        icon: FilterIcon,
        search: "filter state merged",
        run: () => {
          setFilters({ state: "merged" });
          close();
        },
      },
      {
        id: "filter-r1",
        group: "Filters",
        label: "Only R1 (internal) reviewers",
        icon: FilterIcon,
        search: "filter reviewer r1 internal",
        run: () => {
          setFilters({ reviewerType: "R1" });
          close();
        },
      },
      {
        id: "filter-r2",
        group: "Filters",
        label: "Only R2 (external) reviewers",
        icon: FilterIcon,
        search: "filter reviewer r2 external",
        run: () => {
          setFilters({ reviewerType: "R2" });
          close();
        },
      },
    );

    // --- Actions
    out.push(
      {
        id: "action-refresh",
        group: "Actions",
        label: "Refresh data",
        icon: RefreshCw,
        search: "refresh reload force",
        run: async () => {
          close();
          await qc.invalidateQueries({ queryKey: ["aggregate"] });
          await forceRefresh().catch(() => {});
        },
      },
      {
        id: "action-clear",
        group: "Actions",
        label: "Clear all filters",
        icon: RotateCcw,
        search: "clear reset filters",
        run: () => {
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
          });
          close();
        },
      },
      {
        id: "action-toggle-theme",
        group: "Actions",
        label:
          resolvedTheme === "dark"
            ? "Switch to light theme"
            : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        search: "theme dark light toggle",
        run: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          close();
        },
      },
      {
        id: "action-tab-users",
        group: "Actions",
        label: "Go to Users tab",
        icon: UsersIcon,
        search: "tab users team",
        run: () => {
          setFilters({ tab: "users" });
          close();
        },
      },
      {
        id: "action-tab-repos",
        group: "Actions",
        label: "Go to Repos tab",
        icon: GitBranch,
        search: "tab repos repositories",
        run: () => {
          setFilters({ tab: "repos" });
          close();
        },
      },
      {
        id: "action-tab-activity",
        group: "Actions",
        label: "Go to Activity tab",
        icon: Star,
        search: "tab activity charts",
        run: () => {
          setFilters({ tab: "activity" });
          close();
        },
      },
      {
        id: "action-help",
        group: "Actions",
        label: "Show keyboard shortcuts",
        icon: Keyboard,
        search: "shortcuts help keyboard",
        run: () => {
          close();
          // The KeyboardShortcuts component listens for "?".
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "?", bubbles: true }),
          );
        },
      },
    );

    return out;
  }, [
    config?.sprints,
    data?.users,
    discover?.repos,
    forceRefresh,
    qc,
    resolvedTheme,
    router,
    setFilters,
    setTheme,
  ]);

  // --- Fuzzy filter & rank
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      // Default: show a curated subset (actions + sprints + top users).
      return items.filter(
        (i) =>
          i.group === "Actions" ||
          i.group === "Filters" ||
          i.group === "Sprints",
      );
    }
    const scored: { item: CommandItem; score: number }[] = [];
    for (const item of items) {
      const score = fuzzyScore(item.search, q);
      if (score > 0) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40).map((s) => s.item);
  }, [items, query]);

  // Group results for display while keeping a flat order for keyboard nav.
  const groups = useMemo(() => {
    const order: Group[] = ["Actions", "Filters", "Sprints", "Users", "Repos"];
    const out: { name: Group; items: CommandItem[] }[] = [];
    for (const g of order) {
      const list = filtered.filter((i) => i.group === g);
      if (list.length) out.push({ name: g, items: list });
    }
    return out;
  }, [filtered]);

  // Reset active when filtered list changes. Defer through rAF so the
  // setState doesn't run synchronously inside the effect body (React 19
  // strict purity rule, react-hooks/set-state-in-effect).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setActive(0));
    return () => cancelAnimationFrame(raf);
  }, [query, filtered.length]);

  // Keep active item visible
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Local key handlers while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(filtered.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[active];
        if (item) item.run();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, filtered, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-90 flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-scale-in"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a user, repo, sprint, or action…"
            className="h-8 flex-1 bg-transparent text-sm focus:outline-none"
            aria-label="Command search"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Esc
          </kbd>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-[60vh] overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No commands match{" "}
              <span className="font-mono">&ldquo;{query}&rdquo;</span>
            </li>
          ) : (
            (() => {
              let runningIdx = 0;
              return groups.map((g) => (
                <li key={g.name} className="mb-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.name}
                  </div>
                  <ul>
                    {g.items.map((it) => {
                      const idx = runningIdx++;
                      const isActive = idx === active;
                      const Icon = it.icon;
                      return (
                        <li key={it.id}>
                          <button
                            data-cmd-index={idx}
                            type="button"
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => it.run()}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                              isActive
                                ? "bg-accent text-foreground"
                                : "text-foreground/90 hover:bg-accent/60",
                            )}
                            role="option"
                            aria-selected={isActive}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate">{it.label}</span>
                            {it.hint && (
                              <span className="ml-2 truncate text-xs text-muted-foreground">
                                {it.hint}
                              </span>
                            )}
                            {isActive && (
                              <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                ↵
                              </kbd>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ));
            })()
          )}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <kbd className="rounded border border-border bg-card px-1 font-mono">
              ↑
            </kbd>
            <kbd className="rounded border border-border bg-card px-1 font-mono">
              ↓
            </kbd>
            <span>navigate</span>
            <span className="opacity-60">·</span>
            <kbd className="rounded border border-border bg-card px-1 font-mono">
              ↵
            </kbd>
            <span>run</span>
          </span>
          <span>
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Tiny fuzzy matcher: returns 0 for no match. Score rewards (in order):
 *  - exact substring match
 *  - subsequence match
 *  - earlier match position
 *  - shorter haystack
 */
function fuzzyScore(haystack: string, needle: string): number {
  if (!needle) return 1;
  const idx = haystack.indexOf(needle);
  if (idx >= 0) {
    return 1000 - idx - haystack.length * 0.1;
  }
  // Subsequence match
  let h = 0;
  let n = 0;
  let firstMatch = -1;
  let runs = 0;
  let lastMatchIdx = -2;
  while (h < haystack.length && n < needle.length) {
    if (haystack[h] === needle[n]) {
      if (firstMatch === -1) firstMatch = h;
      if (h === lastMatchIdx + 1) runs++;
      lastMatchIdx = h;
      n++;
    }
    h++;
  }
  if (n < needle.length) return 0;
  return 200 + runs * 5 - firstMatch - haystack.length * 0.1;
}
