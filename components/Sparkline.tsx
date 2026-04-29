"use client";

/**
 * Tiny inline sparkline (no external chart lib needed). Renders a smoothed
 * polyline against an auto-scaled y-axis. Values are bucket counts.
 */
export function Sparkline({
  values,
  width = 80,
  height = 24,
  color = "hsl(var(--chart-1))",
  ariaLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
}) {
  if (!values || values.length === 0) {
    return (
      <div
        aria-hidden
        className="inline-block rounded bg-muted/40"
        style={{ width, height }}
      />
    );
  }
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Build a closed path for the area fill.
  const areaPath = `M0,${height} L${points
    .split(" ")
    .map((p) => p)
    .join(" L")} L${width},${height} Z`;
  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "trend sparkline"}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path d={areaPath} fill={color} fillOpacity={0.15} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
