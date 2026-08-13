import { NextResponse } from "next/server";
import { getAllGwScores, getGwScoresForManager, getManagerById } from "@/lib/db";
import { buildMotwLeaderboard } from "@/lib/motw";

export const dynamic = "force-dynamic";

// Manager profile: full MOTW history + gw-by-gw score/chip log (Section
// 5.1 "show each manager's full MOTW history ... when you click into their
// profile"). `id` is the local managers.id (returned by /api/standings and
// /api/motw), not the raw FPL entry id.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const managerId = Number(params.id);
  if (!Number.isFinite(managerId)) {
    return NextResponse.json({ error: "Invalid manager id" }, { status: 400 });
  }

  const manager = await getManagerById(managerId);
  if (!manager) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  const gwScores = await getGwScoresForManager(managerId);
  const leaderboard = buildMotwLeaderboard(await getAllGwScores());
  const motwEntry = leaderboard.find((e) => e.managerId === managerId);

  return NextResponse.json({
    manager,
    gwScores,
    motw: {
      wins: motwEntry?.wins ?? 0,
      gameweeksWon: motwEntry?.gameweeksWon ?? [],
    },
  });
}
