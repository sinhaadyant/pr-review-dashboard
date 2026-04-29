"use client";

import {
  Check,
  ChevronDown,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  MessageSquare,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { NormalizedComment, NormalizedPR } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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
            Showing <span className="font-semibold text-foreground">{visible}</span> of{" "}
            <span className="font-semibold text-foreground">{prs.length}</span> PRs
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisible((v) => Math.min(prs.length, v + pageSize))}
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
          <div className="flex items-center gap-2">
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
              <X className="h-3 w-3" />
              {pr.changesRequested}
            </span>
          )}
        </div>
      </button>
      {expanded && <CommentList comments={pr.comments} prHtmlUrl={pr.htmlUrl} />}
    </div>
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
      <span className="text-success tabular-nums">+{formatNumber(additions)}</span>
      <span className="text-destructive tabular-nums">-{formatNumber(deletions)}</span>
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

function CommentList({
  comments,
  prHtmlUrl,
}: {
  comments: NormalizedComment[];
  prHtmlUrl: string;
}) {
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
    <div className="bg-muted/30 px-12 py-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {comments.length} comment{comments.length !== 1 && "s"}
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
      <ul className="space-y-2 max-h-72 overflow-y-auto pr-2">
        {comments.map((c) => (
          <li
            key={`${c.source}-${c.id}`}
            className="rounded-md border border-border bg-card p-3"
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold">{c.author}</span>
              <Badge
                variant={c.isBot ? "bot" : c.reviewerType === "R1" ? "r1" : "r2"}
              >
                {c.isBot ? "BOT" : c.reviewerType}
              </Badge>
              <Badge variant="outline">{c.source.replace("_", " ")}</Badge>
              {c.reviewState && <Badge variant="primary">{c.reviewState}</Badge>}
              <span className="ml-auto text-muted-foreground">
                {new Date(c.createdAt).toLocaleString()}
              </span>
            </div>
            {c.filePath && (
              <div className="mt-1 text-xs font-mono text-muted-foreground truncate">
                {c.filePath}
              </div>
            )}
            {c.body && (
              <div className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-snug">
                {c.body.length > 600 ? c.body.slice(0, 600) + "…" : c.body}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
