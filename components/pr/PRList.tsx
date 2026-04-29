"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
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
import { useRef, useState } from "react";
import type { NormalizedComment, NormalizedPR } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Highlight } from "../Highlight";

interface Props {
  prs: NormalizedPR[];
  searchQuery?: string;
}

export function PRList({ prs, searchQuery }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const rowVirtualizer = useVirtualizer({
    count: prs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (expanded.has(prs[i].id) ? 360 : 64),
    overscan: 5,
  });

  if (prs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        {searchQuery
          ? `No PRs match "${searchQuery}".`
          : "No PRs in this window."}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto rounded-xl border border-border bg-card"
      style={{ height: "70vh" }}
    >
      <div
        style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
      >
        {rowVirtualizer.getVirtualItems().map((virtual) => {
          const pr = prs[virtual.index];
          const open = expanded.has(pr.id);
          return (
            <div
              key={pr.id}
              data-index={virtual.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${virtual.start}px)`,
              }}
              className="border-b border-border last:border-b-0"
            >
              <PRRow
                pr={pr}
                expanded={open}
                searchQuery={searchQuery}
                onToggle={() => {
                  setExpanded((s) => {
                    const next = new Set(s);
                    if (next.has(pr.id)) next.delete(pr.id);
                    else next.add(pr.id);
                    return next;
                  });
                }}
              />
            </div>
          );
        })}
      </div>
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
      {expanded && (
        <CommentList comments={pr.comments} prHtmlUrl={pr.htmlUrl} />
      )}
    </div>
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
    <div className="bg-muted/30 px-12 py-4 space-y-3">
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
                variant={
                  c.isBot ? "bot" : c.reviewerType === "R1" ? "r1" : "r2"
                }
              >
                {c.isBot ? "BOT" : c.reviewerType}
              </Badge>
              <Badge variant="outline">{c.source.replace("_", " ")}</Badge>
              {c.reviewState && (
                <Badge variant="primary">{c.reviewState}</Badge>
              )}
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
