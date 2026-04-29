import { classifyAll, isBot } from "./classifier";
import { hoursBetween } from "./date";
import { getOctokit, type RateLimitInfo } from "./github";
import { logger } from "./logger";
import type {
  CommentSource,
  NormalizedComment,
  NormalizedPR,
  PRState,
  ReviewState,
} from "./types";

/**
 * GraphQL hot path for `pulls + issue comments + review comments + reviews` in
 * a single round-trip per page of PRs. Used when `GITHUB_USE_GRAPHQL=true`.
 *
 * REST round-trips per repo: 1 (pulls.list) + 3*N (per-PR detail). For 50 PRs
 * → 151 requests. GraphQL: ceil(N/PER_PAGE) outer queries (with up to N
 * fallback per-PR queries when nested connections overflow). For 50 PRs at
 * PER_PAGE=25 → 2 queries. ~50–98% request reduction in practice, plus this
 * path returns `additions`/`deletions`/`changedFiles` (REST `pulls.list` does
 * not).
 */

const OUTER_PAGE_SIZE = 25;
const INNER_PAGE_SIZE = 100;

interface GqlActor {
  login: string;
  __typename?: string;
}

interface GqlComment {
  id: string;
  databaseId: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: GqlActor | null;
  path?: string | null;
}

interface GqlConnection<T> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
  nodes: T[];
}

interface GqlReview {
  id: string;
  databaseId: number | null;
  body: string;
  state: string; // APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING
  submittedAt: string | null;
  author: GqlActor | null;
}

interface GqlPullRequest {
  id: string;
  databaseId: number;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  author: (GqlActor & { avatarUrl?: string }) | null;
  comments: GqlConnection<GqlComment>;
  reviews: GqlConnection<GqlReview>;
  reviewThreads: GqlConnection<{
    id: string;
    comments: GqlConnection<GqlComment>;
  }>;
}

interface GqlPullRequestsPage {
  repository: {
    pullRequests: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: GqlPullRequest[];
    } | null;
  } | null;
  rateLimit?: { remaining: number; resetAt: string; limit: number } | null;
}

const PRS_QUERY = /* GraphQL */ `
  query RepoPRs(
    $owner: String!
    $repo: String!
    $cursor: String
    $first: Int!
    $innerFirst: Int!
  ) {
    rateLimit {
      remaining
      resetAt
      limit
    }
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: $first
        orderBy: { field: CREATED_AT, direction: DESC }
        after: $cursor
        states: [OPEN, CLOSED, MERGED]
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          databaseId
          number
          title
          url
          state
          createdAt
          closedAt
          mergedAt
          additions
          deletions
          changedFiles
          author {
            __typename
            login
            ... on User {
              avatarUrl
            }
            ... on Bot {
              avatarUrl
            }
          }
          comments(first: $innerFirst) {
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
            nodes {
              id
              databaseId
              body
              createdAt
              updatedAt
              author {
                __typename
                login
              }
            }
          }
          reviewThreads(first: $innerFirst) {
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
            nodes {
              id
              comments(first: $innerFirst) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                totalCount
                nodes {
                  id
                  databaseId
                  body
                  path
                  createdAt
                  updatedAt
                  author {
                    __typename
                    login
                  }
                }
              }
            }
          }
          reviews(first: $innerFirst) {
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
            nodes {
              id
              databaseId
              body
              state
              submittedAt
              author {
                __typename
                login
              }
            }
          }
        }
      }
    }
  }
`;

const PR_OVERFLOW_QUERY = /* GraphQL */ `
  query PRDetail(
    $owner: String!
    $repo: String!
    $number: Int!
    $commentsCursor: String
    $threadsCursor: String
    $reviewsCursor: String
    $inner: Int!
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        comments(first: $inner, after: $commentsCursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            databaseId
            body
            createdAt
            updatedAt
            author {
              __typename
              login
            }
          }
        }
        reviewThreads(first: $inner, after: $threadsCursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            comments(first: $inner) {
              nodes {
                id
                databaseId
                body
                path
                createdAt
                updatedAt
                author {
                  __typename
                  login
                }
              }
            }
          }
        }
        reviews(first: $inner, after: $reviewsCursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            databaseId
            body
            state
            submittedAt
            author {
              __typename
              login
            }
          }
        }
      }
    }
  }
`;

let lastGraphqlRateLimit: RateLimitInfo | null = null;

export function getLastGraphqlRateLimit(): RateLimitInfo | null {
  return lastGraphqlRateLimit;
}

function readGraphqlRateLimit(rl?: GqlPullRequestsPage["rateLimit"]) {
  if (!rl) return;
  lastGraphqlRateLimit = {
    remaining: rl.remaining,
    reset: Date.parse(rl.resetAt),
    limit: rl.limit,
  };
}

