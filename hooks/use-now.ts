"use client";

import { useEffect, useState } from "react";

/**
 * Returns `Date.now()` and re-renders the consumer at most once per
 * `intervalMs` so derived "x days ago" labels stay fresh without making each
 * render impure.
 *
 * (Implemented with `useState` + `setInterval` rather than
 * `useSyncExternalStore` because `Date.now()` returns a different value on
 * every call, which would violate the snapshot-stability contract.)
 */
export function useNow(intervalMs = 60_000): number {
  // Lazy initializer keeps the first paint pure from the consumer's POV —
  // the `Date.now()` call happens once during mount, not on every render.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
