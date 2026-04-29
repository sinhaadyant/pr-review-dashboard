"use client";

import { useEffect, useState } from "react";

/**
 * Slim animated progress bar pinned to the top of the viewport.
 * Visible whenever `active` is true. Smoothly fades out on completion.
 */
export function TopProgressBar({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf: number;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (active) {
      setVisible(true);
      setProgress(8);
      const tick = () => {
        setProgress((p) => {
          // Asymptotic approach to 90% so it never "completes" while fetching
          const next = p + Math.max(0.4, (90 - p) * 0.04);
          return next < 90 ? next : 90;
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else if (visible) {
      setProgress(100);
      timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [active, visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed left-0 right-0 top-0 z-50 h-0.5 bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-linear-to-r from-chart-1 via-chart-3 to-chart-1 shadow-[0_0_8px_hsl(var(--chart-1)/0.6)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: active ? 1 : 0,
        }}
      />
    </div>
  );
}
