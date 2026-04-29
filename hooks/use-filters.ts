"use client";

import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringEnum,
  parseAsBoolean,
  useQueryStates,
} from "nuqs";

export const filterParsers = {
  orgs: parseAsArrayOf(parseAsString).withDefault([]),
  repos: parseAsArrayOf(parseAsString).withDefault([]),
  sprint: parseAsString,
  from: parseAsString,
  to: parseAsString,
  users: parseAsArrayOf(parseAsString).withDefault([]),
  state: parseAsStringEnum(["open", "merged", "closed", "all"]).withDefault(
    "all",
  ),
  reviewerType: parseAsStringEnum(["R1", "R2", "all"]).withDefault("all"),
  q: parseAsString.withDefault(""),
  excludeBots: parseAsBoolean.withDefault(true),
  tab: parseAsStringEnum(["users", "repos", "activity"]).withDefault("users"),
};

export function useFilters() {
  return useQueryStates(filterParsers, { shallow: false });
}

export type Filters = ReturnType<typeof useFilters>[0];

export function buildAggregateQuery(filters: Filters): string {
  const sp = new URLSearchParams();
  if (filters.orgs.length) sp.set("orgs", filters.orgs.join(","));
  if (filters.repos.length) sp.set("repos", filters.repos.join(","));
  if (filters.sprint) sp.set("sprint", filters.sprint);
  if (filters.from) sp.set("from", filters.from);
  if (filters.to) sp.set("to", filters.to);
  if (filters.users.length) sp.set("users", filters.users.join(","));
  if (filters.state !== "all") sp.set("state", filters.state);
  if (filters.reviewerType !== "all")
    sp.set("reviewerType", filters.reviewerType);
  if (!filters.excludeBots) sp.set("excludeBots", "false");
  return sp.toString();
}
