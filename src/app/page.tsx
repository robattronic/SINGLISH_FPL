import Image from "next/image";
import Link from "next/link";
import { getAllLeagueStandings } from "@/lib/fpl-client";
import {
  getAllGwScores,
  getAllManagers,
  getGwScoresForGameweek,
  getLatestFinishedGameweekId,
  getSeasonSnapshot,
} from "@/lib/db";
import { buildMotwLeaderboard, getWeeklyMotwWinners } from "@/lib/motw";
import { getLeagueId } from "@/lib/env";

export const dynamic = "force-dynamic";

// Server component: calls the same lib functions the API routes use,
// directly, since this is a same-origin dashboard render (no need to
// round-trip through our own HTTP API). Phase 3 scope — standings +
// current gameweek MOTW; head-to-head (Phase 5) and polish (Phase 6) are
// not built out yet.
export default async function DashboardPage() {
  const leagueId = getLeagueId();
  const standings = await getAllLeagueStandings(leagueId);
  const latestGw = await getLatestFinishedGameweekId();
  const managers = await getAllManagers();
  const managerByEntryId = new Map(managers.map((m) => [m.fpl_entry_id, m]));
  const managerById = new Map(managers.map((m) => [m.id, m]));

  const leaderboard = buildMotwLeaderboard(await getAllGwScores());

  const currentWeekWinners =
    latestGw === null ? [] : getWeeklyMotwWinners(await getGwScoresForGameweek(latestGw));

  // Live/provisional leader for the in-progress gameweek: FPL only flips
  // an event's `finished` flag ~1-2 days after the last match (bonus
  // points confirmation), so relying solely on getLatestFinishedGameweekId
  // would leave this section empty for a day+ after matches have actually
  // finished. This is explicitly unofficial and separate from the
  // permanent MOTW tally, which only ever locks in confirmed gameweeks.
  const liveLeaders =
    latestGw === null && standings && standings.standings.results.length > 0
      ? getWeeklyMotwWinners(
          standings.standings.results.map((e) => ({
            manager_id: e.entry,
            gameweek_id: 0,
            points: e.event_total,
          }))
        )
      : [];
  const liveLeaderNames = liveLeaders.map(
    (entryId) => standings?.standings.results.find((e) => e.entry === entryId)?.player_name ?? "Unknown"
  );
  const liveLeaderPoints = standings?.standings.results.find((e) => e.entry === liveLeaders[0])?.event_total;

  const rankMovements = new Map<number, "up" | "down" | "same" | "unknown">();
  if (standings && latestGw !== null) {
    for (const entry of standings.standings.results) {
      const manager = managerByEntryId.get(entry.entry);
      if (!manager) continue;
      const prev = await getSeasonSnapshot(manager.id, latestGw);
      if (!prev) continue;
      rankMovements.set(
        entry.entry,
        entry.rank < prev.league_rank ? "up" : entry.rank > prev.league_rank ? "down" : "same"
      );
    }
  }

  return (
    <main>
      <Image
        src="/logo.png"
        alt="Singlish FPL"
        width={573}
        height={687}
        className="site-logo"
        priority
      />
      <h1>{standings?.league.name ?? "FPL League Tracker"}</h1>
      <p className="subtitle">
        {latestGw === null
          ? "Season hasn't started yet — standings below are live, but MOTW/chip history will populate once GW1 finishes."
          : `Through gameweek ${latestGw}`}
      </p>

      <section>
        <h2>Current Gameweek: Manager of the Week</h2>
        {currentWeekWinners.length > 0 ? (
          <div className="banner">
            {currentWeekWinners
              .map((id) => managerById.get(id)?.name ?? "Unknown")
              .join(" & ")}{" "}
            {currentWeekWinners.length > 1 ? "tied for" : "is"} top scorer in GW{latestGw}
          </div>
        ) : liveLeaders.length > 0 ? (
          <div className="banner">
            <strong>Live (unofficial):</strong> {liveLeaderNames.join(" & ")}{" "}
            {liveLeaderNames.length > 1 ? "are tied for" : "leads with"} {liveLeaderPoints} pts —
            official once FPL confirms bonus points for this gameweek.
          </div>
        ) : (
          <p className="empty-state">No finished gameweek yet.</p>
        )}
      </section>

      <section>
        <h2>Season Standings</h2>
        {!standings || standings.standings.results.length === 0 ? (
          standings && standings.new_entries.results.length > 0 ? (
            <>
              <p className="empty-state">
                League is pre-season — no ranked standings yet, but {standings.new_entries.results.length}{" "}
                manager{standings.new_entries.results.length === 1 ? "" : "s"} joined so far:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Manager</th>
                    <th>Team</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.new_entries.results.map((entry) => (
                    <tr key={entry.entry}>
                      <td>
                        <Link href={`/manager/${entry.entry}`}>
                          {entry.player_first_name} {entry.player_last_name}
                        </Link>
                      </td>
                      <td>{entry.entry_name}</td>
                      <td>{new Date(entry.joined_time).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="empty-state">No standings yet — league is pre-season or empty.</p>
          )
        ) : (
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Manager</th>
                <th>Team</th>
                <th>GW Pts</th>
                <th>Total</th>
                <th>Movement</th>
              </tr>
            </thead>
            <tbody>
              {standings.standings.results.map((entry) => {
                const movement = rankMovements.get(entry.entry) ?? "unknown";
                return (
                  <tr key={entry.entry} className={entry.rank <= 3 ? `rank-${entry.rank}` : undefined}>
                    <td>{entry.rank}</td>
                    <td>
                      <Link href={`/manager/${entry.entry}`}>{entry.player_name}</Link>
                    </td>
                    <td>{entry.entry_name}</td>
                    <td>{entry.event_total}</td>
                    <td>{entry.total}</td>
                    <td className={`movement-${movement}`}>
                      {movement === "up" ? "▲" : movement === "down" ? "▼" : movement === "same" ? "—" : "?"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>MOTW Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="empty-state">No finished gameweeks yet — MOTW wins will accumulate here.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Manager</th>
                <th>MOTW Wins</th>
                <th>Gameweeks Won</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.managerId}>
                  <td>{managerById.get(entry.managerId)?.name ?? "Unknown"}</td>
                  <td>{entry.wins}</td>
                  <td>{entry.gameweeksWon.map((gw) => `GW${gw}`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
