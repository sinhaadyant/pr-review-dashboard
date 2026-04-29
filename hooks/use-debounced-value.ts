"use client";

import { useEffect, useState } from "react";

/**
 * Returns a value that lags `delayMs` behind its input. Useful for keeping
 * heavy derivations (filtering large lists, searching) off the keystroke
 * critical path.
 *
 * The returned value resolves immediately on the first render so the initial
 * paint isn't gated. When `delayMs <= 0` the snap is scheduled inside an
 * rAF callback so it doesn't violate the React 19 "no setState in effect
 * body" purity rule.
 */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (delayMs <= 0) {
      const raf = requestAnimationFrame(() => setDebounced(value));
      return () => cancelAnimationFrame(raf);
    }
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
