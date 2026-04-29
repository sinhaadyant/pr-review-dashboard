"use client";

import { useEffect } from "react";
import { useLocalStorageString } from "./use-local-storage";

export type Contrast = "default" | "high";

const STORAGE_KEY = "pr-dashboard.contrast";

function isContrast(s: string): s is Contrast {
  return s === "default" || s === "high";
}

export function useContrast(): [Contrast, (c: Contrast) => void] {
  const [stored, setStored] = useLocalStorageString(STORAGE_KEY, "default");
  const contrast: Contrast = isContrast(stored) ? stored : "default";

  useEffect(() => {
    document.documentElement.dataset.contrast = contrast;
  }, [contrast]);

  return [contrast, setStored];
}
