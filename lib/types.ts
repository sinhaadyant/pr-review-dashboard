export type ReviewerType = "R1" | "R2";
export type PRState = "open" | "merged" | "closed";
export type CommentSource = "issue" | "review_comment" | "review_submission";
export type ReviewState =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "COMMENTED"
  | "DISMISSED"
  | null;

export interface TeamMember {
  githubUsername: string;
  name?: string;
  role?: string;
  email?: string;
}

export interface TeamConfig {
  members: TeamMember[];
  bots: string[];
  config: {
    excludeBots: boolean;
    deletedUserClassification: ReviewerType;
  };
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
}

export interface SprintConfig {
  activeSprintId: string;
  sprints: Sprint[];
}

export interface DiscoveredOrg {
  login: string;
  avatarUrl: string;
  repoCount: number;
}

export interface DiscoveredRepo {
  fullName: string;
  owner: string;
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  defaultBranch: string;
  pushedAt: string;
}

export interface DiscoveryResult {
  user: { login: string; avatarUrl: string };
  orgs: DiscoveredOrg[];
  repos: DiscoveredRepo[];
  generatedAt: string;
  expiresAt: string;
}

export interface NormalizedComment {
  id: string;
  source: CommentSource;
  author: string;
  body: string;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
  reviewerType: ReviewerType;
  isBot: boolean;
  reviewState: ReviewState;
}

export interface NormalizedPR {
  id: number;
  number: number;
  repo: string;
  owner: string;
  fullName: string;
  title: string;
  author: string;
  authorAvatarUrl: string;
  state: PRState;
  htmlUrl: string;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  totalComments: number;
  R1Comments: number;
  R2Comments: number;
  approvals: number;
  changesRequested: number;
  timeToFirstReviewHours: number | null;
  timeToMergeHours: number | null;
  comments: NormalizedComment[];
}

export interface UserStats {
  login: string;
  name?: string;
  avatarUrl: string;
  reviewerType: ReviewerType;
  isBot: boolean;
  prsAuthored: number;
  prsMerged: number;
  prsOpen: number;
  prsClosed: number;
  commentsGiven: number;
  R1_commentsGiven: number;
  R2_commentsGiven: number;
  commentsReceived: number;
  approvalsGiven: number;
  changesRequestedGiven: number;
  avgTimeToFirstReviewHours: number | null;
  avgTimeToMergeHours: number | null;
  topRepos: { fullName: string; prs: number; comments: number }[];
}

export interface RepoStats {
  fullName: string;
  prsTotal: number;
  prsMerged: number;
  R1_comments: number;
  R2_comments: number;
  contributorsCount: number;
}

export interface AppliedFilters {
  orgs: string[];
  repos: string[];
  sprint: string | null;
  from: string | null;
  to: string | null;
  users: string[];
  state: PRState | "all";
  reviewerType: ReviewerType | "all";
  excludeBots: boolean;
}

export interface CacheMeta {
  hit: boolean;
  stale: boolean;
  generatedAt: string;
  expiresAt: string;
}

export interface AggregatedResponse {
  users: UserStats[];
  repos: RepoStats[];
  prs: NormalizedPR[];
  stats: {
    reposCount: number;
    contributorsCount: number;
    totalPRs: number;
    merged: number;
    open: number;
    closed: number;
    R1_comments: number;
    R2_comments: number;
    approvals: number;
    changes_requested: number;
    avg_time_to_first_review_hours: number;
    avg_time_to_merge_hours: number;
    p50_time_to_first_review_hours: number;
  };
  appliedFilters: AppliedFilters;
  cache: CacheMeta;
  partial?: boolean;
  reposSkipped?: string[];
  rateLimited?: boolean;
  generatedAt: string;
}
