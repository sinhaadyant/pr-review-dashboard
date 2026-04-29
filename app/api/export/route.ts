import { aggregate, AggregateInput } from "@/lib/aggregator";
import { aggregateToCSV, csvFilename } from "@/lib/csv";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { PRState, ReviewerType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCsvParam(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId, route: "export" });
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }
  if (!process.env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: "GITHUB_TOKEN is not configured" }),
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const sp = url.searchParams;
  const input: AggregateInput = {
    orgs: parseCsvParam(sp.get("orgs")),
    repos: parseCsvParam(sp.get("repos")),
    sprint: sp.get("sprint"),
    from: sp.get("from"),
    to: sp.get("to"),
    users: parseCsvParam(sp.get("users")),
    state: (sp.get("state") as PRState | "all") ?? "all",
    reviewerType: (sp.get("reviewerType") as ReviewerType | "all") ?? "all",
    excludeBots: sp.get("excludeBots") !== "false",
  };

  try {
    const data = await aggregate(input);
    const csv = aggregateToCSV(data);
    const filename = csvFilename(data);
    log.info({ filename, rows: data.prs.length }, "export.ok");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ err: message }, "export.failed");
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
