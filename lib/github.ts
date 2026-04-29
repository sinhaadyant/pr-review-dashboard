import { Octokit } from "@octokit/rest";
import pLimit from "p-limit";
import { logger } from "./logger";

const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN && process.env.NODE_ENV !== "test") {
  logger.warn(
    "GITHUB_TOKEN is not set — API routes will fail until configured",
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __octokit__: Octokit | undefined;
}

export function getOctokit(): Octokit {
  if (!globalThis.__octokit__) {
    globalThis.__octokit__ = new Octokit({
      auth: TOKEN,
      userAgent: "pr-review-dashboard",
      request: {
        timeout: 30_000,
      },
      retry: { enabled: true },
      throttle: { enabled: true },
    });
  }
  return globalThis.__octokit__;
}

export const fetchLimit = pLimit(8);

export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

let lastRateLimit: RateLimitInfo | null = null;

export function getLastRateLimit(): RateLimitInfo | null {
  return lastRateLimit;
}

function readRateLimit(
  headers: Record<string, string | undefined> | Headers | undefined,
) {
  if (!headers) return;
  const get = (k: string) =>
    headers instanceof Headers
      ? headers.get(k)
      : (headers as Record<string, string | undefined>)[k];
  const remaining = Number(
    get("x-ratelimit-remaining") ?? get("X-RateLimit-Remaining"),
  );
  const reset = Number(get("x-ratelimit-reset") ?? get("X-RateLimit-Reset"));
  const limit = Number(get("x-ratelimit-limit") ?? get("X-RateLimit-Limit"));
  if (Number.isFinite(remaining)) {
    lastRateLimit = { remaining, reset: reset * 1000, limit };
  }
}

/**
 * Auto-paginate a list endpoint. Returns aggregated array.
 * Stops after `maxPages` pages to bound fan-out.
 */
export async function paginate<T>(
  endpoint: (
    page: number,
    per_page: number,
  ) => Promise<{ data: T[]; headers: unknown }>,
  opts: { perPage?: number; maxPages?: number } = {},
): Promise<T[]> {
  const perPage = opts.perPage ?? 100;
  const maxPages = opts.maxPages ?? 50;
  const all: T[] = [];
  let page = 1;
  while (page <= maxPages) {
    const res = await endpoint(page, perPage);
    readRateLimit(res.headers as Headers);
    all.push(...res.data);
    if (res.data.length < perPage) break;
    page++;
  }
  return all;
}

export interface ListPRsOpts {
  owner: string;
  repo: string;
  since: string;
  until: string;
  maxPRs?: number;
}

export type GhPR = Awaited<
  ReturnType<Octokit["pulls"]["list"]>
>["data"][number];

export type GhIssueComment = Awaited<
  ReturnType<Octokit["issues"]["listComments"]>
>["data"][number];

export type GhReviewComment = Awaited<
  ReturnType<Octokit["pulls"]["listReviewComments"]>
>["data"][number];

export type GhReview = Awaited<
  ReturnType<Octokit["pulls"]["listReviews"]>
>["data"][number];

/**
 * List PRs created within [since, until]. GitHub's pulls.list does NOT support
 * date filtering; we paginate sorted by created desc and stop early when we
 * pass the `since` boundary.
 */
export async function listPRsInWindow(opts: ListPRsOpts): Promise<GhPR[]> {
  const { owner, repo, since, until, maxPRs = 1000 } = opts;
  const octokit = getOctokit();
  const sinceMs = Date.parse(since);
  const untilMs = Date.parse(until);
  const out: GhPR[] = [];
  const perPage = 100;

  for (let page = 1; page <= 25; page++) {
    const res = await octokit.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "created",
      direction: "desc",
      per_page: perPage,
      page,
    });
    readRateLimit(res.headers as unknown as Headers);
    if (res.data.length === 0) break;

    let pastWindow = false;
    for (const pr of res.data) {
      const t = Date.parse(pr.created_at);
      if (t > untilMs) continue;
      if (t < sinceMs) {
        pastWindow = true;
        break;
      }
      out.push(pr);
      if (out.length >= maxPRs) {
        pastWindow = true;
        break;
      }
    }
    if (pastWindow || res.data.length < perPage) break;
  }
  return out;
}

export async function listIssueComments(
  owner: string,
  repo: string,
  pr: number,
): Promise<GhIssueComment[]> {
  return paginate(async (page, per_page) => {
    const res = await getOctokit().issues.listComments({
      owner,
      repo,
      issue_number: pr,
      per_page,
      page,
    });
    return { data: res.data, headers: res.headers };
  });
}

export async function listReviewComments(
  owner: string,
  repo: string,
  pr: number,
): Promise<GhReviewComment[]> {
  return paginate(async (page, per_page) => {
    const res = await getOctokit().pulls.listReviewComments({
      owner,
      repo,
      pull_number: pr,
      per_page,
      page,
    });
    return { data: res.data, headers: res.headers };
  });
}

export async function listReviews(
  owner: string,
  repo: string,
  pr: number,
): Promise<GhReview[]> {
  return paginate(async (page, per_page) => {
    const res = await getOctokit().pulls.listReviews({
      owner,
      repo,
      pull_number: pr,
      per_page,
      page,
    });
    return { data: res.data, headers: res.headers };
  });
}

export async function getRepoMeta(owner: string, repo: string) {
  const res = await getOctokit().repos.get({ owner, repo });
  readRateLimit(res.headers as unknown as Headers);
  return res.data;
}

export async function getCurrentUser() {
  const res = await getOctokit().users.getAuthenticated();
  readRateLimit(res.headers as unknown as Headers);
  return res.data;
}

export async function listUserOrgs() {
  return paginate(async (page, per_page) => {
    const res = await getOctokit().orgs.listForAuthenticatedUser({
      per_page,
      page,
    });
    return { data: res.data, headers: res.headers };
  });
}

export async function listUserRepos(
  opts: {
    includeArchived?: boolean;
    includeForks?: boolean;
  } = {},
) {
  const all = await paginate(async (page, per_page) => {
    const res = await getOctokit().repos.listForAuthenticatedUser({
      per_page,
      page,
      affiliation: "owner,collaborator,organization_member",
      sort: "pushed",
      direction: "desc",
    });
    return { data: res.data, headers: res.headers };
  });
  return all.filter((r) => {
    if (!opts.includeArchived && r.archived) return false;
    if (!opts.includeForks && r.fork) return false;
    return true;
  });
}
