"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useAggregate } from "@/hooks/use-aggregate";
import { type Filters } from "@/hooks/use-filters";

export function RefreshButton({ filters }: { filters: Filters }) {
  const { isFetching, forceRefresh, data, error } = useAggregate(filters);
  const wasFetching = useRef(false);
  const lastNotifiedKey = useRef<string | null>(null);

  // Toast on completion of a force refresh (only when triggered from this button)
  useEffect(() => {
    if (wasFetching.current && !isFetching && data) {
      const key = `${data.cache.generatedAt}:${data.stats.totalPRs}`;
      if (key !== lastNotifiedKey.current) {
        lastNotifiedKey.current = key;
        // Only toast if we just finished a refresh (wasFetching transition)
        toast.success("Refreshed", {
          description: `${data.stats.totalPRs} PRs · ${data.stats.reposCount} repos`,
        });
      }
    }
    wasFetching.current = isFetching;
  }, [isFetching, data]);

  const onClick = async () => {
    try {
      await forceRefresh();
    } catch (err) {
      const e = err as Error & { status?: number; retryAfterSec?: number };
      if (e.status === 429) {
        toast.warning("Refresh rate-limited", {
          description: e.retryAfterSec
            ? `Try again in ${e.retryAfterSec}s`
            : undefined,
        });
        return;
      }
      toast.error("Refresh failed", {
        description: e.message ?? "Unknown error",
      });
    }
  };

  // Surface aggregate errors as toast (once)
  useEffect(() => {
    if (error) {
      toast.error("Failed to load", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [error]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isFetching}
      aria-label="Refresh data"
      title="Refresh data (r)"
    >
      <RefreshCw
        className={`h-4 w-4 transition-transform ${
          isFetching ? "animate-spin" : ""
        }`}
      />
      <span className="hidden sm:inline">
        {isFetching ? "Refreshing…" : "Refresh"}
      </span>
    </Button>
  );
}
