import { LRUCache } from "lru-cache";

interface Bucket {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 60);
const WINDOW_MS = 60_000;

const buckets = new LRUCache<string, Bucket>({
  max: 10_000,
  ttl: WINDOW_MS * 2,
});

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  ip: string,
  perMin = RATE_LIMIT_PER_MIN,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: perMin - 1, retryAfterSec: 0 };
  }
  if (bucket.count >= perMin) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count++;
  return { allowed: true, remaining: perMin - bucket.count, retryAfterSec: 0 };
}

const refreshBuckets = new LRUCache<string, number>({
  max: 10_000,
  ttl: 120_000,
});

/** Stricter throttle for `?forceRefresh=1` — 1 per 60s per (ip, key) */
export function checkRefreshThrottle(ip: string, key: string): RateLimitResult {
  const composite = `${ip}::${key}`;
  const now = Date.now();
  const last = refreshBuckets.get(composite);
  if (!last || now - last >= 60_000) {
    refreshBuckets.set(composite, now);
    return { allowed: true, remaining: 0, retryAfterSec: 0 };
  }
  return {
    allowed: false,
    remaining: 0,
    retryAfterSec: Math.ceil((60_000 - (now - last)) / 1000),
  };
}

export function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
