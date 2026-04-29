import type { NormalizedPR, UserStats } from "@/lib/types";
import { classifyComment } from "./classify";

/**
 * "Best reviewer" scoring — combines volume, R1 share, and how *actionable*
 * their comments are (issues / suggestions / questions weigh higher than
 * praise / nits).
 */

export interface ReviewerScore {
  login: string;
  raw: number;
  rank: number;
  totalComments: number;
  actionableShare: number; // 0..1
  functionalShare: number; // 0..1 — share of comments that are functional concerns
  r1Share: number; // 0..1
  reasons: string[];
}

const ACTIONABLE = new Set(["issue", "suggestion", "question", "todo"]);

export function computeBestReviewers(
  users: UserStats[],
  prs: NormalizedPR[],
  topN = 5,
): ReviewerScore[] {
  // Bucket all comments by author.
  const byAuthor = new Map<
    string,
    {
      total: number;
      actionable: number;
      functional: number;
      cosmetic: number;
      r1: number;
    }
  >();
  for (const pr of prs) {
    for (const c of pr.comments) {
      if (c.isBot) continue;
      const slot = byAuthor.get(c.author) ?? {
        total: 0,
        actionable: 0,
        functional: 0,
        cosmetic: 0,
        r1: 0,
      };
      slot.total++;
      const label = classifyComment(c);
      if (ACTIONABLE.has(label.kind)) slot.actionable++;
      if (label.concern === "functional") slot.functional++;
      else if (label.concern === "cosmetic") slot.cosmetic++;
      if (c.reviewerType === "R1") slot.r1++;
      byAuthor.set(c.author, slot);
    }
  }

  const scored: ReviewerScore[] = [];
  for (const [login, b] of byAuthor.entries()) {
    if (b.total < 3) continue; // ignore drive-by reviewers
    const userMeta = users.find((u) => u.login === login);
    if (userMeta?.isBot) continue;

    const actionableShare = b.actionable / b.total;
    const functionalShare = b.functional / b.total;
    const cosmeticShare = b.cosmetic / b.total;
    const r1Share = b.r1 / b.total;
    // Weight: log(volume) * (1 + actionable*1.0 + functional*1.0 + r1*0.6 - cosmetic*0.3)
    // Functional concerns are weighed as much as actionable; a reviewer who
    // mostly leaves cosmetic feedback gets a small penalty so volume alone
    // doesn't dominate.
    const raw =
      Math.log10(1 + b.total) *
      (1 +
        actionableShare * 1.0 +
        functionalShare * 1.0 +
        r1Share * 0.6 -
        cosmeticShare * 0.3);

    const reasons: string[] = [];
    if (b.total >= 25) reasons.push(`High review volume (${b.total} comments)`);
    if (functionalShare >= 0.4)
      reasons.push(
        `${Math.round(functionalShare * 100)}% of comments flag functional issues`,
      );
    if (actionableShare >= 0.5 && functionalShare < 0.4)
      reasons.push(
        `${Math.round(actionableShare * 100)}% of their comments are actionable`,
      );
    if (cosmeticShare >= 0.6)
      reasons.push(
        `${Math.round(cosmeticShare * 100)}% of comments are cosmetic — consider digging deeper`,
      );
    if (r1Share >= 0.7) reasons.push("Reviews mostly internal (R1) PRs");

    scored.push({
      login,
      raw: Math.round(raw * 100) / 100,
      rank: 0,
      totalComments: b.total,
      actionableShare: Math.round(actionableShare * 100) / 100,
      functionalShare: Math.round(functionalShare * 100) / 100,
      r1Share: Math.round(r1Share * 100) / 100,
      reasons,
    });
  }

  scored.sort((a, b) => b.raw - a.raw);
  scored.forEach((s, i) => (s.rank = i + 1));
  return scored.slice(0, topN);
}

/**
 * Per-developer strengths / weaknesses panel (rule-based).
 */
export interface DevInsights {
  login: string;
  strengths: string[];
  weaknesses: string[];
}

export function computeDevInsights(
  user: UserStats,
  prs: NormalizedPR[],
): DevInsights {
  const lower = user.login.toLowerCase();
  const authored = prs.filter((p) => p.author.toLowerCase() === lower);

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Merge rate
  if (authored.length > 0) {
    const mergedRate =
      authored.filter((p) => p.state === "merged").length / authored.length;
    if (mergedRate >= 0.7)
      strengths.push(
        `Strong merge rate (${Math.round(mergedRate * 100)}% of authored PRs merged)`,
      );
    if (mergedRate <= 0.25 && authored.length >= 3)
      weaknesses.push(
        `Low merge rate (${Math.round(mergedRate * 100)}% of authored PRs merged)`,
      );
  }

  // First-review latency
  if (user.avgTimeToFirstReviewHours != null) {
    if (user.avgTimeToFirstReviewHours < 8)
      strengths.push("Reviewers respond fast to their PRs");
    else if (user.avgTimeToFirstReviewHours > 48)
      weaknesses.push("Slow first-review latency on their PRs");
  }

  // R1 vs R2 reviewing
  const totalReviewed = user.R1_commentsGiven + user.R2_commentsGiven;
  if (totalReviewed >= 5) {
    const r1Share = user.R1_commentsGiven / totalReviewed;
    if (r1Share >= 0.8) strengths.push("Active internal (R1) reviewer");
    if (r1Share <= 0.2 && user.R2_commentsGiven >= 5)
      weaknesses.push("Mostly external (R2) review presence");
  }

  // Approvals
  if (user.approvalsGiven >= 5)
    strengths.push(`${user.approvalsGiven} approvals given`);

  // Authoring volume
  if (user.prsAuthored >= 10)
    strengths.push(`Prolific author (${user.prsAuthored} PRs)`);

  // Reviewer outreach
  if (user.commentsGiven >= 25)
    strengths.push(`Engaged reviewer (${user.commentsGiven} comments)`);

  // Comment focus — only meaningful with enough volume.
  const commentsByThisUser = prs.flatMap((p) =>
    p.comments.filter((c) => c.author.toLowerCase() === lower && !c.isBot),
  );
  if (commentsByThisUser.length >= 10) {
    let functional = 0;
    let cosmetic = 0;
    for (const c of commentsByThisUser) {
      const concern = classifyComment(c).concern;
      if (concern === "functional") functional++;
      else if (concern === "cosmetic") cosmetic++;
    }
    const total = commentsByThisUser.length;
    const fnShare = functional / total;
    const cosShare = cosmetic / total;
    if (fnShare >= 0.4)
      strengths.push(
        `Catches functional issues (${Math.round(fnShare * 100)}% of their comments)`,
      );
    if (cosShare >= 0.6 && fnShare < 0.2)
      weaknesses.push(
        `Reviews lean cosmetic (${Math.round(cosShare * 100)}% style/format vs ${Math.round(fnShare * 100)}% functional)`,
      );
  }

  if (
    authored.length >= 3 &&
    authored.every((p) => p.changesRequested === 0 && p.approvals === 0)
  ) {
    weaknesses.push("Their PRs receive few formal reviews");
  }

  // Long-stale opens
  const openOld = authored.filter(
    (p) =>
      p.state === "open" &&
      Date.parse(p.createdAt) < Date.now() - 14 * 24 * 60 * 60 * 1000,
  ).length;
  if (openOld >= 2) weaknesses.push(`${openOld} PRs open longer than 2 weeks`);

  return { login: user.login, strengths, weaknesses };
}
