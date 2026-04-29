import type { AggregatedResponse, NormalizedPR } from "./types";

const COLUMNS = [
  "owner",
  "repo",
  "sprint",
  "pr_number",
  "pr_title",
  "pr_author",
  "pr_state",
  "pr_created_at",
  "pr_merged_at",
  "pr_additions",
  "pr_deletions",
  "pr_changed_files",
  "total_comments",
  "R1_comments",
  "R2_comments",
  "approvals",
  "changes_requested",
  "comment_id",
  "comment_source",
  "reviewer_type",
  "comment_author",
  "comment_author_is_bot",
  "review_state",
  "comment_created_at",
  "file_path",
  "comment_body",
] as const;

function escape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowFromPRWithoutComments(pr: NormalizedPR, sprint: string): string[] {
  return [
    pr.owner,
    pr.repo,
    sprint,
    String(pr.number),
    pr.title,
    pr.author,
    pr.state,
    pr.createdAt,
    pr.mergedAt ?? "",
    String(pr.additions),
    String(pr.deletions),
    String(pr.changedFiles),
    String(pr.totalComments),
    String(pr.R1Comments),
    String(pr.R2Comments),
    String(pr.approvals),
    String(pr.changesRequested),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];
}

function rowFromComment(
  pr: NormalizedPR,
  c: NormalizedPR["comments"][number],
  sprint: string,
): string[] {
  return [
    pr.owner,
    pr.repo,
    sprint,
    String(pr.number),
    pr.title,
    pr.author,
    pr.state,
    pr.createdAt,
    pr.mergedAt ?? "",
    String(pr.additions),
    String(pr.deletions),
    String(pr.changedFiles),
    String(pr.totalComments),
    String(pr.R1Comments),
    String(pr.R2Comments),
    String(pr.approvals),
    String(pr.changesRequested),
    c.id,
    c.source,
    c.reviewerType,
    c.author,
    String(c.isBot),
    c.reviewState ?? "",
    c.createdAt,
    c.filePath ?? "",
    c.body,
  ];
}

export function aggregateToCSV(data: AggregatedResponse): string {
  const sprint = data.appliedFilters.sprint ?? "custom";
  const lines: string[] = [];
  lines.push("\uFEFF" + COLUMNS.join(","));
  for (const pr of data.prs) {
    if (pr.comments.length === 0) {
      lines.push(rowFromPRWithoutComments(pr, sprint).map(escape).join(","));
    } else {
      const sortedComments = [...pr.comments].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      );
      for (const c of sortedComments) {
        lines.push(rowFromComment(pr, c, sprint).map(escape).join(","));
      }
    }
  }
  return lines.join("\r\n");
}

export function csvFilename(data: AggregatedResponse): string {
  const sprint = data.appliedFilters.sprint ?? "custom";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const repos = data.appliedFilters.repos;
  const orgs = data.appliedFilters.orgs;
  let scope: string;
  if (repos.length === 1) scope = repos[0].replace("/", "-");
  else if (orgs.length === 1) scope = orgs[0];
  else scope = "all";
  return `pr-analytics-${scope}-${sprint}-${ts}.csv`;
}
