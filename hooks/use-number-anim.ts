"use client";

import { useLocalStorageString } from "./use-local-storage";

export type NumberAnimMode = "tween" | "flip";

const KEY = "pr-dashboard:num-anim";
const DEFAULT: NumberAnimMode = "tween";

/**
 * Persisted choice between the easeOut count-up tween (default) and the
 * per-digit flip animation for animated numerics on stat cards.
 */
export function useNumberAnimMode(): [NumberAnimMode, (m: NumberAnimMode) => void] {
  const [raw, setRaw] = useLocalStorageString(KEY, DEFAULT);
  const value: NumberAnimMode = raw === "flip" ? "flip" : "tween";
  return [value, (m) => setRaw(m)];
}
