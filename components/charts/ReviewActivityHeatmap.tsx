"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import type { NormalizedPR } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  prs: NormalizedPR[];
}

/**
 * 7 × 24 weekday-by-hour heatmap of human review-comment timestamps. Cell
 * intensity is normalized against the busiest cell, so it works whether the
 * window has 50 comments or 50,000. All times are rendered in the user's
 * local timezone.
 *
 * Surfaces patterns like "we get reviews mostly Tue-Thu mornings" or
 * "weekend coverage is gone" without any extra plumbing.
 */
export function ReviewActivityHeatmap({ prs }: Props) {
  const { matrix, max, total, peak } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0),
    );
    let total = 0;
    for (const pr of prs) {
      for (const c of pr.comments) {
        if (c.isBot) continue;
        const t = new Date(c.createdAt);
        if (Number.isNaN(t.getTime())) continue;
        m[t.getDay()][t.getHours()]++;
        total++;
      }
    }
    let max = 0;
    let peak: { day: number; hour: number; count: number } | null = null;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (m[d][h] > max) {
          max = m[d][h];
          peak = { day: d, hour: h, count: m[d][h] };
        }
      }
    }
    return { matrix: m, max, total, peak };
  }, [prs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-chart-2" />
            Review activity heatmap
          </span>
          {peak && (
            <span className="text-xs font-normal text-muted-foreground">
              Peak: {DAYS[peak.day]} {peak.hour}:00 · {peak.count} comment
              {peak.count === 1 ? "" : "s"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No human comments to plot.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-[2px] text-[10px]">
              <thead>
                <tr>
                  <th className="text-left font-normal text-muted-foreground" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <th
                      key={h}
                      className="font-normal text-muted-foreground tabular-nums"
                      style={{ minWidth: 18 }}
                    >
                      {h % 3 === 0 ? h : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, d) => (
                  <tr key={day}>
                    <th className="pr-2 text-left font-medium text-muted-foreground">
                      {day}
                    </th>
                    {matrix[d].map((v, h) => {
                      const opacity = max === 0 ? 0 : v / max;
                      return (
                        <td
                          key={h}
                          title={`${day} ${h}:00 — ${v} comment${v === 1 ? "" : "s"}`}
                          className="rounded-sm transition-colors"
                          style={{
                            background: `hsl(var(--chart-2) / ${0.04 + opacity * 0.9})`,
                            height: 22,
                          }}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex h-2 w-32 overflow-hidden rounded-full">
                {[0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.95].map((t, i) => (
                  <div
                    key={i}
                    className="h-full flex-1"
                    style={{ background: `hsl(var(--chart-2) / ${t})` }}
                  />
                ))}
              </div>
              <span>More</span>
              <span className="ml-auto tabular-nums">
                {total} comment{total === 1 ? "" : "s"} · local time
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
