"use client";

import { useQuery } from "@tanstack/react-query";
import type { DiscoveryResult } from "@/lib/types";

export function useDiscover() {
  return useQuery<DiscoveryResult>({
    queryKey: ["discover"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/discover", { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 60 * 60 * 1000,
  });
}

interface AppConfig {
  appName: string;
  sprints: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    timezone: string;
  }[];
  activeSprintId: string;
  allowPrivateRepos: boolean;
  discoveryAvailable: boolean;
}

export function useConfig() {
  return useQuery<AppConfig>({
    queryKey: ["config"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/config", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: Infinity,
  });
}
