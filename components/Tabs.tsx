"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFilters } from "@/hooks/use-filters";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "users", label: "Users", hint: "Team performance" },
  { id: "repos", label: "Repos", hint: "Per-repo activity" },
  { id: "activity", label: "Activity", hint: "Charts & PR list" },
] as const;

export function Tabs() {
  const [filters, setFilters] = useFilters();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const updateIndicator = () => {
    const active = tabRefs.current[filters.tab];
    const container = containerRef.current;
    if (!active || !container) return;
    const a = active.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    setIndicator({ left: a.left - c.left, width: a.width });
  };

  useLayoutEffect(updateIndicator, [filters.tab]);

  useEffect(() => {
    const onResize = () => updateIndicator();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcut: number keys 1/2/3 switch tabs (only when not in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") setFilters({ tab: "users" });
      else if (e.key === "2") setFilters({ tab: "repos" });
      else if (e.key === "3") setFilters({ tab: "activity" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setFilters]);

  return (
    <div ref={containerRef} className="relative border-b border-border">
      <div className="flex items-end gap-1" role="tablist">
        {TABS.map((t, idx) => {
          const active = filters.tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              onClick={() => setFilters({ tab: t.id })}
              role="tab"
              aria-selected={active}
              aria-label={`${t.label} – ${t.hint}`}
              title={`${t.hint} (${idx + 1})`}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-md",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded border border-border px-1 text-[10px] font-mono opacity-50",
                  active && "opacity-80",
                )}
              >
                {idx + 1}
              </span>
            </button>
          );
        })}
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary transition-[left,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          left: indicator?.left ?? 0,
          width: indicator?.width ?? 0,
          opacity: indicator ? 1 : 0,
        }}
      />
    </div>
  );
}
