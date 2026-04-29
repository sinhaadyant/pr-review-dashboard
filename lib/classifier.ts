import teamJson from "@/data/team.json";
import type { ReviewerType, TeamConfig } from "./types";

const team = teamJson as TeamConfig;

const teamSet = new Set(
  team.members.map((m) => m.githubUsername.toLowerCase()),
);
const botSet = new Set(team.bots.map((b) => b.toLowerCase()));
const teamLookup = new Map(
  team.members.map((m) => [m.githubUsername.toLowerCase(), m]),
);

export interface ClassifyOptions {
  excludeBots?: boolean;
}

export function getTeam(): TeamConfig {
  return team;
}

export function classifyReviewer(
  login: string | null | undefined,
): ReviewerType {
  if (!login) return team.config.deletedUserClassification;
  return teamSet.has(login.toLowerCase()) ? "R1" : "R2";
}

export function isBot(
  login: string | null | undefined,
  type?: string | null,
): boolean {
  if (!login) return false;
  if (type && type.toLowerCase() === "bot") return true;
  if (login.endsWith("[bot]")) return true;
  return botSet.has(login.toLowerCase());
}

export function getMember(login: string) {
  return teamLookup.get(login.toLowerCase());
}

export function shouldIncludeUser(
  login: string | null | undefined,
  userType: string | null | undefined,
  options: ClassifyOptions = {},
): boolean {
  const excludeBots = options.excludeBots ?? team.config.excludeBots;
  if (!login) return false;
  if (excludeBots && isBot(login, userType)) return false;
  return true;
}

export function classifyAll(
  login: string,
  userType: string | null | undefined,
): { reviewerType: ReviewerType; isBot: boolean; name?: string } {
  const member = getMember(login);
  return {
    reviewerType: classifyReviewer(login),
    isBot: isBot(login, userType),
    name: member?.name,
  };
}
