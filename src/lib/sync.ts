import {
  getAllLeagueStandings,
  getBootstrapStatic,
  getManagerHistory,
  sleep,
} from "./fpl-client";
import { upsertGameweek, upsertGwScore, upsertManager, upsertSeasonSnapshot } from "./db";
import type { Chip, ManagerHistoryEntry } from "./types";

const REQUEST_PACING_MS = 250;

interface ManagerHistoryBundle {
  managerId: number; // local DB id
  entries: ManagerHistoryEntry[];
  chipByEvent: Map<number, Chip>;
}

// Fetches bootstrap-static + league standings, upserts managers/gameweeks,
// then fetches each manager's history (paced per PRD Section 4 so we don't
// burst an unauthenticated, undocumented API). Only gameweeks FPL has
// marked finished are persisted to gw_scores/season_snapshots — this is
// shared by both the one-time backfill and the recurring snapshot job so
// the two never drift out of sync on what counts as "finished."
export async function syncFinishedGameweeks(leagueId: number): Promise<{
  finishedGameweekIds: number[];
  managerCount: number;
}> {
  const bootstrap = await getBootstrapStatic();
  if (!bootstrap) throw new Error("Failed to fetch bootstrap-static");

  const finishedGameweekIds: number[] = [];
  for (const event of bootstrap.events) {
    await upsertGameweek(event.id, event.deadline_time, event.finished);
    if (event.finished) finishedGameweekIds.push(event.id);
  }

  const standings = await getAllLeagueStandings(leagueId);
  if (!standings) throw new Error(`Failed to fetch standings for league ${leagueId}`);

  const managerIds: number[] = [];
  if (standings.standings.results.length > 0) {
    for (const entry of standings.standings.results) {
      const managerId = await upsertManager(entry.entry, entry.player_name, entry.entry_name);
      managerIds.push(managerId);
    }
  } else {
    // Pre-season (or before anyone's first finished gameweek): FPL hasn't
    // assigned ranks/totals yet, so managers only show up in new_entries.
    for (const entry of standings.new_entries.results) {
      const managerId = await upsertManager(
        entry.entry,
        `${entry.player_first_name} ${entry.player_last_name}`,
        entry.entry_name
      );
      managerIds.push(managerId);
    }
  }

  if (finishedGameweekIds.length === 0) {
    return { finishedGameweekIds, managerCount: managerIds.length };
  }

  const registeredEntries: Array<{ entry: number; entry_name: string }> =
    standings.standings.results.length > 0 ? standings.standings.results : standings.new_entries.results;

  const bundles: ManagerHistoryBundle[] = [];
  for (let i = 0; i < registeredEntries.length; i++) {
    const entry = registeredEntries[i];
    const managerId = managerIds[i];

    const history = await getManagerHistory(entry.entry);
    await sleep(REQUEST_PACING_MS);
    if (!history) {
      console.warn(`[sync] skipping manager ${entry.entry} (${entry.entry_name}) — history fetch failed`);
      continue;
    }

    const chipByEvent = new Map<number, Chip>();
    for (const chip of history.chips) chipByEvent.set(chip.event, chip.name);

    bundles.push({ managerId, entries: history.current, chipByEvent });
  }

  // Persist gw_scores directly from each manager's own history.
  for (const bundle of bundles) {
    for (const gw of finishedGameweekIds) {
      const entry = bundle.entries.find((e) => e.event === gw);
      if (!entry) continue;
      await upsertGwScore(
        bundle.managerId,
        gw,
        entry.points,
        bundle.chipByEvent.get(gw) ?? null,
        entry.overall_rank
      );
    }
  }

  // season_snapshots.league_rank isn't exposed historically by FPL for a
  // classic league, so it's derived here: rank managers by their
  // cumulative total_points as of each finished gameweek. Ties resolve by
  // sort order (both managers keep their FPL-reported total; a genuine tie
  // in running total is rare enough not to warrant special-casing here).
  for (const gw of finishedGameweekIds) {
    const totalsAtGw = bundles
      .map((bundle) => ({
        managerId: bundle.managerId,
        total: bundle.entries.find((e) => e.event === gw)?.total_points,
      }))
      .filter((row): row is { managerId: number; total: number } => row.total !== undefined)
      .sort((a, b) => b.total - a.total);

    for (let index = 0; index < totalsAtGw.length; index++) {
      const row = totalsAtGw[index];
      await upsertSeasonSnapshot(row.managerId, gw, row.total, index + 1);
    }
  }

  return { finishedGameweekIds, managerCount: managerIds.length };
}
