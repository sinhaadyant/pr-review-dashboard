import type { NormalizedPR, UserStats } from "@/lib/types";

/**
 * Engineering-intelligence scoring primitives.
 *
 * All formulas are intentionally simple and tunable so they can be
 * configured later via a rules engine. Outputs are deterministic and
 * never reach out to an external API.
 */

// ---------------------------------------------------------------------------
// Tunable weights — kept as a single object so a future "rules engine" UI can
// override them at runtime.
// ---------------------------------------------------------------------------

export interface ScoreWeights {
  risk: {
    files: number; // weight per changed file
    additions: number; // weight per added line
    deletionsFactor: number; // 0..1 (deletions usually safer than additions)
    r2Comment: number; // weight per external (R2) comment
    changesRequested: number; // weight per "changes requested" review
  };
  health: {
    r1Comment: number;
    r2Comment: number;
    latencyHour: number;
    bonusForMerged: number;
    bonusForApproved: number;
  };
  riskThresholds: { medium: number; high: number };
  healthThresholds: { medium: number; good: number };
  qualityThresholds: { medium: number; good: number };
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  risk: {
    files: 2,
    additions: 1,
    deletionsFactor: 0.4,
    r2Comment: 5,
    changesRequested: 8,
  },
  health: {
    r1Comment: 2,
    r2Comment: -1,
    latencyHour: -0.05,
    bonusForMerged: 5,
    bonusForApproved: 3,
  },
  riskThresholds: { medium: 50, high: 200 },
  healthThresholds: { medium: 0, good: 10 },
  qualityThresholds: { medium: 1, good: 3 },
};

// ---------------------------------------------------------------------------
// Risk score — "how risky is this PR to merge?"
// risk = files * w_files
//      + additions * w_add
//      + deletions * w_add * deletionsFactor
//      + R2_comments * w_r2
//      + changes_requested * w_cr
// ---------------------------------------------------------------------------

export type RiskBand = "low" | "medium" | "high";

export interface RiskScore {
  raw: number;
  band: RiskBand;
  factors: { label: string; value: number }[];
}

export function computeRisk(
  pr: NormalizedPR,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): RiskScore {
  const w = weights.risk;
  const filesPart = pr.changedFiles * w.files;
  const addPart = pr.additions * w.additions;
  const delPart = pr.deletions * w.additions * w.deletionsFactor;
  const r2Part = pr.R2Comments * w.r2Comment;
  const crPart = pr.changesRequested * w.changesRequested;
  const raw = filesPart + addPart + delPart + r2Part + crPart;

  const { medium, high } = weights.riskThresholds;
  const band: RiskBand = raw >= high ? "high" : raw >= medium ? "medium" : "low";

  const factors = [
    { label: "Files changed", value: filesPart },
    { label: "Additions", value: addPart },
    { label: "Deletions (×0.4)", value: delPart },
    { label: "External (R2) comments", value: r2Part },
    { label: "Changes requested", value: crPart },
  ].filter((f) => f.value > 0);

  return { raw: Math.round(raw), band, factors };
}

// ---------------------------------------------------------------------------
// Health score — "how healthy is this PR's review?"
// health = R1*2 - R2 - latency_h*0.05 + bonus
// ---------------------------------------------------------------------------

export type HealthBand = "poor" | "ok" | "good";

export interface HealthScore {
  raw: number;
  band: HealthBand;
  reasons: string[];
}

export function computeHealth(
  pr: NormalizedPR,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): HealthScore {
  const w = weights.health;
  const r1 = pr.R1Comments * w.r1Comment;
  const r2 = pr.R2Comments * w.r2Comment;
  const lat = (pr.timeToFirstReviewHours ?? 0) * w.latencyHour;
  const merged = pr.state === "merged" ? w.bonusForMerged : 0;
  const approved = pr.approvals > 0 ? w.bonusForApproved : 0;
  const raw = r1 + r2 + lat + merged + approved;

  const { medium, good } = weights.healthThresholds;
  const band: HealthBand =
    raw >= good ? "good" : raw >= medium ? "ok" : "poor";

  const reasons: string[] = [];
  if (pr.R1Comments === 0 && pr.R2Comments > 0)
    reasons.push("Reviewed only by external contributors");
  if (pr.R2Comments > pr.R1Comments * 2 && pr.R1Comments > 0)
    reasons.push("R2 comments dominate the discussion");
  if ((pr.timeToFirstReviewHours ?? 0) > 48)
    reasons.push("Slow first review (>48 h)");
  if (pr.changesRequested > 0)
    reasons.push(`${pr.changesRequested} reviewer asked for changes`);
  if (pr.approvals === 0 && pr.state === "open")
    reasons.push("No approvals yet");
  if (pr.state === "merged" && pr.R1Comments + pr.R2Comments === 0)
    reasons.push("Merged without any review comment");

  return { raw: Math.round(raw * 10) / 10, band, reasons };
}

// ---------------------------------------------------------------------------
// Review-quality score — "how thorough is the review?"
// quality = total_comments / max(1, files_changed)
// ---------------------------------------------------------------------------

export type QualityBand = "thin" | "ok" | "thorough";

export interface QualityScore {
  raw: number;
  band: QualityBand;
}

export function computeQuality(
  pr: NormalizedPR,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): QualityScore {
  const raw = pr.totalComments / Math.max(1, pr.changedFiles);
  const { medium, good } = weights.qualityThresholds;
  const band: QualityBand =
    raw >= good ? "thorough" : raw >= medium ? "ok" : "thin";
  return { raw: Math.round(raw * 100) / 100, band };
}

// ---------------------------------------------------------------------------
// User-level health score — averaged across PRs the user authored, plus a
// reviewer-impact bonus for the comments they gave on others' PRs.
// ---------------------------------------------------------------------------

export interface UserHealth {
  login: string;
  raw: number;
  band: HealthBand;
  authoredAvg: number; // avg PR health for PRs they authored
  reviewerImpact: number; // R1 contribution they gave others
}

export function computeUserHealth(
  user: UserStats,
  prs: NormalizedPR[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): UserHealth {
  const lower = user.login.toLowerCase();
  const authored = prs.filter((p) => p.author.toLowerCase() === lower);
  const authoredScores = authored.map((p) => computeHealth(p, weights).raw);
  const authoredAvg =
    authoredScores.length === 0
      ? 0
      : authoredScores.reduce((a, b) => a + b, 0) / authoredScores.length;

  const reviewerImpact =
    user.R1_commentsGiven * 1.5 - user.R2_commentsGiven * 0.5;

  const raw = authoredAvg + reviewerImpact * 0.05;
  const { medium, good } = weights.healthThresholds;
  const band: HealthBand =
    raw >= good ? "good" : raw >= medium ? "ok" : "poor";

  return {
    login: user.login,
    raw: Math.round(raw * 10) / 10,
    band,
    authoredAvg: Math.round(authoredAvg * 10) / 10,
    reviewerImpact: Math.round(reviewerImpact * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Helpers for color-coding / labels in the UI
// ---------------------------------------------------------------------------

export const RISK_LABEL: Record<RiskBand, string> = {
  low: "Low risk",
  medium: "Med risk",
  high: "High risk",
};

export const HEALTH_LABEL: Record<HealthBand, string> = {
  poor: "Poor",
  ok: "OK",
  good: "Good",
};

export const QUALITY_LABEL: Record<QualityBand, string> = {
  thin: "Thin review",
  ok: "OK review",
  thorough: "Thorough",
};
