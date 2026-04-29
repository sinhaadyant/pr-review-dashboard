"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { NormalizedPR, UserStats } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Highlight } from "../Highlight";
import { UserDrawer } from "./UserDrawer";

type SortKey =
  | "score"
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
      const av =
        sortKey === "score"
          ? a.commentsGiven + a.prsAuthored
          : (a[sortKey] ?? 0);
      const bv =
        sortKey === "score"
          ? b.commentsGiven + b.prsAuthored
          : (b[sortKey] ?? 0);
      const cmp = (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [users, sortKey, sortDir, searchQuery]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const cols: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "prsAuthored", label: "PRs", align: "right" },
    { key: "prsMerged", label: "Merged", align: "right" },
    { key: "commentsGiven", label: "Comments given", align: "right" },
    { key: "R1_commentsGiven", label: "R1", align: "right" },
    { key: "R2_commentsGiven", label: "R2", align: "right" },
    { key: "commentsReceived", label: "Received", align: "right" },
    { key: "approvalsGiven", label: "Approvals", align: "right" },
    { key: "avgTimeToFirstReviewHours", label: "Avg TTFR", align: "right" },
  ];

  // Density-aware row height. The data-density attribute is set on <html> by useDensity().
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
              {sorted.map((u, i) => (
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
                        <div className="font-medium leading-tight">
                          <Highlight text={u.login} query={searchQuery} />
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
              ))}
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
