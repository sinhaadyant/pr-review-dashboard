import type { NormalizedComment } from "@/lib/types";

/**
 * Rule-based comment classifier (no LLM, no API).
 *
 * Inspired by Conventional Comments (https://conventionalcomments.org/) plus
 * common review-language heuristics. The classifier looks for explicit prefix
 * markers first (e.g. "nit:", "question:", "suggestion:") then falls back to
 * keyword + grammar heuristics.
 */

export type CommentKind =
  | "praise"
  | "approval"
  | "question"
  | "suggestion"
  | "issue"
  | "nitpick"
  | "todo"
  | "note";

/**
 * Orthogonal "concern" axis — what the comment is *about*, irrespective of the
 * grammatical kind. Useful because the same `nit:` prefix can carry either a
 * cosmetic ("rename foo to fooBar") or a functional ("await inside a loop")
 * concern, and reviewers / metrics should weigh them very differently.
 */
export type CommentConcern = "functional" | "cosmetic" | "other";

export interface CommentLabel {
  kind: CommentKind;
  /** Functional vs cosmetic vs other (process / praise / open-ended). */
  concern: CommentConcern;
  /** A short label for badges. */
  short: string;
  /** A short label for the concern badge. */
  concernShort: string;
  /** Confidence 0..1 — we don't really need it for now but it's free metadata. */
  confidence: number;
}

const CONVENTIONAL_PREFIXES: Array<[RegExp, CommentKind]> = [
  [/^\s*(nit|nits)\s*[:\-]/i, "nitpick"],
  [/^\s*(question|q)\s*[:\-]/i, "question"],
  [/^\s*(suggestion|suggest)\s*[:\-]/i, "suggestion"],
  [/^\s*(issue|bug)\s*[:\-]/i, "issue"],
  [/^\s*(todo|fixme)\s*[:\-]/i, "todo"],
  [/^\s*(praise|kudos)\s*[:\-]/i, "praise"],
  [/^\s*(note|fyi)\s*[:\-]/i, "note"],
];

const KIND_LABEL: Record<CommentKind, string> = {
  praise: "Praise",
  approval: "Approve",
  question: "Question",
  suggestion: "Suggestion",
  issue: "Bug",
  nitpick: "Nit",
  todo: "TODO",
  note: "Note",
};

const CONCERN_LABEL: Record<CommentConcern, string> = {
  functional: "Functional",
  cosmetic: "Cosmetic",
  other: "Other",
};

/**
 * Vocabulary for the functional concern — anything that touches behavior,
 * correctness, performance, security, error handling, or API contracts.
 * Order is irrelevant; we just check for any match.
 */
