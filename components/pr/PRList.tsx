"use client";

import {
  AlertOctagon,
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Heart,
  HeartCrack,
  HeartPulse,
  MessageSquare,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  classifyComment,
  computeHealth,
  computeRisk,
  HEALTH_LABEL,
  RISK_LABEL,
  summarizeConcerns,
  type CommentLabel,
  type HealthBand,
  type RiskBand,
} from "@/lib/intelligence";
import type { NormalizedComment, NormalizedPR } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tooltip } from "../ui/tooltip";
import { Highlight } from "../Highlight";

interface Props {
  prs: NormalizedPR[];
  searchQuery?: string;
  pageSize?: number;
}

export function PRList({ prs, searchQuery, pageSize = 50 }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [visible, setVisible] = useState(pageSize);

  const visiblePRs = useMemo(() => prs.slice(0, visible), [prs, visible]);

  if (prs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        {searchQuery
          ? `No PRs match "${searchQuery}".`
          : "No PRs in this window."}
      </div>
    );
  }

  const toggle = (id: number) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {visiblePRs.map((pr) => (
        <div key={pr.id} className="border-b border-border last:border-b-0">
          <PRRow
            pr={pr}
            expanded={expanded.has(pr.id)}
            searchQuery={searchQuery}
            onToggle={() => toggle(pr.id)}
          />
        </div>
      ))}
      {prs.length > visible && (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
          <div className="text-xs text-muted-foreground tabular-nums">
            Showing{" "}
            <span className="font-semibold text-foreground">{visible}</span> of{" "}
            <span className="font-semibold text-foreground">{prs.length}</span>{" "}
            PRs
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setVisible((v) => Math.min(prs.length, v + pageSize))
              }
            >
              Load {Math.min(pageSize, prs.length - visible)} more
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisible(prs.length)}
            >
              Show all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PRRow({
  pr,
  expanded,
  searchQuery,
  onToggle,
}: {
  pr: NormalizedPR;
  expanded: boolean;
  searchQuery?: string;
  onToggle: () => void;
}) {
  const totalChange = pr.additions + pr.deletions;
  const addPct = totalChange === 0 ? 0 : (pr.additions / totalChange) * 100;
  const risk = useMemo(() => computeRisk(pr), [pr]);
  const health = useMemo(() => computeHealth(pr), [pr]);
  const concerns = useMemo(
    () => summarizeConcerns(pr.comments.filter((c) => !c.isBot)),
    [pr.comments],
  );

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-180",
          )}
        />
        <StateIcon state={pr.state} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground tabular-nums">
              <Highlight text={pr.fullName} query={searchQuery} />#{pr.number}
            </span>
            <Badge
              variant={
                pr.state === "merged"
                  ? "primary"
                  : pr.state === "open"
                    ? "warning"
                    : "default"
              }
            >
              {pr.state}
            </Badge>
            <RiskBadge
              risk={risk.band}
              score={risk.raw}
              factors={risk.factors}
            />
            <HealthBadge
              health={health.band}
              score={health.raw}
              reasons={health.reasons}
            />
            <span className="text-xs text-muted-foreground">
              by <Highlight text={pr.author} query={searchQuery} />
            </span>
          </div>
          <div className="truncate text-sm font-medium">
            <Highlight text={pr.title} query={searchQuery} />
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground tabular-nums shrink-0">
          {totalChange > 0 && (
            <DiffStat
              additions={pr.additions}
              deletions={pr.deletions}
              addPct={addPct}
            />
          )}
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {formatNumber(pr.totalComments)}
          </span>
          <ConcernSplit concerns={concerns} />
          <span className="text-chart-1">R1 {pr.R1Comments}</span>
          <span className="text-chart-3">R2 {pr.R2Comments}</span>
          {pr.approvals > 0 && (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="h-3 w-3" />
              {pr.approvals}
            </span>
          )}
          {pr.changesRequested > 0 && (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3" />
              {pr.changesRequested}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <CommentList comments={pr.comments} prHtmlUrl={pr.htmlUrl} />
      )}
    </div>
  );
}

