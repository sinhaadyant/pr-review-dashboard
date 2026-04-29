import { LRUCache } from "lru-cache";
import { logger } from "./logger";

interface CacheEntry<T> {
  data: T;
  storedAt: number;
  expiresAt: number;
  etag?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  size: number;
}

export class MemoryCache {
  private store: LRUCache<string, CacheEntry<unknown>>;
  private inFlight = new Map<string, Promise<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, staleHits: 0, size: 0 };

  constructor(maxItems = 1000) {
    this.store = new LRUCache({
      max: maxItems,
      ttl: 1000 * 60 * 60 * 4,
      ttlAutopurge: true,
    });
  }

  get<T>(
    key: string,
  ): { data: T; stale: boolean; storedAt: number; expiresAt: number } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    const now = Date.now();
    const stale = now > entry.expiresAt;
    if (stale) this.stats.staleHits++;
    else this.stats.hits++;
    return {
      data: entry.data,
      stale,
      storedAt: entry.storedAt,
      expiresAt: entry.expiresAt,
    };
  }

  set<T>(key: string, data: T, ttlMs: number, etag?: string): void {
    const now = Date.now();
    this.store.set(key, {
      data,
      storedAt: now,
      expiresAt: now + ttlMs,
      etag,
    });
    this.stats.size = this.store.size;
  }

  delete(key: string): void {
    this.store.delete(key);
    this.stats.size = this.store.size;
  }

  getEtag(key: string): string | undefined {
    const entry = this.store.get(key) as CacheEntry<unknown> | undefined;
    return entry?.etag;
  }

  /** Coalesce duplicate in-flight requests for the same key. */
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      logger.debug({ key }, "cache.dedupe.hit");
      return existing as Promise<T>;
    }
    const p = fn().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  getStats(): CacheStats {
    return { ...this.stats, size: this.store.size };
  }

  clear(): void {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, staleHits: 0, size: 0 };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __pr_cache__: MemoryCache | undefined;
}

export const cache = globalThis.__pr_cache__ ?? new MemoryCache();
if (!globalThis.__pr_cache__) globalThis.__pr_cache__ = cache;

export const TTL_AGGREGATE_MS = 20 * 60 * 1000;
export const TTL_DISCOVERY_MS = 60 * 60 * 1000;
export const TTL_REPO_META_MS = 10 * 60 * 1000;

export const cacheKeys = {
  aggregateAll: (sprint: string, hash: string) =>
    `all:sprint:${sprint}:filters:${hash}`,
  aggregateRepo: (fullName: string, sprint: string, hash: string) =>
    `repo:${fullName}:sprint:${sprint}:filters:${hash}`,
  aggregateOrg: (org: string, sprint: string, hash: string) =>
    `org:${org}:sprint:${sprint}:filters:${hash}`,
  discovery: () => `discovery:token`,
  repoMeta: (fullName: string) => `repo-meta:${fullName}`,
  etag: (url: string) => `etag:${url}`,
};
