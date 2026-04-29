"use client";

import { Download, FileSpreadsheet, MessageSquare, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { buildAggregateQuery, type Filters } from "@/hooks/use-filters";
import { useState } from "react";

type Grain = "comment" | "pr" | "user";

const GRAIN_OPTIONS: {
  value: Grain;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "comment",
    title: "Comment grain",
    description:
      "One row per comment. Best for deep analysis of who said what, when.",
    icon: MessageSquare,
  },
  {
    value: "pr",
    title: "PR grain",
    description:
      "One row per PR with rolled-up counts. Best for sprint reports.",
    icon: FileSpreadsheet,
  },
  {
    value: "user",
    title: "User summary",
    description:
      "One row per contributor with PR + comment totals. Best for performance reviews.",
    icon: User,
  },
];

export function ExportButton({ filters }: { filters: Filters }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const download = async (grain: Grain) => {
    setBusy(true);
    setOpen(false);
    try {
      const query = buildAggregateQuery(filters);
      const url = `/api/export?${query}${query ? "&" : ""}grain=${grain}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const cd = res.headers.get("content-disposition") ?? "";
      const fnMatch = /filename="?([^"]+)"?/i.exec(cd);
      const filename = fnMatch?.[1] ?? `pr-analytics-${grain}.csv`;
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("CSV downloaded", { description: filename });
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={busy}
        title="Export CSV"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose export format"
          className="fixed inset-0 z-80 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl animate-scale-in"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Export CSV</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick the row grain that matches your analysis. All exports respect
              the current filter set.
            </p>
            <div className="mt-4 space-y-2">
              {GRAIN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  disabled={busy}
                  onClick={() => download(o.value)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <o.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{o.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.description}
                    </div>
                  </div>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
