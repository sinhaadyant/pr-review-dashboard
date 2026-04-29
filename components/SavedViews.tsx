"use client";

import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useFilters, type Filters } from "@/hooks/use-filters";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "./ui/button";

interface SavedView {
  id: string;
  name: string;
  filters: Partial<Filters>;
  createdAt: string;
}

const STORAGE_KEY = "pr-dashboard.saved-views";

const parseViews = (raw: string | null): SavedView[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
};

export function SavedViews() {
  const [filters, setFilters] = useFilters();
  const [views, setViews] = useLocalStorage<SavedView[]>(
    STORAGE_KEY,
    parseViews,
    [],
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const saveCurrent = () => {
    const name = window.prompt("Name this view:");
    if (!name?.trim()) return;
    const id = `${Date.now()}`;
    const view: SavedView = {
      id,
      name: name.trim(),
      filters: {
        orgs: filters.orgs,
        repos: filters.repos,
        users: filters.users,
        sprint: filters.sprint,
        from: filters.from,
        to: filters.to,
        state: filters.state,
        reviewerType: filters.reviewerType,
        excludeBots: filters.excludeBots,
        tab: filters.tab,
        q: filters.q,
      },
      createdAt: new Date().toISOString(),
    };
    setViews((prev) => [view, ...prev]);
    toast.success("View saved", { description: name });
  };

  const apply = (view: SavedView) => {
    setFilters({
      orgs: null,
      repos: null,
      users: null,
      sprint: null,
      from: null,
      to: null,
      state: null,
      reviewerType: null,
      excludeBots: null,
      q: null,
      tab: null,
      ...view.filters,
    });
    setOpen(false);
    toast.success("View applied", { description: view.name });
  };

  const remove = (id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  const hasFilters =
    filters.orgs.length > 0 ||
    filters.repos.length > 0 ||
    filters.users.length > 0 ||
    filters.state !== "all" ||
    filters.reviewerType !== "all" ||
    !!filters.q ||
    !!filters.sprint ||
    !!filters.from ||
    !!filters.to;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Saved views"
      >
        <Bookmark className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Views</span>
        {views.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {views.length}
          </span>
        )}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-border bg-card shadow-xl animate-fade-in"
        >
          <div className="border-b border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={saveCurrent}
              disabled={!hasFilters}
              className="w-full justify-start"
              title={
                hasFilters ? "Save current filters" : "Apply some filters first"
              }
            >
              <BookmarkCheck className="h-3.5 w-3.5" />
              Save current view
            </Button>
          </div>
          {views.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              No saved views yet. Apply filters then save.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto p-1">
              {views.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-1 rounded-md p-1 hover:bg-accent"
                >
                  <button
                    onClick={() => apply(v)}
                    className="flex-1 truncate text-left text-sm px-2 py-1"
                    title={v.name}
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() => remove(v.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${v.name}`}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
