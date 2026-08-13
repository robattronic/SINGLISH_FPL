// PRD Phase 2 — one-time historical backfill.
//
// Run once when first setting up the app (or any time you want to force a
// full re-sync): loops every manager's history/ endpoint and populates
// gw_scores/season_snapshots for every gameweek FPL has already finished,
// so MOTW and chip history have no gap between season start and whenever
// this was first run. Works against whatever DATABASE_URL points to — run
// `vercel env pull .env.local` first if you want this to hit the same
// Postgres the deployed app uses.
//
// Usage: npm run backfill

import { loadEnvLocal, getLeagueId } from "../src/lib/env";
loadEnvLocal();

import { closePool } from "../src/lib/db";
import { syncFinishedGameweeks } from "../src/lib/sync";

async function main() {
  const leagueId = getLeagueId();
  console.log(`[backfill] syncing league ${leagueId}...`);

  const { finishedGameweekIds, managerCount } = await syncFinishedGameweeks(leagueId);

  if (finishedGameweekIds.length === 0) {
    console.log(
      `[backfill] ${managerCount} managers found, but no gameweeks are finished yet — nothing to backfill. Re-run this after GW1 completes.`
    );
    return;
  }

  console.log(
    `[backfill] done. ${managerCount} managers, ${finishedGameweekIds.length} finished gameweeks synced (GW ${Math.min(
      ...finishedGameweekIds
    )}-${Math.max(...finishedGameweekIds)}).`
  );
}

main()
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exitCode = 1;
  })
  .finally(closePool);
