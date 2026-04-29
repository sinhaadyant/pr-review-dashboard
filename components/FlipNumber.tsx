"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Per-digit "flip" animation, an alternative to the easeOut tween in
 * `useCountUp`. Each digit slot translates vertically when its value changes;
 * unchanged digits stay still. Reduces perceived motion (no constant counting)
 * but still signals an update.
 *
 * Honors `prefers-reduced-motion` (snaps without animation).
 */
export function FlipNumber({
  value,
  format = (n: number) => n.toLocaleString(),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = usePrefersReducedMotion();
  const text = format(value);
  if (reduce) return <span className={className}>{text}</span>;

  return (
    <span className={className} aria-label={text}>
      {Array.from(text).map((char, i) => (
        <FlipChar key={i} char={char} />
      ))}
    </span>
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

function FlipChar({ char }: { char: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(char);
  // Mirror `prev` into a state slot so we can render the previous digit
  // (the bottom of the flip stack) without violating the React 19 rule
  // against reading ref values during render.
  const [prevState, setPrevState] = useState(char);

  useEffect(() => {
    if (prev.current !== char) {
      const el = ref.current;
      if (el) {
        // Re-trigger CSS animation by toggling the class.
        el.classList.remove("flip-digit-stack");
        // force reflow
        void el.offsetWidth;
        el.classList.add("flip-digit-stack");
      }
      // Schedule the prev-state update inside an rAF so the new top digit
      // settles into place after the animation tick.
      const raf = requestAnimationFrame(() => {
        prev.current = char;
        setPrevState(char);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [char]);

  // Non-numeric characters (commas, decimal points, units) just render in place
  // — flipping them looks weird.
  const isDigit = /[0-9]/.test(char);
  if (!isDigit) {
    return <span aria-hidden>{char}</span>;
  }

  return (
    <span className="flip-digit" aria-hidden>
      <span ref={ref} className="flip-digit-stack">
        <span>{prevState}</span>
        <span>{char}</span>
      </span>
    </span>
  );
}
