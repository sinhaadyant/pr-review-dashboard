"use client";

import { Filter, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFilters } from "@/hooks/use-filters";
import { useDiscover } from "@/hooks/use-discover";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

const STATES = ["all", "open", "merged", "closed"] as const;
const REVIEWER_TYPES = ["all", "R1", "R2"] as const;

export function FilterBar() {
  const [filters, setFilters] = useFilters();
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: "/" focuses search, "Esc" clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !inField && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (
        e.key === "Escape" &&
        document.activeElement === searchRef.current
      ) {
        searchRef.current?.blur();
        setFilters({ q: null });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setFilters]);

  const activeCount =
    filters.orgs.length +
    filters.repos.length +
    filters.users.length +
    (filters.state !== "all" ? 1 : 0) +
    (filters.reviewerType !== "all" ? 1 : 0) +
    (filters.q ? 1 : 0);

  const reset = () => {
    setFilters({
      orgs: null,
      repos: null,
      users: null,
      state: null,
      reviewerType: null,
      q: null,
      from: null,
      to: null,
    });
  };

  return (
    <div className="sticky top-14 z-30 rounded-xl border border-border bg-card/95 p-3 space-y-3 backdrop-blur supports-backdrop-filter:bg-card/80 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={open ? "default" : "outline"}
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="primary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>

        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search PRs, users, repos…  (press / )"
              value={filters.q ?? ""}
              onChange={(e) => setFilters({ q: e.target.value || null })}
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Search"
            />
            {filters.q && (
              <button
                onClick={() => {
                  setFilters({ q: null });
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-2 rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
                title="Clear (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <SegmentedControl
          options={STATES}
          value={filters.state}
          onChange={(v) => setFilters({ state: v })}
        />
        <SegmentedControl
          options={REVIEWER_TYPES}
          value={filters.reviewerType}
          onChange={(v) => setFilters({ reviewerType: v })}
        />

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border pt-3">
          <OrgsFilter />
          <ReposFilter />
        </div>
      )}

      {(filters.orgs.length > 0 || filters.repos.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {filters.orgs.map((o) => (
            <Chip
              key={`org-${o}`}
              label={`org: ${o}`}
              onRemove={() =>
                setFilters({
                  orgs: filters.orgs.filter((x) => x !== o),
                })
              }
            />
          ))}
          {filters.repos.map((r) => (
            <Chip
              key={`repo-${r}`}
              label={`repo: ${r}`}
              onRemove={() =>
                setFilters({
                  repos: filters.repos.filter((x) => x !== r),
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-border bg-muted/30 p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "px-2.5 h-8 text-xs font-medium rounded transition-colors",
            value === opt
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 py-0.5 text-xs">
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-accent"
        aria-label="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function OrgsFilter() {
  const [filters, setFilters] = useFilters();
  const { data, isLoading } = useDiscover();
  const [q, setQ] = useState("");
  const filtered = (data?.orgs ?? []).filter((o) =>
    o.login.toLowerCase().includes(q.toLowerCase()),
  );
  const toggle = (login: string) => {
    const has = filters.orgs.includes(login);
    setFilters({
      orgs: has
        ? filters.orgs.filter((x) => x !== login)
        : [...filters.orgs, login],
    });
  };

  return (
    <SearchableList
      title="Organizations"
      query={q}
      onQuery={setQ}
      items={filtered.map((o) => ({
        key: o.login,
        primary: o.login,
        secondary: `${o.repoCount} repo${o.repoCount === 1 ? "" : "s"}`,
        avatar: o.avatarUrl,
      }))}
      selected={filters.orgs}
      onToggle={toggle}
      loading={isLoading}
    />
  );
}

function ReposFilter() {
  const [filters, setFilters] = useFilters();
  const { data, isLoading } = useDiscover();
  const [q, setQ] = useState("");
  const orgFilter = new Set(filters.orgs);
  const items = (data?.repos ?? [])
    .filter((r) => (orgFilter.size === 0 ? true : orgFilter.has(r.owner)))
    .filter((r) => r.fullName.toLowerCase().includes(q.toLowerCase()));
  const toggle = (fullName: string) => {
    const has = filters.repos.includes(fullName);
    setFilters({
      repos: has
        ? filters.repos.filter((x) => x !== fullName)
        : [...filters.repos, fullName],
    });
  };

  return (
    <SearchableList
      title="Repositories"
      query={q}
      onQuery={setQ}
      items={items.slice(0, 100).map((r) => ({
        key: r.fullName,
        primary: r.name,
        secondary: r.owner,
        badge: r.isPrivate ? "private" : undefined,
      }))}
      selected={filters.repos}
      onToggle={toggle}
      loading={isLoading}
    />
  );
}

interface ListItem {
  key: string;
  primary: string;
  secondary?: string;
  avatar?: string;
  badge?: string;
}

function SearchableList({
  title,
  query,
  onQuery,
  items,
  selected,
  onToggle,
  loading,
}: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  items: ListItem[];
  selected: string[];
  onToggle: (key: string) => void;
  loading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="border-b border-border p-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
          {title}
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Filter ${title.toLowerCase()}...`}
          className="h-8 w-full rounded border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <ul className="max-h-60 overflow-y-auto p-1">
        {loading && (
          <li className="px-2 py-3 text-sm text-muted-foreground">Loading…</li>
        )}
        {!loading && items.length === 0 && (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            No matches
          </li>
        )}
        {items.map((it) => {
          const isSelected = selected.includes(it.key);
          return (
            <li key={it.key}>
              <button
                onClick={() => onToggle(it.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                  isSelected && "bg-accent",
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {isSelected && (
                    <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current">
                      <path d="M6 11L3 8l1-1 2 2 5-5 1 1z" />
                    </svg>
                  )}
                </div>
                {it.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.avatar}
                    alt=""
                    className="h-5 w-5 rounded-full shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.primary}</div>
                  {it.secondary && (
                    <div className="truncate text-xs text-muted-foreground">
                      {it.secondary}
                    </div>
                  )}
                </div>
                {it.badge && (
                  <Badge variant="outline" className="text-[10px]">
                    {it.badge}
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
