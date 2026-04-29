import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import {
  getCurrentUser,
  getLastRateLimit,
  getTokenPoolSize,
} from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthCheck {
  ok: boolean;
  detail?: string;
}

export async function GET(req: Request) {
  const started = Date.now();
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";

  const tokenPoolSize = getTokenPoolSize();
  const tokenConfigured = tokenPoolSize > 0;

  const checks: Record<string, HealthCheck> = {
    token: {
      ok: tokenConfigured,
      detail: tokenConfigured
        ? `${tokenPoolSize} token${tokenPoolSize === 1 ? "" : "s"} configured`
        : "GITHUB_TOKEN(S) not set",
    },
    cache: { ok: true, detail: process.env.CACHE_PROVIDER ?? "memory" },
  };

  if (deep && tokenConfigured) {
    try {
      const user = await getCurrentUser();
      checks.github = {
        ok: true,
        detail: `Authenticated as @${user.login}`,
      };
    } catch (err) {
      checks.github = {
        ok: false,
        detail: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  const rate = getLastRateLimit();
  if (rate) {
    checks.rateLimit = {
      ok: rate.remaining > 100,
      detail: `${rate.remaining}/${rate.limit} remaining (resets ${new Date(rate.reset).toISOString()})`,
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      ok: allOk,
      version: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
      uptime: Math.floor(process.uptime()),
      cacheStats: cache.getStats(),
      tokenPoolSize,
      checks,
      durationMs: Date.now() - started,
    },
    { status: allOk ? 200 : 503 },
  );
}
