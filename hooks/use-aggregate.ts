"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { AggregatedResponse } from "@/lib/types";
import { buildAggregateQuery, type Filters } from "./use-filters";

export function useAggregate(filters: Filters) {
  const query = buildAggregateQuery(filters);
  const qc = useQueryClient();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const result = useQuery<AggregatedResponse>({
    queryKey: ["aggregate", query, refreshNonce],
    queryFn: async ({ signal }) => {
      const force = refreshNonce > 0 ? `${query ? "&" : ""}forceRefresh=1` : "";
      const res = await fetch(`/api/github/aggregate?${query}${force}`, {
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error ?? `HTTP ${res.status}`) as Error & {
          status?: number;
          retryAfterSec?: number;
        };
        err.status = res.status;
        err.retryAfterSec = body.retryAfterSec;
        throw err;
      }
      return res.json();
    },
    placeholderData: (previous) => previous,
  });

  const forceRefresh = useCallback(async () => {
    setRefreshNonce((n) => n + 1);
    // Invalidate to drop the previous query result so loader shows
    await qc.invalidateQueries({ queryKey: ["aggregate", query] });
  }, [qc, query]);

  return { ...result, forceRefresh };
}
