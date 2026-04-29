import { cache, cacheKeys, TTL_AGGREGATE_MS } from "./cache";
import { classifyAll, getTeam, isBot } from "./classifier";
import {
  getActiveSprint,
  getSprintById,
  average,
  hoursBetween,
  median,
} from "./date";
import { discover } from "./discovery";
import {
  fetchLimit,
  GhIssueComment,
  GhPR,
  GhReview,
  GhReviewComment,
  listIssueComments,
  listPRsInWindow,
  listReviewComments,
  listReviews,
} from "./github";
import { listRepoPRsGraphQL } from "./github-graphql";
import { logger } from "./logger";
import type {
  AggregatedResponse,
  AppliedFilters,
  CommentSource,
  DiscoveredRepo,
  NormalizedComment,
  NormalizedPR,
  PRState,
  RepoStats,
  ReviewState,
  ReviewerType,
  UserStats,
} from "./types";
import { stableHash } from "./utils";

const MAX_REPOS = Number(process.env.MAX_REPOS_PER_AGGREGATION ?? 50);
const MAX_PRS_PER_REPO = Number(process.env.MAX_PRS_PER_REPO ?? 1000);
const USE_GRAPHQL = process.env.GITHUB_USE_GRAPHQL === "true";

export interface AggregateInput {
  orgs?: string[];
  repos?: string[];
  sprint?: string | null;
  from?: string | null;
  to?: string | null;
  users?: string[];
  state?: PRState | "all";
  reviewerType?: ReviewerType | "all";
  excludeBots?: boolean;
  forceRefresh?: boolean;
}

function getPRState(pr: GhPR): PRState {
  if (pr.merged_at) return "merged";
  if (pr.state === "closed") return "closed";
  return "open";
}

