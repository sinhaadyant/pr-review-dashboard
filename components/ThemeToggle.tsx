"use client";

import { Contrast, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useContrast } from "@/hooks/use-contrast";
import { Button } from "./ui/button";

// `mounted` flag via useSyncExternalStore — false on server, true after hydration.
// This avoids the classic `useEffect(() => setMounted(true))` pattern that
// React 19's strict effect rule flags as setState-in-effect.
const subscribeMount = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [contrast, setContrast] = useContrast();
  const mounted = useSyncExternalStore(
    subscribeMount,
    getSnapshot,
    getServerSnapshot,
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

  if (!mounted) return <div className="h-9 w-9" />;

  const Icon =
    theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        title={`Theme: ${theme} · Contrast: ${contrast}`}
        aria-label="Theme and contrast settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon className="h-4 w-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-border bg-card shadow-xl animate-fade-in"
        >
          <div className="border-b border-border p-1">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Theme
            </div>
            {(["light", "dark", "system"] as const).map((t) => {
              const Icon = t === "system" ? Monitor : t === "dark" ? Moon : Sun;
              return (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm capitalize hover:bg-accent ${
                    t === theme ? "bg-accent" : ""
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {t}
                </button>
              );
            })}
          </div>
          <div className="p-1">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Contrast
            </div>
            {(["default", "high"] as const).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setContrast(c);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm capitalize hover:bg-accent ${
                  c === contrast ? "bg-accent" : ""
                }`}
              >
                <Contrast className="h-3.5 w-3.5 text-muted-foreground" />
                {c === "default" ? "Default" : "High contrast"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
