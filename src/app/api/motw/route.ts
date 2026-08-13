import { NextResponse } from "next/server";
import { getAllGwScores, getAllManagers, getGwScoresForGameweek, getLatestFinishedGameweekId } from "@/lib/db";
import { buildMotwLeaderboard, getWeeklyMotwWinners } from "@/lib/motw";

export const dynamic = "force-dynamic";

// Serves the always-visible MOTW leaderboard (Section 5.1) plus the current
// gameweek's winner(s), read entirely from the local DB — this is the
// stored history a live FPL call can't give us on its own.
export async function GET() {
  const managers = await getAllManagers();
  const managerById = new Map(managers.map((m) => [m.id, m]));

  const allScores = await getAllGwScores();
  const leaderboard = buildMotwLeaderboard(allScores).map((entry) => ({
    ...entry,
    managerName: managerById.get(entry.managerId)?.name ?? "Unknown",
    teamName: managerById.get(entry.managerId)?.team_name ?? "Unknown",
  }));

  const latestGw = await getLatestFinishedGameweekId();
  const currentWeekWinners =
    latestGw === null
      ? []
      : getWeeklyMotwWinners(await getGwScoresForGameweek(latestGw)).map((managerId) => ({
          managerId,
          managerName: managerById.get(managerId)?.name ?? "Unknown",
          teamName: managerById.get(managerId)?.team_name ?? "Unknown",
        }));

  return NextResponse.json({ latestGameweek: latestGw, currentWeekWinners, leaderboard });
}
