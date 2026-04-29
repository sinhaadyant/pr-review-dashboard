"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical, RotateCcw, Star } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
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
import { Sparkline } from "../Sparkline";
import { UserDrawer } from "./UserDrawer";

type SortKey =
  | "score"
  | "health"
  | "activity14d"
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

const SPARK_DAYS = 14;

const COLUMN_DEFS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "health", label: "Health", align: "right" },
  { key: "activity14d", label: "14d", align: "right" },
  { key: "prsAuthored", label: "PRs", align: "right" },
  { key: "prsMerged", label: "Merged", align: "right" },
  { key: "commentsGiven", label: "Comments given", align: "right" },
  { key: "R1_commentsGiven", label: "R1", align: "right" },
  { key: "R2_commentsGiven", label: "R2", align: "right" },
  { key: "commentsReceived", label: "Received", align: "right" },
  { key: "approvalsGiven", label: "Approvals", align: "right" },
  { key: "avgTimeToFirstReviewHours", label: "Avg TTFR", align: "right" },
];

const DEFAULT_ORDER: SortKey[] = COLUMN_DEFS.map((c) => c.key);
const COLUMN_ORDER_KEY = "pr-dashboard:leaderboard-cols";

function parseOrder(raw: string | null): SortKey[] {
  if (!raw) return DEFAULT_ORDER;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    const valid = parsed.filter((k): k is SortKey =>
      DEFAULT_ORDER.includes(k as SortKey),
    );
    // Append any newly-introduced columns that weren't in the persisted order
    // so users don't lose them after an upgrade.
    for (const k of DEFAULT_ORDER) {
      if (!valid.includes(k)) valid.push(k);
    }
    return valid;
  } catch {
    return DEFAULT_ORDER;
  }
}

