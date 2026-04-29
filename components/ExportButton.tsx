"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { buildAggregateQuery, type Filters } from "@/hooks/use-filters";
import { useState } from "react";

export function ExportButton({ filters }: { filters: Filters }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const query = buildAggregateQuery(filters);
      const res = await fetch(`/api/export?${query}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const cd = res.headers.get("content-disposition") ?? "";
      const fnMatch = /filename="?([^"]+)"?/i.exec(cd);
      const filename = fnMatch?.[1] ?? "pr-analytics.csv";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy}>
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Export</span>
    </Button>
  );
}
