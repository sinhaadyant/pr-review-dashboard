"use client";

import { Keyboard, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useFilters } from "@/hooks/use-filters";
import { useAggregate } from "@/hooks/use-aggregate";
import { Button } from "./ui/button";

const SHORTCUTS = [
  { keys: ["/"], description: "Focus search" },
  { keys: ["Esc"], description: "Clear search (when focused)" },
  { keys: ["r"], description: "Refresh data" },
  {
    keys: ["1", "2", "3"],
    description: "Switch tabs (Users, Repos, Activity)",
  },
  { keys: ["t"], description: "Toggle theme" },
  { keys: ["?"], description: "Show this help" },
];

export function KeyboardShortcuts() {
  const [filters] = useFilters();
  const { forceRefresh, isFetching } = useAggregate(filters);
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" && !inField) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      } else if (e.key === "r" && !inField && !isFetching) {
        e.preventDefault();
        forceRefresh().catch(() => {});
      } else if (e.key === "t" && !inField) {
        e.preventDefault();
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [forceRefresh, isFetching, open, resolvedTheme, setTheme]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl animate-scale-in"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {SHORTCUTS.map((s) => (
            <li
              key={s.description}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">{s.description}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Press{" "}
          <kbd className="rounded border border-border bg-muted px-1 font-mono">
            ?
          </kbd>{" "}
          any time to toggle.
        </p>
      </div>
    </div>
  );
}