function computeUserSparkSeries(prs: NormalizedPR[]): Map<string, number[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayKeys: string[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const idxOf = new Map(dayKeys.map((k, i) => [k, i]));
  const out = new Map<string, number[]>();

  const ensure = (login: string) => {
    const lower = login.toLowerCase();
    let arr = out.get(lower);
    if (!arr) {
      arr = new Array(SPARK_DAYS).fill(0);
      out.set(lower, arr);
    }
    return arr;
  };

  for (const pr of prs) {
    const i = idxOf.get(pr.createdAt.slice(0, 10));
    if (i != null) ensure(pr.author)[i]++;
    for (const c of pr.comments) {
      const ci = idxOf.get(c.createdAt.slice(0, 10));
      if (ci == null) continue;
      ensure(c.author)[ci]++;
    }
  }
  return out;
}

export function UsersLeaderboardTable({ users, prs = [], searchQuery }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeUser, setActiveUser] = useState<UserStats | null>(null);

  const [columnOrder, setColumnOrder] = useLocalStorage<SortKey[]>(
    COLUMN_ORDER_KEY,
    parseOrder,
    DEFAULT_ORDER,
  );

  // Drag-and-drop column reorder. We track which column key is being dragged
  // and which column key the cursor is currently over so we can render a
  // drop-indicator on the target.
  const [dragKey, setDragKey] = useState<SortKey | null>(null);
  const [overKey, setOverKey] = useState<SortKey | null>(null);
  const draggingRef = useRef(false);

  const colsByKey = useMemo(
    () => new Map(COLUMN_DEFS.map((c) => [c.key, c])),
    [],
  );
  const cols = useMemo(
    () => columnOrder.map((k) => colsByKey.get(k)).filter(Boolean) as typeof COLUMN_DEFS,
    [columnOrder, colsByKey],
  );

  const isReordered = useMemo(
    () => columnOrder.some((k, i) => k !== DEFAULT_ORDER[i]),
    [columnOrder],
  );

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

  const sparkByUser = useMemo(() => computeUserSparkSeries(prs), [prs]);
  const activitySumByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const [login, series] of sparkByUser) {
      map.set(
        login,
        series.reduce((a, b) => a + b, 0),
      );
    }
    return map;
  }, [sparkByUser]);

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
      } else if (sortKey === "activity14d") {
        av = activitySumByUser.get(a.login.toLowerCase()) ?? 0;
        bv = activitySumByUser.get(b.login.toLowerCase()) ?? 0;
      } else {
        av = (a[sortKey] ?? 0) as number;
        bv = (b[sortKey] ?? 0) as number;
      }
      const cmp = av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [users, sortKey, sortDir, searchQuery, intel, activitySumByUser]);

  const onSort = (k: SortKey) => {
    if (draggingRef.current) return;
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const reorderColumn = (from: SortKey, to: SortKey) => {
    if (from === to) return;
    const next = columnOrder.slice();
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, from);
    setColumnOrder(next);
  };

  const resetColumns = () => setColumnOrder(DEFAULT_ORDER);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isReordered && (
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <span>Custom column order applied.</span>
            <button
              type="button"
              onClick={resetColumns}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset columns
            </button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/95 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur supports-backdrop-filter:bg-muted/80">
                <th className="px-4 py-2.5 font-medium data-[density=compact]:py-1.5">
                  User
                </th>
                {cols.map((c) => {
                  const isDragging = dragKey === c.key;
                  const isOver = overKey === c.key && dragKey && dragKey !== c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      draggable
                      aria-sort={
                        sortKey === c.key
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className={cn(
                        "group px-3 py-2.5 font-medium select-none cursor-pointer hover:text-foreground transition-colors",
                        c.align === "right" && "text-right",
                        isDragging && "opacity-40",
                        isOver && "bg-primary/10 text-foreground",
                      )}
                      onDragStart={(e) => {
                        draggingRef.current = true;
                        setDragKey(c.key);
                        e.dataTransfer.effectAllowed = "move";
                        // Some browsers require setData to even start a drag.
                        e.dataTransfer.setData("text/plain", c.key);
                      }}
                      onDragEnter={() => setOverKey(c.key)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDragLeave={(e) => {
                        // Only clear if leaving the th entirely (not entering a child).
                        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                          setOverKey((k) => (k === c.key ? null : k));
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragKey) reorderColumn(dragKey, c.key);
                        setDragKey(null);
                        setOverKey(null);
                        // Defer the click suppression flag so onClick fired by the
                        // mouseup doesn't accidentally trigger sort.
                        setTimeout(() => {
                          draggingRef.current = false;
                        }, 0);
                      }}
                      onDragEnd={() => {
                        setDragKey(null);
                        setOverKey(null);
                        setTimeout(() => {
                          draggingRef.current = false;
                        }, 0);
                      }}
                      onClick={() => onSort(c.key)}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          c.align === "right" && "justify-end",
                        )}
                      >
                        <GripVertical
                          className="h-3 w-3 cursor-grab text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-hidden
                        />
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
                  );
                })}
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
                const spark = sparkByUser.get(u.login.toLowerCase()) ?? [];
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
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums",
                          overKey === c.key && dragKey && dragKey !== c.key && "bg-primary/5",
                        )}
                      >
                        {renderCell(c.key, u, meta, spark)}
                      </td>
                    ))}
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

function renderCell(
  key: SortKey,
  u: UserStats,
  meta:
    | {
        health: number;
        healthBand: HealthBand;
        isBestReviewer: boolean;
        bestRank?: number;
      }
    | undefined,
  spark: number[],
): React.ReactNode {
  switch (key) {
    case "health":
      return <HealthCell band={meta?.healthBand} score={meta?.health} />;
    case "activity14d":
      return spark.some((v) => v > 0) ? (
        <span className="inline-flex items-center justify-end">
          <Sparkline
            values={spark}
            width={70}
            height={18}
            color="hsl(var(--chart-1))"
            ariaLabel={`${u.login} 14-day activity`}
          />
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case "prsAuthored":
      return formatNumber(u.prsAuthored);
    case "prsMerged":
      return formatNumber(u.prsMerged);
    case "commentsGiven":
      return <span className="font-semibold">{formatNumber(u.commentsGiven)}</span>;
    case "R1_commentsGiven":
      return <span className="text-chart-1">{formatNumber(u.R1_commentsGiven)}</span>;
    case "R2_commentsGiven":
      return <span className="text-chart-3">{formatNumber(u.R2_commentsGiven)}</span>;
    case "commentsReceived":
      return formatNumber(u.commentsReceived);
    case "approvalsGiven":
      return formatNumber(u.approvalsGiven);
    case "avgTimeToFirstReviewHours":
      return (
        <span className="text-muted-foreground">
          {u.avgTimeToFirstReviewHours == null
            ? "—"
            : `${u.avgTimeToFirstReviewHours.toFixed(1)} h`}
        </span>
      );
    default:
      return null;
  }
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
