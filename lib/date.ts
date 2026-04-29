import { Sprint } from "./types";
import sprintConfigJson from "@/data/sprint.json";
import type { SprintConfig } from "./types";

const sprintConfig = sprintConfigJson as SprintConfig;

export function getSprintConfig(): SprintConfig {
  return sprintConfig;
}

export function getSprintById(id: string): Sprint | null {
  return sprintConfig.sprints.find((s) => s.id === id) ?? null;
}

export function getActiveSprint(): Sprint {
  const active = getSprintById(sprintConfig.activeSprintId);
  if (!active) {
    return sprintConfig.sprints[0];
  }
  return active;
}

export function isWithinRange(
  iso: string,
  startISO: string,
  endISO: string,
): boolean {
  const t = Date.parse(iso);
  return t >= Date.parse(startISO) && t <= Date.parse(endISO);
}

export function hoursBetween(fromISO: string, toISO: string): number {
  return (Date.parse(toISO) - Date.parse(fromISO)) / 36e5;
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
