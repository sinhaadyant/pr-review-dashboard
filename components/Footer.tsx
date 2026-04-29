"use client";

import { ExternalLink } from "lucide-react";
import type { AggregatedResponse } from "@/lib/types";

export function Footer({ data }: { data?: AggregatedResponse }) {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
  const refreshed = data?.cache.generatedAt
    ? new Date(data.cache.generatedAt).toLocaleString()
    : "—";
  return (
    <footer className="mt-10 border-t border-border bg-background/50">
      <div className="mx-auto max-w-[1400px] px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>Last refreshed: {refreshed}</span>
          {data && (
            <>
              <span className="opacity-50">•</span>
              <span>{data.stats.reposCount} repos</span>
              <span className="opacity-50">•</span>
              <span>{data.stats.contributorsCount} contributors</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>build {sha.slice(0, 7)}</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </footer>
  );
}
