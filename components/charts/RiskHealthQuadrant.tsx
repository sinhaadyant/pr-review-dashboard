"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Crosshair } from "lucide-react";
import {
  computeHealth,
  computeRisk,
  DEFAULT_WEIGHTS,
} from "@/lib/intelligence";
import type { NormalizedPR } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
};

const ANIM_MS = 600;

interface Props {
  prs: NormalizedPR[];
}

interface Point {
  risk: number;
  health: number;
  title: string;
  repo: string;
  number: number;
  state: string;
  htmlUrl: string;
}

const COLOR_BY_STATE: Record<string, string> = {
  open: "hsl(var(--warning))",
  merged: "hsl(var(--chart-1))",
  closed: "hsl(var(--muted-foreground))",
};

/**
 * Two-dimensional view of every PR plotted by its risk and health scores.
 * The reference lines (medium thresholds from DEFAULT_WEIGHTS) split the
 * plane into four quadrants:
 *
 *   high-health, low-risk  → "Solid landings"      (top-left)
 *   high-health, high-risk → "Risky but reviewed"  (top-right)
 *   low-health, high-risk  → "Danger zone"         (bottom-right)
 *   low-health, low-risk   → "Forgotten chores"    (bottom-left)
 *
 * Both scores are computed from existing per-PR fields, so this is a derived
 * view with no extra fetches.
 */
export function RiskHealthQuadrant({ prs }: Props) {
  const points: Point[] = useMemo(
    () =>
      prs.map((p) => ({
        risk: computeRisk(p).raw,
        health: computeHealth(p).raw,
        title: p.title,
        repo: p.fullName,
        number: p.number,
        state: p.state,
        htmlUrl: p.htmlUrl,
      })),
    [prs],
  );

  const riskMid = DEFAULT_WEIGHTS.riskThresholds.medium;
  const healthMid = DEFAULT_WEIGHTS.healthThresholds.medium;

  const counts = useMemo(() => {
    let danger = 0;
    let solid = 0;
    let risky = 0;
    let forgotten = 0;
    for (const p of points) {
      const highRisk = p.risk >= riskMid;
      const highHealth = p.health >= healthMid;
      if (highRisk && !highHealth) danger++;
      else if (!highRisk && highHealth) solid++;
      else if (highRisk && highHealth) risky++;
      else forgotten++;
    }
    return { danger, solid, risky, forgotten };
  }, [points, riskMid, healthMid]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5 text-destructive" />
          Risk × Health quadrant
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {points.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No PRs to plot
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  dataKey="risk"
                  name="Risk score"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  label={{
                    value: "Risk score →",
                    position: "insideBottom",
                    offset: -2,
                    fontSize: 11,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="health"
                  name="Health score"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  label={{
                    value: "Health score ↑",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <ZAxis range={[40, 40]} />
                <ReferenceLine
                  x={riskMid}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
                <ReferenceLine
                  y={healthMid}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={TOOLTIP_STYLE}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as Point;
                    return (
                      <div className="rounded-md border border-border bg-card p-2 text-xs shadow-lg max-w-xs">
                        <div className="font-medium">
                          {p.repo}#{p.number}
                        </div>
                        <div className="mt-1 truncate text-muted-foreground">
                          {p.title}
                        </div>
                        <div className="mt-1.5 tabular-nums">
                          Risk{" "}
                          <span className="text-destructive">{p.risk}</span> ·
                          Health{" "}
                          <span className="text-success">{p.health}</span> ·{" "}
                          {p.state}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={points}
                  animationDuration={ANIM_MS}
                  onClick={(d) => {
                    const url = (d as unknown as Point).htmlUrl;
                    if (url) window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  cursor="pointer"
                >
                  {points.map((p, i) => (
                    <Cell
                      key={i}
                      fill={COLOR_BY_STATE[p.state] ?? "hsl(var(--chart-1))"}
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Quadrant
            label="Solid landings"
            sub="High health · low risk"
            count={counts.solid}
            tone="success"
          />
          <Quadrant
            label="Risky but reviewed"
            sub="High health · high risk"
            count={counts.risky}
            tone="warning"
          />
          <Quadrant
            label="Forgotten chores"
            sub="Low health · low risk"
            count={counts.forgotten}
            tone="default"
          />
          <Quadrant
            label="Danger zone"
            sub="Low health · high risk"
            count={counts.danger}
            tone="destructive"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Quadrant({
  label,
  sub,
  count,
  tone,
}: {
  label: string;
  sub: string;
  count: number;
  tone: "success" | "warning" | "default" | "destructive";
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5"
        : tone === "destructive"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-background";
  return (
    <div className={`rounded-md border p-2 ${cls}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums font-semibold">{count}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
