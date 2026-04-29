"use client";

/**
 * Lightweight SVG skeletons that mimic the structure of the real charts.
 * Used while data is loading so layout doesn't pop in.
 */

export function BarChartSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="h-80 p-3" aria-hidden>
      <div className="flex h-full flex-col justify-between">
        {Array.from({ length: rows }).map((_, i) => {
          const widthPct = 35 + ((i * 17) % 60);
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-16 rounded bg-muted shimmer" />
              <div
                className="h-3 rounded bg-muted shimmer"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineChartSkeleton() {
  return (
    <div className="h-72 p-3" aria-hidden>
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {[40, 80, 120, 160].map((y) => (
          <line
            key={y}
            x1={0}
            x2={400}
            y1={y}
            y2={y}
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
          />
        ))}
        <path
          d="M0,150 C 40,140 80,80 120,90 S 200,40 240,60 S 320,120 400,80"
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={2}
          opacity={0.4}
          className="animate-pulse-soft"
        />
      </svg>
    </div>
  );
}

export function PieChartSkeleton() {
  return (
    <div className="flex h-72 items-center justify-center" aria-hidden>
      <div className="relative h-40 w-40">
        <div className="absolute inset-0 animate-pulse-soft rounded-full bg-muted" />
        <div className="absolute inset-6 rounded-full bg-card" />
      </div>
    </div>
  );
}
