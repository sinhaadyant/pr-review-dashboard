"use client";

import { useQuery } from "@tanstack/react-query";
import type { AggregatedResponse } from "@/lib/types";
import { buildAggregateQuery, type Filters } from "./use-filters";

/**
 * Fetches a SECOND aggregate response for the same filters but a different
 * sprint (`compareSprintId`). Used by `CompareDeltaStrip`. Returns `undefined`
 * data while disabled or while loading.
 */
export function useCompareAggregate(
  filters: Filters,
  compareSprintId: string | null,
) {
  // Build the comparison query: same filters, but override `sprint` and
  // strip any `from`/`to` so we definitely use a sprint window.
  const compareFilters: Filters = {
    ...filters,
    sprint: compareSprintId,
    from: null,
    to: null,
    // Don't propagate the compare flag itself.
    compareWith: null,
  };
  const query = buildAggregateQuery(compareFilters);

  return useQuery<AggregatedResponse>({
    queryKey: ["aggregate-compare", query, compareSprintId],
    enabled: !!compareSprintId,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/github/aggregate?${query}`, { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