const FUNCTIONAL_PATTERNS: RegExp[] = [
  /\b(bug|broken|crash(es|ed|ing)?|error|exception|throw(s|n|ing)?|stack ?trace)\b/i,
  /\b(null ?pointer|null ?check|undefined|nullable|optional ?chaining|nullish)\b/i,
  /\b(race ?condition|deadlock|data ?race|concurren(t|cy)|atomic|thread[- ]safe|mutex|lock(ing)?)\b/i,
  /\b(memory ?leak|leak|gc ?pressure|out of memory|\boom\b)\b/i,
  /\b(regress(ion)?|breakage|won'?t compile|doesn'?t compile|type ?error)\b/i,
  /\b(n\+1|performance|perf|latenc(y|ies)|throughput|hot ?path|bottleneck|too ?slow|slowdown)\b/i,
  /\b(security|xss|csrf|injection|sql ?injection|escape|sanitiz(e|ation)|vulnerab|auth(z|n)?|credential|secret|token|leak(s|ed|ing)? secret)\b/i,
  /\b(edge ?case|off[- ]by[- ]one|boundary|overflow|underflow)\b/i,
  /\b(validat(e|ion)|missing (check|validation|guard))\b/i,
  /\b(error ?handling|retry|timeout|fallback|graceful(ly)?|swallow(ed|ing) (error|exception))\b/i,
  /\b(pagination|page ?size|cursor[- ]based)\b/i,
  /\b(idempoten(t|cy)|transaction(al)?|rollback)\b/i,
  /\b(side ?effect|mutat(e|ion|ing)|immutab|in[- ]place)\b/i,
  /\b(infinite ?loop|hang|spinning|stuck|busy ?wait)\b/i,
  /\b(deprecat(ed|ion))\b/i,
  /\b(await (in|inside) (a |the )?loop|sequential ?await|should be parallel|in parallel)\b/i,
  /\b(api ?contract|signature|return ?(type|value)|breaking ?change)\b/i,
  /\b(missing tests?|test ?coverage|untested|cover(ed|age) by tests?)\b/i,
  /\b(this (will|won'?t|may|could) (throw|crash|fail|break|leak|hang|deadlock))\b/i,
  /\b(wrong|incorrect|flawed|buggy|misbehave|misbehaving)\b/i,
];

/**
 * Vocabulary for the cosmetic concern — style, formatting, naming, wording,
 * imports, comments-about-comments. These cost almost nothing to address but
 * shouldn't drown out functional feedback in metrics.
 */
const COSMETIC_PATTERNS: RegExp[] = [
  /\b(typo|misspell(ed|ing)?|spelling|grammar|wording|phrasing|punctuat(e|ion)|capitaliz(e|ation)|casing)\b/i,
  /\b(whitespace|indent(ation)?|format(ting)?|prettier|eslint|lint(er)?)\b/i,
  /\b(newline|blank ?line|trailing (space|newline|comma|semicolon|whitespace)|extra (space|newline))\b/i,
  /\b(naming|rename|renamed?|variable ?name|method ?name|function ?name|identifier ?name|better ?name)\b/i,
  /\b(import ?order|organize ?imports|unused ?import|sort ?imports|group ?imports)\b/i,
  /\b(tab(s)? vs space(s)?|tabs only|spaces only)\b/i,
  /\b(quote(s)?|single[- ]?quote|double[- ]?quote|backtick)\b/i,
  /\b(jsdoc|doc[- ]?(string|comment)|comment grammar|copy[- ]?edit|copyedit|copywriting|comment wording)\b/i,
  /\b(stylistic|cosmetic|aesthetic|code ?style|consistent ?style)\b/i,
  /\b(alphabetiz(e|ed)|alphabetical ?order|sort ?(this|these)|move (this|these) (up|down|above|below))\b/i,
  /\b(line ?length|too ?long|wrap(ped)? line|max ?line)\b/i,
];

function classifyKind(c: NormalizedComment): {
  kind: CommentKind;
  confidence: number;
} {
  const body = (c.body ?? "").trim();
  if (body.length === 0 || c.reviewState === "APPROVED") {
    return { kind: "approval", confidence: 1 };
  }

  // 1. Conventional Comments prefix (highest confidence).
  for (const [re, kind] of CONVENTIONAL_PREFIXES) {
    if (re.test(body)) return { kind, confidence: 0.95 };
  }

  const lower = body.toLowerCase();

  // 2. Approval-ish reviews.
  if (
    /\b(lgtm|looks good|ship it|approve)\b/.test(lower) &&
    body.length < 200
  ) {
    return { kind: "approval", confidence: 0.85 };
  }

  // 3. Praise.
  if (
    /\b(nice|great|awesome|love this|👏|🎉|🚀)\b/.test(lower) &&
    body.length < 240
  ) {
    return { kind: "praise", confidence: 0.7 };
  }

  // 4. Question — ends with "?" or starts with WH-word / "is/are/can/could/should/would".
  if (
    body.endsWith("?") ||
    /^(why|how|what|when|where|which|is\b|are\b|can\b|could\b|should\b|would\b|do you\b|did\b)/i.test(
      body,
    )
  ) {
    return { kind: "question", confidence: 0.8 };
  }

  // 5. Bug / issue keywords.
  if (
    /\b(bug|broken|crash(es|ed)?|error|fails?|leak|race|deadlock|exception|stack ?trace|null pointer|undefined|throws?|wrong|incorrect|regress(ion)?|security|xss|csrf|injection|leak)s?\b/.test(
      lower,
    )
  ) {
    return { kind: "issue", confidence: 0.75 };
  }

  // 6. TODO follow-ups.
  if (/\b(todo|fixme|follow.?up|later|tech.?debt)\b/.test(lower)) {
    return { kind: "todo", confidence: 0.7 };
  }

  // 7. Suggestion — modal verbs, "consider", "could", "maybe", "prefer".
  if (
    /\b(should|could|consider|prefer|perhaps|maybe|might want to|why not|what if|let'?s|let us)\b/.test(
      lower,
    )
  ) {
    return { kind: "suggestion", confidence: 0.7 };
  }

  // 8. Nitpick — style-only or very short cosmetic comments.
  if (
    /\b(typo|whitespace|indent|format|spelling|capitalization|naming)\b/.test(
      lower,
    ) ||
    (body.length < 60 && /[\.,;:]/.test(body) === false)
  ) {
    return { kind: "nitpick", confidence: 0.55 };
  }

  return { kind: "note", confidence: 0.4 };
}

/**
 * Decide whether a comment is functional, cosmetic, or "other" (process /
 * praise / open-ended). Functional concerns dominate cosmetic ones because a
 * single body can mention both ("nit: rename foo, but also this can throw on
 * empty input") and the higher-stakes signal is what reviewers care about.
 */
export function classifyConcern(
  c: NormalizedComment,
  kind: CommentKind,
): CommentConcern {
  const body = (c.body ?? "").trim();
  if (body.length === 0) return "other";

  // Praise / approvals are interpersonal, not technical.
  if (kind === "praise" || kind === "approval") return "other";

  const hasFunctional = FUNCTIONAL_PATTERNS.some((p) => p.test(body));
  if (hasFunctional) return "functional";

  const hasCosmetic = COSMETIC_PATTERNS.some((p) => p.test(body));
  if (hasCosmetic) return "cosmetic";

  // Fall back by kind when no explicit vocabulary matched.
  if (kind === "issue") return "functional";
  if (kind === "nitpick") return "cosmetic";
  return "other";
}

export function classifyComment(c: NormalizedComment): CommentLabel {
  const { kind, confidence } = classifyKind(c);
  const concern = classifyConcern(c, kind);
  return {
    kind,
    concern,
    short: KIND_LABEL[kind],
    concernShort: CONCERN_LABEL[concern],
    confidence,
  };
}

export function classifyAll(comments: NormalizedComment[]): CommentLabel[] {
  return comments.map(classifyComment);
}

/**
 * Tally the kinds of comments in a thread, useful for headline summaries.
 */
export function summarizeKinds(comments: NormalizedComment[]) {
  const counts: Record<CommentKind, number> = {
    praise: 0,
    approval: 0,
    question: 0,
    suggestion: 0,
    issue: 0,
    nitpick: 0,
    todo: 0,
    note: 0,
  };
  for (const c of comments) {
    counts[classifyComment(c).kind]++;
  }
  return counts;
}

export const KIND_TONE: Record<CommentKind, string> = {
  praise: "success",
  approval: "success",
  question: "primary",
  suggestion: "primary",
  issue: "destructive",
  nitpick: "default",
  todo: "warning",
  note: "default",
};

/**
 * Bucket comments along the functional / cosmetic / other axis. Mirrors
 * `summarizeKinds` for headline counts and pie charts.
 */
export function summarizeConcerns(comments: NormalizedComment[]) {
  const counts: Record<CommentConcern, number> = {
    functional: 0,
    cosmetic: 0,
    other: 0,
  };
  for (const c of comments) {
    counts[classifyComment(c).concern]++;
  }
  return counts;
}

export const CONCERN_TONE: Record<CommentConcern, string> = {
  functional: "destructive",
  cosmetic: "primary",
  other: "default",
};

export { CONCERN_LABEL };
