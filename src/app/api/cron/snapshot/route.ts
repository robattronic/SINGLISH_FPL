import { NextResponse } from "next/server";
import { syncFinishedGameweeks } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// PRD Section 8 "Scheduler", now automated: Vercel Cron (vercel.json) hits
// this route on a schedule instead of a human running scripts/snapshot.ts.
// Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` to
// cron-triggered requests when CRON_SECRET is set as a project env var —
// this checks that header so the route can't be triggered by anyone who
// finds the URL. Reuses the same sync logic as the manual scripts, so
// there's exactly one place that decides what "finished gameweek" means.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = Number(process.env.FPL_LEAGUE_ID);
  if (!Number.isFinite(leagueId)) {
    return NextResponse.json({ error: "FPL_LEAGUE_ID is not configured" }, { status: 500 });
  }

  try {
    const { finishedGameweekIds, managerCount } = await syncFinishedGameweeks(leagueId);
    return NextResponse.json({
      ok: true,
      managerCount,
      finishedGameweeks: finishedGameweekIds.length,
      latestGameweek: finishedGameweekIds.length > 0 ? Math.max(...finishedGameweekIds) : null,
    });
  } catch (err) {
    console.error("[cron/snapshot] sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
