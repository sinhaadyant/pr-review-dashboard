import { NextResponse } from "next/server";
import { aggregate, AggregateInput } from "@/lib/aggregator";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  checkRefreshThrottle,
  getClientIp,
} from "@/lib/rate-limit";
import type { PRState, ReviewerType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCsv(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseState(s: string | null): PRState | "all" {
  if (s === "open" || s === "merged" || s === "closed" || s === "all") return s;
  return "all";
}

function parseReviewerType(s: string | null): ReviewerType | "all" {
  if (s === "R1" || s === "R2" || s === "all") return s;
  return "all";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId, route: "aggregate" });
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rl.retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSec),
          "x-request-id": requestId,
        },
      },
    );
  }
  if (!process.env.GITHUB_TOKEN) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured on the server" },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  }

  const url = new URL(req.url);
  const sp = url.searchParams;

  const input: AggregateInput = {
    orgs: parseCsv(sp.get("orgs")),
    repos: parseCsv(sp.get("repos")),
    sprint: sp.get("sprint"),
    from: sp.get("from"),
    to: sp.get("to"),
    users: parseCsv(sp.get("users")),
    state: parseState(sp.get("state")),
    reviewerType: parseReviewerType(sp.get("reviewerType")),
    excludeBots: sp.get("excludeBots") !== "false",
    forceRefresh: sp.get("forceRefresh") === "1",
  };

  if (input.forceRefresh) {
    const key = `${input.sprint ?? "active"}:${(input.repos ?? []).sort().join(",")}:${(input.orgs ?? []).sort().join(",")}`;
    const t = checkRefreshThrottle(ip, key);
    if (!t.allowed) {
      return NextResponse.json(
        {
          error: "Manual refresh is rate-limited. Try again shortly.",
          retryAfterSec: t.retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(t.retryAfterSec),
            "x-request-id": requestId,
          },
        },
      );
    }
  }

  try {
    const t0 = Date.now();
    const result = await aggregate(input);
    log.info(
      { ms: Date.now() - t0, prs: result.stats.totalPRs },
      "aggregate.ok",
    );
    return NextResponse.json(result, {
      headers: { "x-request-id": requestId },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ err: message }, "aggregate.failed");
    const status =
      message.includes("Bad credentials") || message.includes("401")
        ? 401
        : message.includes("404")
          ? 404
          : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: { "x-request-id": requestId } },
    );
  }
}
