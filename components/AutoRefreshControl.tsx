"use client";

import { Radio, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAggregate } from "@/hooks/use-aggregate";
import { useFilters } from "@/hooks/use-filters";
import { useLocalStorageString } from "@/hooks/use-local-storage";
import { Button } from "./ui/button";

const STORAGE_KEY = "pr-dashboard.auto-refresh-secs";

const OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 30, label: "Every 30s" },
  { value: 60, label: "Every 1m" },
  { value: 300, label: "Every 5m" },
  { value: 900, label: "Every 15m" },
];

/**
 * Polls the aggregate query at a user-selected interval. Persists the
 * selection to localStorage. While active, shows a small pulsing indicator.
 */
export function AutoRefreshControl() {
  const [filters] = useFilters();
  const { forceRefresh, isFetching } = useAggregate(filters);
  const [storedSecs, setStoredSecs] = useLocalStorageString(STORAGE_KEY, "0");
  const secs = Number.isFinite(Number(storedSecs))
    ? Math.max(0, Number(storedSecs))
    : 0;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => {
      if (!document.hidden && !isFetching) {
        forceRefresh().catch(() => {});
      }
    }, secs * 1000);
    return () => clearInterval(id);
  }, [secs, forceRefresh, isFetching]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const update = (v: number) => {
    setStoredSecs(String(v));
    setOpen(false);
  };

  const active = secs > 0;
  const activeLabel = OPTIONS.find((o) => o.value === secs)?.label ?? "Off";

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Auto-refresh"
      >
        <span className="relative flex h-3.5 w-3.5 items-center justify-center">
          <Radio
            className={`h-3.5 w-3.5 ${
              active ? "text-success" : "text-muted-foreground"
            }`}
          />
          {active && (
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-success/75" />
          )}
        </span>
        <span className="hidden md:inline">{activeLabel}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-border bg-card shadow-xl animate-fade-in"
        >
          <div className="p-1">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => update(o.value)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent ${
                  o.value === secs ? "bg-accent" : ""
                }`}
              >
                {o.label}
                {o.value === secs && (
                  <span className="text-xs text-success">●</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
