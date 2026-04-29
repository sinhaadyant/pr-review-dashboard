"use client";

import { useEffect } from "react";
import { useLocalStorageString } from "./use-local-storage";

export type Density = "comfortable" | "compact";

const STORAGE_KEY = "pr-dashboard.density";

function isDensity(s: string): s is Density {
  return s === "comfortable" || s === "compact";
}

/**
 * Density preference persisted to localStorage and reflected on
 * <html data-density="..."> for global CSS targeting.
 */
export function useDensity(): [Density, (d: Density) => void] {
  const [stored, setStored] = useLocalStorageString(STORAGE_KEY, "comfortable");
  const density: Density = isDensity(stored) ? stored : "comfortable";

  // Reflect to <html data-density="…"> as a side-effect of the value (sync to
  // external system, no setState — passes the React 19 effect rule).
  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  return [density, setStored];
}
