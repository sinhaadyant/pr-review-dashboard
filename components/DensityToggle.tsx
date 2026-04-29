"use client";

import { Rows3, Rows4 } from "lucide-react";
import { useDensity } from "@/hooks/use-density";
import { Button } from "./ui/button";

export function DensityToggle() {
  const [density, setDensity] = useDensity();
  const next = density === "comfortable" ? "compact" : "comfortable";
  const Icon = density === "comfortable" ? Rows3 : Rows4;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} density`}
      title={`Density: ${density} (click for ${next})`}
      onClick={() => setDensity(next)}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
