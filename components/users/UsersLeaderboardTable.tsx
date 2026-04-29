"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Star } from "lucide-react";
import { useMemo, useState } from "react";
import {
  computeBestReviewers,
  computeUserHealth,
  HEALTH_LABEL,
  type HealthBand,
} from "@/lib/intelligence";
import type { NormalizedPR, UserStats } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Tooltip } from "../ui/tooltip";
import { Highlight } from "../Highlight";
import { UserDrawer } from "./UserDrawer";

type SortKey =
  | "score"
  | "health"
  | "prsAuthored"
  | "prsMerged"
  | "commentsGiven"
  | "R1_commentsGiven"
  | "R2_commentsGiven"
  | "commentsReceived"
  | "approvalsGiven"
  | "avgTimeToFirstReviewHours";

interface Props {
  users: UserStats[];
  prs?: NormalizedPR[];
  searchQuery?: string;
}

export function UsersLeaderboardTable({ users, prs = [], searchQuery }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeUser, setActiveUser] = useState<UserStats | null>(null);

  // Compute scores once and index by login.
  const intel = useMemo(() => {
    const map = new Map<
      string,
      { health: number; healthBand: HealthBand; isBestReviewer: boolean; bestRank?: number }
    >();
    for (const u of users) {
      const h = computeUserHealth(u, prs);
      map.set(u.login, {
        health: h.raw,
        healthBand: h.band,
        isBestReviewer: false,
      });
    }
    const best = computeBestReviewers(users, prs, 5);
    best.forEach((b) => {
      const slot = map.get(b.login);
      if (slot) {
        slot.isBestReviewer = true;
        slot.bestRank = b.rank;
      }
    });
    return map;
  }, [users, prs]);

  const sorted = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase();
    const filtered = q
      ? users.filter(
          (u) =>
            u.login.toLowerCase().includes(q) ||
            (u.name?.toLowerCase().includes(q) ?? false),
        )
      : users;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number;
      let bv: number;
      if (sortKey === "score") {
        av = a.commentsGiven + a.prsAuthored;
        bv = b.commentsGiven + b.prsAuthored;
      } else if (sortKey === "health") {
        av = intel.get(a.login)?.health ?? 0;
        bv = intel.get(b.login)?.health ?? 0;
      } else {
        av = (a[sortKey] ?? 0) as number;
        bv = (b[sortKey] ?? 0) as number;
      }
      const cmp = av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [users, sortKey, sortDir, searchQuery, intel]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const cols: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "health", label: "Health", align: "right" },
    { key: "prsAuthored", label: "PRs", align: "right" },
    { key: "prsMerged", label: "Merged", align: "right" },
    { key: "commentsGiven", label: "Comments given", align: "right" },
    { key: "R1_commentsGiven", label: "R1", align: "right" },
    { key: "R2_commentsGiven", label: "R2", align: "right" },
    { key: "commentsReceived", label: "Received", align: "right" },
    { key: "approvalsGiven", label: "Approvals", align: "right" },
    { key: "avgTimeToFirstReviewHours", label: "Avg TTFR", align: "right" },
  ];

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/95 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/80">
                <th className="px-4 py-2.5 font-medium data-[density=compact]:py-1.5">
                  User
                </th>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      sortKey === c.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cn(
                      "px-3 py-2.5 font-medium cursor-pointer select-none hover:text-foreground",
                      c.align === "right" && "text-right",
                    )}
                    onClick={() => onSort(c.key)}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        c.align === "right" && "justify-end",
                      )}
                    >
                      {c.label}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={cols.length + 1}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No contributors in this window.
                  </td>
                </tr>
              )}
              {sorted.map((u, i) => {
                const meta = intel.get(u.login);
                return (
                  <tr
                    key={u.login}
                    onClick={() => setActiveUser(u)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setActiveUser(u);
                    }}
                    tabIndex={0}
                    className={cn(
                      "border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors cursor-pointer focus:outline-none focus:bg-accent/40",
                      i % 2 === 1 && "bg-muted/20",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {u.avatarUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="h-7 w-7 rounded-full"
                          />
                        )}
                        <div>
                          <div className="font-medium leading-tight inline-flex items-center gap-1">
                            <Highlight text={u.login} query={searchQuery} />
                            {meta?.isBestReviewer && (
                              <Tooltip
                                content={`Top reviewer (rank #${meta.bestRank})`}
                              >
                                <Star
                                  className="h-3.5 w-3.5 fill-warning text-warning"
                                  aria-label="Top reviewer"
                                />
                              </Tooltip>
                            )}
                          </div>
                          {u.name && (
                            <div className="text-xs text-muted-foreground">
                              <Highlight text={u.name} query={searchQuery} />
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={
                            u.isBot
                              ? "bot"
                              : u.reviewerType === "R1"
                                ? "r1"
                                : "r2"
                          }
                        >
                          {u.isBot ? "BOT" : u.reviewerType}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <HealthCell band={meta?.healthBand} score={meta?.health} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNumber(u.prsAuthored)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNumber(u.prsMerged)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {formatNumber(u.commentsGiven)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-chart-1">
                      {formatNumber(u.R1_commentsGiven)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-chart-3">
                      {formatNumber(u.R2_commentsGiven)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNumber(u.commentsReceived)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatNumber(u.approvalsGiven)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {u.avgTimeToFirstReviewHours == null
                        ? "—"
                        : `${u.avgTimeToFirstReviewHours.toFixed(1)} h`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <UserDrawer
        user={activeUser}
        prs={prs}
        onClose={() => setActiveUser(null)}
      />
    </>
  );
}

function HealthCell({
  band,
  score,
}: {
  band?: HealthBand;
  score?: number;
}) {
  if (!band) return <span className="text-muted-foreground">—</span>;
  const variant =
    band === "good" ? "success" : band === "ok" ? "warning" : "destructive";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={variant}>{HEALTH_LABEL[band]}</Badge>
      {score != null && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {score}
        </span>
      )}
    </span>
  );
}
