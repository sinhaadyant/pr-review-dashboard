"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const PIECE_COUNT = 60;
const DURATION_MS = 2800;

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

interface Piece {
  left: number;
  size: number;
  delay: number;
  duration: number;
  tx: number;
  rot: number;
  color: string;
}

/**
 * Renders a single burst of confetti pieces. Mount with `key` set to a unique
 * value (e.g., the sprintId) so React re-mounts and the animation replays.
 *
 * Honors `prefers-reduced-motion` — falls back to a 1s subtle highlight in
 * the corner with a "100% merged" pill via aria-live, but skips the falling
 * pieces.
 */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const reduce = usePrefersReducedMotion();
  const [done, setDone] = useState(false);
  // Pieces are generated in a mount effect (Math.random is impure and
  // therefore can't run inside the render body OR a useMemo under React 19's
  // `react-hooks/purity` rule). Until generation completes we render nothing
  // for the falling layer.
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    // Schedule the random piece generation inside an rAF so the setState
    // doesn't fire synchronously inside the effect body (React 19 strict
    // effect rule). One frame of delay is imperceptible for confetti.
    const raf = requestAnimationFrame(() => {
      if (reduce) {
        setPieces([]);
        return;
      }
      setPieces(
        Array.from({ length: PIECE_COUNT }, (_, i) => ({
          left: Math.random() * 100,
          size: 6 + Math.random() * 8,
          delay: Math.random() * 600,
          duration: 1800 + Math.random() * 1500,
          tx: (Math.random() - 0.5) * 60,
          rot: 360 + Math.random() * 720,
          color: COLORS[i % COLORS.length],
        })),
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDone(true);
      onDone?.();
    }, DURATION_MS + 200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  if (done) return null;

  if (reduce) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed left-1/2 top-4 z-100 -translate-x-1/2 rounded-full border border-success/40 bg-success/10 px-4 py-1.5 text-sm font-medium text-success animate-fade-in"
      >
        Sprint fully merged
      </div>
    );
  }

  if (!pieces) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-100 overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}vw`,
              width: `${p.size}px`,
              height: `${p.size * 1.6}px`,
              background: p.color,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              "--tx": `${p.tx}vw`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener?.("change", cb);
      return () => m.removeEventListener?.("change", cb);
    },
    () =>
      typeof window === "undefined"
        ? false
        : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