function RiskBadge({
  risk,
  score,
  factors,
}: {
  risk: RiskBand;
  score: number;
  factors: { label: string; value: number }[];
}) {
  const variant: "success" | "warning" | "destructive" =
    risk === "low" ? "success" : risk === "medium" ? "warning" : "destructive";
  const Icon =
    risk === "high" ? AlertOctagon : risk === "medium" ? Shield : ShieldCheck;
  return (
    <Tooltip
      content={
        <div className="text-left">
          <div className="font-semibold mb-1">
            {RISK_LABEL[risk]} · score {score}
          </div>
          {factors.length === 0 ? (
            <div className="text-muted-foreground">
              No risk factors detected.
            </div>
          ) : (
            <ul className="space-y-0.5 text-muted-foreground">
              {factors.map((f) => (
                <li key={f.label}>
                  {f.label}: {Math.round(f.value)}
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    >
      <Badge variant={variant} className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {RISK_LABEL[risk]}
      </Badge>
    </Tooltip>
  );
}

function HealthBadge({
  health,
  score,
  reasons,
}: {
  health: HealthBand;
  score: number;
  reasons: string[];
}) {
  const variant: "success" | "warning" | "destructive" =
    health === "good" ? "success" : health === "ok" ? "warning" : "destructive";
  const Icon =
    health === "good" ? HeartPulse : health === "ok" ? Heart : HeartCrack;
  return (
    <Tooltip
      content={
        <div className="text-left">
          <div className="font-semibold mb-1">
            {HEALTH_LABEL[health]} health · score {score}
          </div>
          {reasons.length === 0 ? (
            <div className="text-muted-foreground">
              {health === "good"
                ? "Healthy review signal."
                : "No specific issues detected."}
            </div>
          ) : (
            <ul className="space-y-0.5 text-muted-foreground list-disc pl-4">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      }
    >
      <Badge variant={variant} className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {HEALTH_LABEL[health]}
      </Badge>
    </Tooltip>
  );
}

function DiffStat({
  additions,
  deletions,
  addPct,
}: {
  additions: number;
  deletions: number;
  addPct: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`+${additions} / -${deletions}`}
    >
      <span className="text-success tabular-nums">
        +{formatNumber(additions)}
      </span>
      <span className="text-destructive tabular-nums">
        -{formatNumber(deletions)}
      </span>
      <span className="ml-0.5 inline-flex h-2 w-10 overflow-hidden rounded-full bg-muted">
        <span
          className="h-full bg-success"
          style={{ width: `${addPct}%` }}
          aria-hidden
        />
        <span
          className="h-full bg-destructive"
          style={{ width: `${100 - addPct}%` }}
          aria-hidden
        />
      </span>
    </span>
  );
}

function StateIcon({ state }: { state: NormalizedPR["state"] }) {
  if (state === "merged") return <GitMerge className="h-4 w-4 text-chart-1" />;
  if (state === "open")
    return <GitPullRequest className="h-4 w-4 text-success" />;
  return <GitPullRequestClosed className="h-4 w-4 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// CommentList — now shows classifier badges and groups comments into rough
// reply threads (per file path) so reviewers can follow back-and-forth.
// ---------------------------------------------------------------------------

interface CommentWithKind {
  comment: NormalizedComment;
  label: CommentLabel;
}

function groupIntoThreads(
  comments: NormalizedComment[],
): { key: string; title: string; items: CommentWithKind[] }[] {
  // Group by filePath when available; otherwise lump under "Conversation".
  const groups = new Map<string, CommentWithKind[]>();
  for (const c of comments) {
    const key = c.filePath ?? "__general__";
    const slot = groups.get(key) ?? [];
    slot.push({ comment: c, label: classifyComment(c) });
    groups.set(key, slot);
  }
  return Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      title: key === "__general__" ? "Conversation" : key,
      items: items.sort(
        (a, b) =>
          Date.parse(a.comment.createdAt) - Date.parse(b.comment.createdAt),
      ),
    }))
    .sort((a, b) => {
      if (a.key === "__general__") return -1;
      if (b.key === "__general__") return 1;
      return a.title.localeCompare(b.title);
    });
}

function CommentList({
  comments,
  prHtmlUrl,
}: {
  comments: NormalizedComment[];
  prHtmlUrl: string;
}) {
  const threads = useMemo(() => groupIntoThreads(comments), [comments]);

  if (comments.length === 0) {
    return (
      <div className="bg-muted/30 px-12 py-4 text-sm text-muted-foreground">
        No comments on this PR.{" "}
        <a
          className="text-foreground hover:underline"
          href={prHtmlUrl}
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub
        </a>
      </div>
    );
  }
  return (
    <div className="bg-muted/30 px-12 py-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {comments.length} comment{comments.length !== 1 && "s"} ·{" "}
          {threads.length} thread{threads.length !== 1 && "s"}
        </div>
        <a
          href={prHtmlUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Open in GitHub
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-2">
        {threads.map((t) => (
          <div
            key={t.key}
            className="rounded-md border border-border bg-card overflow-hidden"
          >
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-mono truncate">
              {t.title}
              <span className="ml-2 text-muted-foreground">
                ({t.items.length} comment{t.items.length === 1 ? "" : "s"})
              </span>
            </div>
            <ul className="divide-y divide-border">
              {t.items.map(({ comment: c, label }) => (
                <li key={`${c.source}-${c.id}`} className="p-3">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-semibold">{c.author}</span>
                    <Badge
                      variant={
                        c.isBot ? "bot" : c.reviewerType === "R1" ? "r1" : "r2"
                      }
                    >
                      {c.isBot ? "BOT" : c.reviewerType}
                    </Badge>
                    <KindBadge label={label} />
                    <ConcernBadge label={label} />
                    {c.reviewState && c.reviewState !== "COMMENTED" && (
                      <Badge variant="primary">{c.reviewState}</Badge>
                    )}
                    <span className="ml-auto text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {c.body && (
                    <div className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-snug">
                      {c.body.length > 600
                        ? c.body.slice(0, 600) + "…"
                        : c.body}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function KindBadge({ label }: { label: CommentLabel }) {
  const variant: "default" | "success" | "warning" | "destructive" | "primary" =
    label.kind === "issue"
      ? "destructive"
      : label.kind === "todo"
        ? "warning"
        : label.kind === "approval" || label.kind === "praise"
          ? "success"
          : label.kind === "question" || label.kind === "suggestion"
            ? "primary"
            : "default";
  return <Badge variant={variant}>{label.short}</Badge>;
}

function ConcernBadge({ label }: { label: CommentLabel }) {
  if (label.concern === "other") return null;
  const variant = label.concern === "functional" ? "destructive" : "primary";
  return (
    <Badge variant={variant} className="font-normal">
      {label.concernShort}
    </Badge>
  );
}

function ConcernSplit({
  concerns,
}: {
  concerns: { functional: number; cosmetic: number; other: number };
}) {
  const total = concerns.functional + concerns.cosmetic + concerns.other;
  if (total === 0) return null;
  const pct = (n: number) => (n / total) * 100;
  return (
    <Tooltip
      content={
        <div className="text-left">
          <div className="font-semibold mb-1">Comment focus</div>
          <ul className="space-y-0.5 text-muted-foreground">
            <li>
              <span className="text-destructive">Functional</span>:{" "}
              {concerns.functional}
            </li>
            <li>
              <span className="text-chart-1">Cosmetic</span>:{" "}
              {concerns.cosmetic}
            </li>
            <li>Other: {concerns.other}</li>
          </ul>
        </div>
      }
    >
      <span
        className="inline-flex h-1.5 w-12 overflow-hidden rounded-full bg-muted"
        aria-label={`Functional ${concerns.functional}, cosmetic ${concerns.cosmetic}, other ${concerns.other}`}
      >
        <span
          className="h-full bg-destructive"
          style={{ width: `${pct(concerns.functional)}%` }}
          aria-hidden
        />
        <span
          className="h-full bg-chart-1"
          style={{ width: `${pct(concerns.cosmetic)}%` }}
          aria-hidden
        />
        <span
          className="h-full bg-muted-foreground/40"
          style={{ width: `${pct(concerns.other)}%` }}
          aria-hidden
        />
      </span>
    </Tooltip>
  );
}
