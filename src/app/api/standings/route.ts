import { NextResponse } from "next/server";
import { getAllLeagueStandings } from "@/lib/fpl-client";
import { getManagerByEntryId, getLatestFinishedGameweekId, getSeasonSnapshot } from "@/lib/db";

export const dynamic = "force-dynamic";

interface StandingsRow {
  entryId: number;
  managerId: number | null;
  managerName: string;
  teamName: string;
  totalPoints: number;
  eventTotal: number;
  rank: number;
  rankMovement: "up" | "down" | "same" | "unknown";
}

// Rank + totals come live from FPL (Section 5.2 — "live total points and
// rank"). Rank movement compares against the last finished gameweek's
// stored league_rank in season_snapshots, since FPL's live standings don't
// expose "rank last gameweek" directly for a classic league in a form we
// can trust across ties.
export async function GET() {
  const leagueId = Number(process.env.FPL_LEAGUE_ID);
  if (!Number.isFinite(leagueId)) {
    return NextResponse.json({ error: "FPL_LEAGUE_ID is not configured" }, { status: 500 });
  }

  const standings = await getAllLeagueStandings(leagueId);
  if (!standings) {
    return NextResponse.json({ error: "Failed to fetch standings from FPL" }, { status: 502 });
  }

  const latestFinishedGw = await getLatestFinishedGameweekId();

  const rows: StandingsRow[] = await Promise.all(
    standings.standings.results.map(async (entry) => {
      const manager = await getManagerByEntryId(entry.entry);

      let rankMovement: StandingsRow["rankMovement"] = "unknown";
      if (manager && latestFinishedGw !== null) {
        const prevSnapshot = await getSeasonSnapshot(manager.id, latestFinishedGw);
        if (prevSnapshot) {
          if (entry.rank < prevSnapshot.league_rank) rankMovement = "up";
          else if (entry.rank > prevSnapshot.league_rank) rankMovement = "down";
          else rankMovement = "same";
        }
      }

      return {
        entryId: entry.entry,
        managerId: manager?.id ?? null,
        managerName: entry.player_name,
        teamName: entry.entry_name,
        totalPoints: entry.total,
        eventTotal: entry.event_total,
        rank: entry.rank,
        rankMovement,
      };
    })
  );

  return NextResponse.json({ league: standings.league.name, standings: rows });
}
