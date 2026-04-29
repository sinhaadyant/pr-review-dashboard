"use client";

import { useCallback, useSyncExternalStore } from "react";

type Subscriber = () => void;

const subscribers = new Map<string, Set<Subscriber>>();

// Per-key cache so getSnapshot returns a stable reference between calls
// (required by useSyncExternalStore — otherwise React enters an infinite
// re-render loop).
interface CacheEntry {
  raw: string | null;
  parsed: unknown;
}
const parseCache = new Map<string, CacheEntry>();

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getCachedParsed<T>(
  key: string,
  parse: (raw: string | null) => T,
  fallback: T,
): T {
  const raw = readRaw(key);
  const entry = parseCache.get(key);
  if (entry && entry.raw === raw) {
    return entry.parsed as T;
  }
  let parsed: T;
  try {
    parsed = parse(raw);
  } catch {
    parsed = fallback;
  }
  parseCache.set(key, { raw, parsed });
  return parsed;
}

function invalidate(key: string) {
  parseCache.delete(key);
}

function makeSubscribe(key: string) {
  return (cb: Subscriber) => {
    let set = subscribers.get(key);
    if (!set) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(cb);

    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        invalidate(key);
        cb();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      set?.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };
}

function notify(key: string) {
  invalidate(key);
  subscribers.get(key)?.forEach((cb) => cb());
}

/**
 * SSR-safe localStorage hook backed by `useSyncExternalStore`. The setter
 * writes to localStorage and triggers a same-tab sync.
 *
 * `parse` MUST be a pure function — its result is cached per (key, rawString)
 * so that `getSnapshot` returns a stable reference (avoiding the "result of
 * getSnapshot should be cached" warning and infinite render loops).
 */
export function useLocalStorage<T>(
  key: string,
  parse: (raw: string | null) => T,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    makeSubscribe(key),
    () => getCachedParsed(key, parse, defaultValue),
    () => defaultValue,
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // ignore quota errors
      }
      notify(key);
    },
    [key, value],
  );

  return [value, set];
}

/**
 * Like `useLocalStorage` but stores raw strings (no JSON wrapping). Strings
 * are primitives so the snapshot is naturally stable for unchanged values.
 */
export function useLocalStorageString(
  key: string,
  defaultValue: string,
): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    makeSubscribe(key),
    () => {
      try {
        return localStorage.getItem(key) ?? defaultValue;
      } catch {
        return defaultValue;
      }
    },
    () => defaultValue,
  );

  const set = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // ignore
      }
      notify(key);
    },
    [key],
  );

  return [value, set];
}
