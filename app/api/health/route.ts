import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = cache.getStats();
  return NextResponse.json({
    ok: true,
    version: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
    uptime: Math.floor(process.uptime()),
    cacheProvider: process.env.CACHE_PROVIDER ?? "memory",
    cacheStats: stats,
    tokenConfigured: !!process.env.GITHUB_TOKEN,
  });
}