async function fetchOverflowComments(
  owner: string,
  repo: string,
  pr: GqlPullRequest,
): Promise<GqlPullRequest> {
  const out: GqlPullRequest = {
    ...pr,
    comments: { ...pr.comments, nodes: [...pr.comments.nodes] },
    reviews: { ...pr.reviews, nodes: [...pr.reviews.nodes] },
    reviewThreads: {
      ...pr.reviewThreads,
      nodes: pr.reviewThreads.nodes.map((t) => ({
        ...t,
        comments: { ...t.comments, nodes: [...t.comments.nodes] },
      })),
    },
  };

  let commentsCursor: string | null = pr.comments.pageInfo.hasNextPage
    ? pr.comments.pageInfo.endCursor
    : null;
  let threadsCursor: string | null = pr.reviewThreads.pageInfo.hasNextPage
    ? pr.reviewThreads.pageInfo.endCursor
    : null;
  let reviewsCursor: string | null = pr.reviews.pageInfo.hasNextPage
    ? pr.reviews.pageInfo.endCursor
    : null;

  let safety = 8; // bounded so a runaway PR can't pin the worker
  while ((commentsCursor || threadsCursor || reviewsCursor) && safety-- > 0) {
    const res = (await getOctokit().graphql(PR_OVERFLOW_QUERY, {
      owner,
      repo,
      number: pr.number,
      commentsCursor,
      threadsCursor,
      reviewsCursor,
      inner: INNER_PAGE_SIZE,
    })) as {
      repository: {
        pullRequest: {
          comments: GqlConnection<GqlComment>;
          reviewThreads: GqlConnection<{
            id: string;
            comments: GqlConnection<GqlComment>;
          }>;
          reviews: GqlConnection<GqlReview>;
        };
      };
    };

    const detail = res.repository.pullRequest;
    if (commentsCursor) {
      out.comments.nodes.push(...detail.comments.nodes);
      commentsCursor = detail.comments.pageInfo.hasNextPage
        ? detail.comments.pageInfo.endCursor
        : null;
    }
    if (threadsCursor) {
      out.reviewThreads.nodes.push(...detail.reviewThreads.nodes);
      threadsCursor = detail.reviewThreads.pageInfo.hasNextPage
        ? detail.reviewThreads.pageInfo.endCursor
        : null;
    }
    if (reviewsCursor) {
      out.reviews.nodes.push(...detail.reviews.nodes);
      reviewsCursor = detail.reviews.pageInfo.hasNextPage
        ? detail.reviews.pageInfo.endCursor
        : null;
    }
  }

  if (safety <= 0) {
    logger.warn(
      { repo: `${owner}/${repo}`, pr: pr.number },
      "graphql.overflow.bounded",
    );
  }
  return out;
}

function mapState(s: GqlPullRequest["state"]): PRState {
  if (s === "MERGED") return "merged";
  if (s === "CLOSED") return "closed";
  return "open";
}

function isBotActor(actor: GqlActor | null): boolean {
  if (!actor) return false;
  return isBot(actor.login, actor.__typename ?? null);
}

