import { NextResponse } from "next/server";
import { getSprintConfig } from "@/lib/date";

export const runtime = "nodejs";

export async function GET() {
  const sprintCfg = getSprintConfig();
  return NextResponse.json({
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "PR Analytics",
    sprints: sprintCfg.sprints,
    activeSprintId: sprintCfg.activeSprintId,
    allowPrivateRepos: process.env.ALLOW_PRIVATE_REPOS !== "false",
    discoveryAvailable: !!process.env.GITHUB_TOKEN,
  });
}