function normalizeComments(
  prAuthor: string,
  issueComments: GhIssueComment[],
  reviewComments: GhReviewComment[],
  reviews: GhReview[],
  excludeBots: boolean,
): {
  comments: NormalizedComment[];
  approvals: number;
  changesRequested: number;
  firstReviewAt: string | null;
} {
  const out: NormalizedComment[] = [];
  const seen = new Set<string>();

  const push = (
    source: CommentSource,
    id: string | number,
    author: string | null | undefined,
    userType: string | null | undefined,
    body: string | null | undefined,
    filePath: string | null,
    createdAt: string,
    updatedAt: string,
    reviewState: ReviewState = null,
  ) => {
    const key = `${source}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!author) return;
    const isBotUser = isBot(author, userType);
    if (excludeBots && isBotUser) return;
    out.push({
      id: String(id),
      source,
      author,
      body: body ?? "",
      filePath,
      createdAt,
      updatedAt,
      reviewerType: classifyAll(author, userType).reviewerType,
      isBot: isBotUser,
      reviewState,
    });
  };

  for (const c of issueComments) {
    push(
      "issue",
      c.id,
      c.user?.login,
      c.user?.type,
      c.body,
      null,
      c.created_at,
      c.updated_at,
    );
  }
  for (const c of reviewComments) {
    push(
      "review_comment",
      c.id,
      c.user?.login,
      c.user?.type,
      c.body,
      c.path ?? null,
      c.created_at,
      c.updated_at,
    );
  }

  let approvals = 0;
  let changesRequested = 0;
  for (const r of reviews) {
    const state = (r.state as ReviewState) ?? null;
    const author = r.user?.login;
    const isBotUser = isBot(author, r.user?.type);
    const include = !(excludeBots && isBotUser);
    if (include) {
      if (state === "APPROVED") approvals++;
      if (state === "CHANGES_REQUESTED") changesRequested++;
    }
    if (r.body && r.body.trim().length > 0) {
      push(
        "review_submission",
        r.id,
        author,
        r.user?.type,
        r.body,
        null,
        r.submitted_at ?? r.submitted_at ?? new Date().toISOString(),
        r.submitted_at ?? new Date().toISOString(),
        state,
      );
    }
  }

  // Earliest non-author comment OR review submission used as first-review marker
  let firstReviewAt: string | null = null;
  const candidates = [
    ...out
      .filter((c) => c.author.toLowerCase() !== prAuthor.toLowerCase())
      .map((c) => c.createdAt),
    ...reviews
      .filter(
        (r) =>
          r.user?.login &&
          r.user.login.toLowerCase() !== prAuthor.toLowerCase(),
      )
      .map((r) => r.submitted_at)
      .filter((x): x is string => !!x),
  ];
  if (candidates.length > 0) {
    firstReviewAt = candidates.reduce((min, c) =>
      Date.parse(c) < Date.parse(min) ? c : min,
    );
  }

  return { comments: out, approvals, changesRequested, firstReviewAt };
}

async function fetchPRDetails(
  owner: string,
  repo: string,
  pr: GhPR,
  excludeBots: boolean,
): Promise<NormalizedPR> {
  const author = pr.user?.login ?? "ghost";
  const [issueComments, reviewComments, reviews] = await Promise.all([
    listIssueComments(owner, repo, pr.number),
    listReviewComments(owner, repo, pr.number),
    listReviews(owner, repo, pr.number),
  ]);
  const { comments, approvals, changesRequested, firstReviewAt } =
    normalizeComments(
      author,
      issueComments,
      reviewComments,
      reviews,
      excludeBots,
    );

  const R1Comments = comments.filter((c) => c.reviewerType === "R1").length;
  const R2Comments = comments.filter((c) => c.reviewerType === "R2").length;

  return {
    id: pr.id,
    number: pr.number,
    repo,
    owner,
    fullName: `${owner}/${repo}`,
    title: pr.title,
    author,
    authorAvatarUrl: pr.user?.avatar_url ?? "",
    state: getPRState(pr),
    htmlUrl: pr.html_url,
    createdAt: pr.created_at,
    closedAt: pr.closed_at,
    mergedAt: pr.merged_at,
    additions:
      "additions" in pr && typeof pr.additions === "number" ? pr.additions : 0,
    deletions:
      "deletions" in pr && typeof pr.deletions === "number" ? pr.deletions : 0,
    changedFiles:
      "changed_files" in pr && typeof pr.changed_files === "number"
        ? pr.changed_files
        : 0,
    totalComments: comments.length,
    R1Comments,
    R2Comments,
    approvals,
    changesRequested,
    timeToFirstReviewHours: firstReviewAt
      ? hoursBetween(pr.created_at, firstReviewAt)
      : null,
    timeToMergeHours: pr.merged_at
      ? hoursBetween(pr.created_at, pr.merged_at)
      : null,
    comments,
  };
}

async function fetchRepoPRs(
  repo: DiscoveredRepo,
  windowStart: string,
  windowEnd: string,
  excludeBots: boolean,
): Promise<NormalizedPR[]> {
  const t0 = Date.now();

  if (USE_GRAPHQL) {
    try {
      const detailed = await listRepoPRsGraphQL({
        owner: repo.owner,
        repo: repo.name,
        since: windowStart,
        until: windowEnd,
        excludeBots,
        maxPRs: MAX_PRS_PER_REPO,
      });
      logger.info(
        {
          repo: repo.fullName,
          prs: detailed.length,
          ms: Date.now() - t0,
          via: "graphql",
        },
        "repo.aggregated",
      );
      return detailed;
    } catch (err) {
      // GraphQL endpoint failures (5xx, rate-limit, schema regression) fall
      // back to the REST path so a single bad PR doesn't break aggregation.
      logger.warn(
        {
          repo: repo.fullName,
          err: err instanceof Error ? err.message : String(err),
        },
        "graphql.fallback_to_rest",
      );
    }
  }

  const prs = await listPRsInWindow({
    owner: repo.owner,
    repo: repo.name,
    since: windowStart,
    until: windowEnd,
    maxPRs: MAX_PRS_PER_REPO,
  });
  if (prs.length === 0) {
    logger.debug({ repo: repo.fullName, ms: Date.now() - t0 }, "repo.empty");
    return [];
  }
  const detailed = await Promise.all(
    prs.map((pr) =>
      fetchLimit(() => fetchPRDetails(repo.owner, repo.name, pr, excludeBots)),
    ),
  );
  logger.info(
    {
      repo: repo.fullName,
      prs: detailed.length,
      ms: Date.now() - t0,
      via: "rest",
    },
    "repo.aggregated",
  );
  return detailed;
}

function buildUsers(prs: NormalizedPR[]): UserStats[] {
  const map = new Map<string, UserStats>();
  const repoCounts = new Map<
    string,
    Map<string, { prs: number; comments: number }>
  >();

  const ensure = (
    login: string,
    avatarUrl: string,
    userType: string | null = null,
  ): UserStats => {
    const lower = login.toLowerCase();
    let u = map.get(lower);
    if (!u) {
      const cls = classifyAll(login, userType);
      u = {
        login,
        name: cls.name,
        avatarUrl,
        reviewerType: cls.reviewerType,
        isBot: cls.isBot,
        prsAuthored: 0,
        prsMerged: 0,
        prsOpen: 0,
        prsClosed: 0,
        commentsGiven: 0,
        R1_commentsGiven: 0,
        R2_commentsGiven: 0,
        commentsReceived: 0,
        approvalsGiven: 0,
        changesRequestedGiven: 0,
        avgTimeToFirstReviewHours: null,
        avgTimeToMergeHours: null,
        topRepos: [],
      };
      map.set(lower, u);
    }
    return u;
  };

  const bumpRepo = (login: string, repo: string, kind: "pr" | "comment") => {
    const lower = login.toLowerCase();
    let inner = repoCounts.get(lower);
    if (!inner) {
      inner = new Map();
      repoCounts.set(lower, inner);
    }
    const entry = inner.get(repo) ?? { prs: 0, comments: 0 };
    if (kind === "pr") entry.prs++;
    else entry.comments++;
    inner.set(repo, entry);
  };

  const ttfrByUser = new Map<string, number[]>();
  const ttmByUser = new Map<string, number[]>();

  for (const pr of prs) {
    const author = ensure(pr.author, pr.authorAvatarUrl);
    author.prsAuthored++;
    if (pr.state === "merged") author.prsMerged++;
    else if (pr.state === "open") author.prsOpen++;
    else author.prsClosed++;
    author.commentsReceived += pr.comments.filter(
      (c) => c.author.toLowerCase() !== pr.author.toLowerCase(),
    ).length;
    bumpRepo(pr.author, pr.fullName, "pr");

    if (pr.timeToFirstReviewHours != null) {
      const arr = ttfrByUser.get(pr.author.toLowerCase()) ?? [];
      arr.push(pr.timeToFirstReviewHours);
      ttfrByUser.set(pr.author.toLowerCase(), arr);
    }
    if (pr.timeToMergeHours != null) {
      const arr = ttmByUser.get(pr.author.toLowerCase()) ?? [];
      arr.push(pr.timeToMergeHours);
      ttmByUser.set(pr.author.toLowerCase(), arr);
    }

    for (const c of pr.comments) {
      if (c.author.toLowerCase() === pr.author.toLowerCase()) {
        // self-comments still tracked but don't count toward giving credit
        const u = ensure(c.author, "");
        u.commentsGiven++;
        if (c.reviewerType === "R1") u.R1_commentsGiven++;
        else u.R2_commentsGiven++;
        bumpRepo(c.author, pr.fullName, "comment");
        continue;
      }
      const u = ensure(c.author, "");
      u.commentsGiven++;
      if (c.reviewerType === "R1") u.R1_commentsGiven++;
      else u.R2_commentsGiven++;
      if (c.source === "review_submission") {
        if (c.reviewState === "APPROVED") u.approvalsGiven++;
        if (c.reviewState === "CHANGES_REQUESTED") u.changesRequestedGiven++;
      }
      bumpRepo(c.author, pr.fullName, "comment");
    }
  }

  // PR review submissions WITHOUT body (counted in approvals but not as comments)
  // Already handled via PR.approvals/changesRequested; we need to attribute these
  // back to reviewers even if they had no body. We'll re-walk by inspecting raw
  // review state via comments[] above. Approvals/changes-requested by reviewers
  // with a body are caught above. Approvals with EMPTY body need a different path
  // — we'll simply add pr.approvals/changesRequested to PR author as "received" via
  // existing comment iteration; reviewer-side empty approvals are not tracked
  // per-user (acceptable trade-off; documented).

  for (const [login, arr] of ttfrByUser) {
    const u = map.get(login);
    if (u) u.avgTimeToFirstReviewHours = average(arr);
  }
  for (const [login, arr] of ttmByUser) {
    const u = map.get(login);
    if (u) u.avgTimeToMergeHours = average(arr);
  }

  for (const [login, inner] of repoCounts) {
    const u = map.get(login);
    if (!u) continue;
    u.topRepos = Array.from(inner.entries())
      .map(([fullName, v]) => ({ fullName, ...v }))
      .sort((a, b) => b.prs + b.comments - (a.prs + a.comments))
      .slice(0, 5);
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.commentsGiven + b.prsAuthored - (a.commentsGiven + a.prsAuthored),
  );
}

function buildRepoStats(prs: NormalizedPR[]): RepoStats[] {
  const map = new Map<string, RepoStats & { contributors: Set<string> }>();
  for (const pr of prs) {
    let r = map.get(pr.fullName);
    if (!r) {
      r = {
        fullName: pr.fullName,
        prsTotal: 0,
        prsMerged: 0,
        R1_comments: 0,
        R2_comments: 0,
        contributorsCount: 0,
        contributors: new Set(),
      };
      map.set(pr.fullName, r);
    }
    r.prsTotal++;
    if (pr.state === "merged") r.prsMerged++;
    r.R1_comments += pr.R1Comments;
    r.R2_comments += pr.R2Comments;
    r.contributors.add(pr.author);
    for (const c of pr.comments) r.contributors.add(c.author);
  }
  return Array.from(map.values())
    .map((r) => ({
      fullName: r.fullName,
      prsTotal: r.prsTotal,
      prsMerged: r.prsMerged,
      R1_comments: r.R1_comments,
      R2_comments: r.R2_comments,
      contributorsCount: r.contributors.size,
    }))
    .sort((a, b) => b.prsTotal - a.prsTotal);
}

function applyFilters(
  prs: NormalizedPR[],
  input: AggregateInput,
): NormalizedPR[] {
  const userSet = new Set((input.users ?? []).map((u) => u.toLowerCase()));
  const stateFilter = input.state ?? "all";
  const reviewerType = input.reviewerType ?? "all";
  return prs.filter((pr) => {
    if (userSet.size > 0 && !userSet.has(pr.author.toLowerCase())) return false;
    if (stateFilter !== "all" && pr.state !== stateFilter) return false;
    if (reviewerType !== "all") {
      const has = pr.comments.some((c) => c.reviewerType === reviewerType);
      if (!has) return false;
    }
    return true;
  });
}

export async function aggregate(
  input: AggregateInput,
): Promise<AggregatedResponse> {
  const team = getTeam();
  const excludeBots = input.excludeBots ?? team.config.excludeBots;
  const sprint =
    input.from && input.to
      ? null
      : input.sprint
        ? getSprintById(input.sprint)
        : getActiveSprint();
  const windowStart =
    input.from ?? sprint?.startDate ?? getActiveSprint().startDate;
  const windowEnd = input.to ?? sprint?.endDate ?? getActiveSprint().endDate;

  const filterHash = stableHash({
    state: input.state ?? "all",
    reviewerType: input.reviewerType ?? "all",
    users: (input.users ?? []).map((u) => u.toLowerCase()).sort(),
    excludeBots,
    from: input.from ?? null,
    to: input.to ?? null,
  });

  const orgFilter = (input.orgs ?? []).map((s) => s.toLowerCase());
  const repoFilter = (input.repos ?? []).map((s) => s.toLowerCase());
  const sprintId = sprint?.id ?? "custom";

  let cacheKey: string;
  if (repoFilter.length === 1) {
    cacheKey = cacheKeys.aggregateRepo(repoFilter[0], sprintId, filterHash);
  } else if (orgFilter.length === 1 && repoFilter.length === 0) {
    cacheKey = cacheKeys.aggregateOrg(orgFilter[0], sprintId, filterHash);
  } else {
    cacheKey = cacheKeys.aggregateAll(sprintId, filterHash);
  }

  if (!input.forceRefresh) {
    const cached = cache.get<AggregatedResponse>(cacheKey);
    if (cached && !cached.stale) {
      return {
        ...cached.data,
        cache: {
          hit: true,
          stale: false,
          generatedAt: new Date(cached.storedAt).toISOString(),
          expiresAt: new Date(cached.expiresAt).toISOString(),
        },
      };
    }
  }

  return cache.dedupe(cacheKey, async () => {
    const t0 = Date.now();
    const discovery = await discover();

    let candidateRepos = discovery.repos;
    if (orgFilter.length > 0) {
      candidateRepos = candidateRepos.filter((r) =>
        orgFilter.includes(r.owner.toLowerCase()),
      );
    }
    if (repoFilter.length > 0) {
      candidateRepos = candidateRepos.filter((r) =>
        repoFilter.includes(r.fullName.toLowerCase()),
      );
    }

    candidateRepos = [...candidateRepos].sort(
      (a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt),
    );

    const partial = candidateRepos.length > MAX_REPOS;
    const reposSkipped = partial
      ? candidateRepos.slice(MAX_REPOS).map((r) => r.fullName)
      : undefined;
    const usingRepos = candidateRepos.slice(0, MAX_REPOS);

    let allPRs: NormalizedPR[] = [];
    const errors: string[] = [];

    await Promise.all(
      usingRepos.map((repo) =>
        fetchLimit(async () => {
          try {
            const prs = await fetchRepoPRs(
              repo,
              windowStart,
              windowEnd,
              excludeBots,
            );
            allPRs = allPRs.concat(prs);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn(
              { repo: repo.fullName, err: message },
              "repo.fetch.failed",
            );
            errors.push(repo.fullName);
          }
        }),
      ),
    );

    const filtered = applyFilters(allPRs, input);

    const users = buildUsers(filtered);
    const repos = buildRepoStats(filtered);

    const ttfrAll = filtered
      .map((p) => p.timeToFirstReviewHours)
      .filter((x): x is number => x != null);
    const ttmAll = filtered
      .map((p) => p.timeToMergeHours)
      .filter((x): x is number => x != null);

    const totalR1 = filtered.reduce((s, p) => s + p.R1Comments, 0);
    const totalR2 = filtered.reduce((s, p) => s + p.R2Comments, 0);
    const totalApprovals = filtered.reduce((s, p) => s + p.approvals, 0);
    const totalChanges = filtered.reduce((s, p) => s + p.changesRequested, 0);

    const appliedFilters: AppliedFilters = {
      orgs: input.orgs ?? [],
      repos: input.repos ?? [],
      sprint: sprint?.id ?? null,
      from: input.from ?? null,
      to: input.to ?? null,
      users: input.users ?? [],
      state: input.state ?? "all",
      reviewerType: input.reviewerType ?? "all",
      excludeBots,
    };

    const now = Date.now();
    const response: AggregatedResponse = {
      users,
      repos,
      prs: filtered,
      stats: {
        reposCount: repos.length,
        contributorsCount: users.length,
        totalPRs: filtered.length,
        merged: filtered.filter((p) => p.state === "merged").length,
        open: filtered.filter((p) => p.state === "open").length,
        closed: filtered.filter((p) => p.state === "closed").length,
        R1_comments: totalR1,
        R2_comments: totalR2,
        approvals: totalApprovals,
        changes_requested: totalChanges,
        avg_time_to_first_review_hours: average(ttfrAll),
        avg_time_to_merge_hours: average(ttmAll),
        p50_time_to_first_review_hours: median(ttfrAll),
      },
      appliedFilters,
      cache: {
        hit: false,
        stale: false,
        generatedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + TTL_AGGREGATE_MS).toISOString(),
      },
      partial: partial || errors.length > 0 ? true : undefined,
      reposSkipped:
        reposSkipped || errors.length
          ? [...(reposSkipped ?? []), ...errors]
          : undefined,
      generatedAt: new Date(now).toISOString(),
    };

    cache.set(cacheKey, response, TTL_AGGREGATE_MS);
    logger.info(
      {
        cacheKey,
        reposScanned: usingRepos.length,
        prs: filtered.length,
        ms: Date.now() - t0,
      },
      "aggregate.completed",
    );
    return response;
  });
}