function pushComment(
  out: NormalizedComment[],
  seen: Set<string>,
  source: CommentSource,
  id: string | number,
  author: string | null,
  authorType: string | null,
  body: string,
  filePath: string | null,
  createdAt: string,
  updatedAt: string,
  reviewState: ReviewState,
  excludeBots: boolean,
) {
  const key = `${source}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  if (!author) return;
  const isBotUser = isBot(author, authorType);
  if (excludeBots && isBotUser) return;
  out.push({
    id: String(id),
    source,
    author,
    body: body ?? "",
    filePath,
    createdAt,
    updatedAt,
    reviewerType: classifyAll(author, authorType).reviewerType,
    isBot: isBotUser,
    reviewState,
  });
}

function normalizePR(
  owner: string,
  repo: string,
  pr: GqlPullRequest,
  excludeBots: boolean,
): NormalizedPR {
  const author = pr.author?.login ?? "ghost";
  const out: NormalizedComment[] = [];
  const seen = new Set<string>();

  for (const c of pr.comments.nodes) {
    pushComment(
      out,
      seen,
      "issue",
      c.databaseId ?? c.id,
      c.author?.login ?? null,
      c.author?.__typename ?? null,
      c.body,
      null,
      c.createdAt,
      c.updatedAt,
      null,
      excludeBots,
    );
  }

  for (const t of pr.reviewThreads.nodes) {
    for (const c of t.comments.nodes) {
      pushComment(
        out,
        seen,
        "review_comment",
        c.databaseId ?? c.id,
        c.author?.login ?? null,
        c.author?.__typename ?? null,
        c.body,
        c.path ?? null,
        c.createdAt,
        c.updatedAt,
        null,
        excludeBots,
      );
    }
  }

  let approvals = 0;
  let changesRequested = 0;
  for (const r of pr.reviews.nodes) {
    const state = (r.state as ReviewState) ?? null;
    const include = !(excludeBots && isBotActor(r.author));
    if (include) {
      if (state === "APPROVED") approvals++;
      if (state === "CHANGES_REQUESTED") changesRequested++;
    }
    if (r.body && r.body.trim().length > 0) {
      pushComment(
        out,
        seen,
        "review_submission",
        r.databaseId ?? r.id,
        r.author?.login ?? null,
        r.author?.__typename ?? null,
        r.body,
        null,
        r.submittedAt ?? new Date().toISOString(),
        r.submittedAt ?? new Date().toISOString(),
        state,
        excludeBots,
      );
    }
  }

  let firstReviewAt: string | null = null;
  const candidates: string[] = [];
  for (const c of out) {
    if (c.author.toLowerCase() !== author.toLowerCase()) {
      candidates.push(c.createdAt);
    }
  }
  for (const r of pr.reviews.nodes) {
    if (r.submittedAt && r.author?.login && r.author.login.toLowerCase() !== author.toLowerCase()) {
      candidates.push(r.submittedAt);
    }
  }
  if (candidates.length > 0) {
    firstReviewAt = candidates.reduce((min, c) =>
      Date.parse(c) < Date.parse(min) ? c : min,
    );
  }

  const R1Comments = out.filter((c) => c.reviewerType === "R1").length;
  const R2Comments = out.filter((c) => c.reviewerType === "R2").length;

  return {
    id: pr.databaseId,
    number: pr.number,
    repo,
    owner,
    fullName: `${owner}/${repo}`,
    title: pr.title,
    author,
    authorAvatarUrl: pr.author?.avatarUrl ?? "",
    state: mapState(pr.state),
    htmlUrl: pr.url,
    createdAt: pr.createdAt,
    closedAt: pr.closedAt,
    mergedAt: pr.mergedAt,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    changedFiles: pr.changedFiles ?? 0,
    totalComments: out.length,
    R1Comments,
    R2Comments,
    approvals,
    changesRequested,
    timeToFirstReviewHours: firstReviewAt
      ? hoursBetween(pr.createdAt, firstReviewAt)
      : null,
    timeToMergeHours: pr.mergedAt
      ? hoursBetween(pr.createdAt, pr.mergedAt)
      : null,
    comments: out,
  };
}

export interface ListRepoPRsGraphQLOpts {
  owner: string;
  repo: string;
  since: string;
  until: string;
  excludeBots: boolean;
  maxPRs?: number;
}

/**
 * GraphQL replacement for `listPRsInWindow + per-PR detail fetches`.
 * Returns fully-normalized PRs (matching the REST path's shape) so callers
 * can drop them straight into `buildUsers` / `buildRepoStats`.
 */
export async function listRepoPRsGraphQL(
  opts: ListRepoPRsGraphQLOpts,
): Promise<NormalizedPR[]> {
  const { owner, repo, since, until, excludeBots, maxPRs = 1000 } = opts;
  const sinceMs = Date.parse(since);
  const untilMs = Date.parse(until);
  const out: NormalizedPR[] = [];
  let cursor: string | null = null;
  let outerSafety = Math.max(2, Math.ceil(maxPRs / OUTER_PAGE_SIZE) + 1);

  while (outerSafety-- > 0) {
    const res = (await getOctokit().graphql(PRS_QUERY, {
      owner,
      repo,
      cursor,
      first: OUTER_PAGE_SIZE,
      innerFirst: INNER_PAGE_SIZE,
    })) as GqlPullRequestsPage;

    readGraphqlRateLimit(res.rateLimit);
    const conn = res.repository?.pullRequests;
    if (!conn || conn.nodes.length === 0) break;

    let pastWindow = false;
    for (const raw of conn.nodes) {
      const t = Date.parse(raw.createdAt);
      if (t > untilMs) continue;
      if (t < sinceMs) {
        pastWindow = true;
        break;
      }
      // Top-up nested connections that overflowed (rare in practice; only PRs
      // with > 100 inline comments / threads / reviews trigger the secondary
      // queries).
      const overflow =
        raw.comments.pageInfo.hasNextPage ||
        raw.reviewThreads.pageInfo.hasNextPage ||
        raw.reviews.pageInfo.hasNextPage;
      const filled = overflow
        ? await fetchOverflowComments(owner, repo, raw)
        : raw;
      out.push(normalizePR(owner, repo, filled, excludeBots));
      if (out.length >= maxPRs) {
        pastWindow = true;
        break;
      }
    }

    if (pastWindow || !conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
    if (!cursor) break;
  }

  if (outerSafety <= 0) {
    logger.warn({ repo: `${owner}/${repo}` }, "graphql.outer.bounded");
  }
  return out;
}
