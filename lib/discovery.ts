import { cache, cacheKeys, TTL_DISCOVERY_MS } from "./cache";
import {
  getCurrentUser,
  getOctokit,
  listUserOrgs,
  listUserRepos,
} from "./github";
import { logger } from "./logger";
import type { DiscoveryResult } from "./types";

function parseList(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

interface NormalizedRepo {
  fullName: string;
  owner: string;
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  defaultBranch: string;
  pushedAt: string;
}

async function getExtraRepoSafe(
  owner: string,
  name: string,
): Promise<NormalizedRepo | null> {
  try {
    const res = await getOctokit().repos.get({ owner, repo: name });
    const r = res.data;
    return {
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      isPrivate: !!r.private,
      isFork: !!r.fork,
      isArchived: !!r.archived,
      defaultBranch: r.default_branch ?? "main",
      pushedAt: r.pushed_at ?? r.updated_at ?? new Date(0).toISOString(),
    };
  } catch (err) {
    logger.warn(
      {
        repo: `${owner}/${name}`,
        err: err instanceof Error ? err.message : String(err),
      },
      "discovery.extra_repo_failed",
    );
    return null;
  }
}

export async function discover(
  opts: { force?: boolean } = {},
): Promise<DiscoveryResult> {
  const key = cacheKeys.discovery();
  if (!opts.force) {
    const cached = cache.get<DiscoveryResult>(key);
    if (cached && !cached.stale) {
      return cached.data;
    }
  }

  return cache.dedupe(key, async () => {
    const includeArchived = process.env.INCLUDE_ARCHIVED === "true";
    const includeForks = process.env.INCLUDE_FORKS === "true";
    const allowPrivate = process.env.ALLOW_PRIVATE_REPOS !== "false";
    const repoBlock = new Set(parseList(process.env.REPO_BLOCKLIST));
    const orgBlock = new Set(parseList(process.env.ORG_BLOCKLIST));
    const orgScope = process.env.GITHUB_ORG?.trim().toLowerCase() || null;
    const extraPublicRepos = parseList(process.env.EXTRA_PUBLIC_REPOS);
    const extraPublicReposOnly =
      process.env.EXTRA_PUBLIC_REPOS_ONLY === "true" &&
      extraPublicRepos.length > 0;

    const t0 = Date.now();
    const [user, orgs, repos] = await Promise.all([
      getCurrentUser(),
      extraPublicReposOnly ? Promise.resolve([]) : listUserOrgs(),
      extraPublicReposOnly
        ? Promise.resolve([])
        : listUserRepos({ includeArchived, includeForks }),
    ]);

    const filteredRepos: NormalizedRepo[] = repos
      .filter((r) => allowPrivate || !r.private)
      .filter((r) => !repoBlock.has(r.full_name.toLowerCase()))
      .filter((r) => !orgBlock.has(r.owner.login.toLowerCase()))
      .filter((r) => !orgScope || r.owner.login.toLowerCase() === orgScope)
      .map((r) => ({
        fullName: r.full_name,
        owner: r.owner.login,
        name: r.name,
        isPrivate: !!r.private,
        isFork: !!r.fork,
        isArchived: !!r.archived,
        defaultBranch: r.default_branch ?? "main",
        pushedAt: r.pushed_at ?? r.updated_at ?? new Date(0).toISOString(),
      }));

    // Inject explicitly-listed public repos. Useful for demo/testing or when
    // the operator wants to track repos outside their token's affiliation set.
    const knownFullNames = new Set(
      filteredRepos.map((r) => r.fullName.toLowerCase()),
    );
    for (const fn of extraPublicRepos) {
      if (knownFullNames.has(fn)) continue;
      const [owner, name] = fn.split("/");
      if (!owner || !name) continue;
      const meta = await getExtraRepoSafe(owner, name);
      if (!meta) continue;
      if (!allowPrivate && meta.isPrivate) continue;
      filteredRepos.push(meta);
      knownFullNames.add(meta.fullName.toLowerCase());
    }

    const repoCountByOrg = new Map<string, number>();
    for (const r of filteredRepos) {
      repoCountByOrg.set(r.owner, (repoCountByOrg.get(r.owner) ?? 0) + 1);
    }

    const ownersInRepos = new Set(filteredRepos.map((r) => r.owner));

    const orgMap = new Map(
      orgs
        .filter((o) => !orgBlock.has(o.login.toLowerCase()))
        .filter((o) => ownersInRepos.has(o.login))
        .map((o) => [
          o.login,
          {
            login: o.login,
            avatarUrl: o.avatar_url ?? "",
            repoCount: repoCountByOrg.get(o.login) ?? 0,
          },
        ]),
    );

    for (const owner of ownersInRepos) {
      if (!orgMap.has(owner)) {
        orgMap.set(owner, {
          login: owner,
          avatarUrl: "",
          repoCount: repoCountByOrg.get(owner) ?? 0,
        });
      }
    }

    const filteredOrgs = Array.from(orgMap.values())
      .filter((o) => !orgBlock.has(o.login.toLowerCase()))
      .sort(
        (a, b) => b.repoCount - a.repoCount || a.login.localeCompare(b.login),
      );

    const result: DiscoveryResult = {
      user: { login: user.login, avatarUrl: user.avatar_url },
      orgs: filteredOrgs,
      repos: filteredRepos,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TTL_DISCOVERY_MS).toISOString(),
    };

    cache.set(key, result, TTL_DISCOVERY_MS);
    logger.info(
      {
        ms: Date.now() - t0,
        orgs: result.orgs.length,
        repos: result.repos.length,
        extraRepos: extraPublicRepos.length,
        extraPublicReposOnly,
      },
      "discovery.completed",
    );
    return result;
  });
}
