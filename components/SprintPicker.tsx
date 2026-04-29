"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFilters } from "@/hooks/use-filters";
import { useConfig } from "@/hooks/use-discover";
import { cn } from "@/lib/utils";

export function SprintPicker() {
  const [filters, setFilters] = useFilters();
  const { data: config } = useConfig();
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

  const activeId = filters.sprint ?? config?.activeSprintId ?? null;
  const active = config?.sprints.find((s) => s.id === activeId);
  const isCustom = !!(filters.from && filters.to);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9 text-sm font-medium hover:bg-accent transition-colors"
      >
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <span className="truncate max-w-56">
          {isCustom
            ? `${filters.from} → ${filters.to}`
            : (active?.name ?? "Pick sprint")}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-border bg-card shadow-xl animate-fade-in">
          <div className="p-1">
            {config?.sprints.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setFilters({ sprint: s.id, from: null, to: null });
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                  s.id === activeId && !isCustom && "bg-accent",
                )}
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.startDate.slice(0, 10)} → {s.endDate.slice(0, 10)}
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-border p-3 text-xs text-muted-foreground">
            Custom date range available via URL params:{" "}
            <code>?from=&amp;to=</code>
          </div>
        </div>
      )}
    </div>
  );
}
