// PRD Phase 4 — recurring snapshot job.
//
// In production this runs automatically via Vercel Cron hitting
// /api/cron/snapshot (see vercel.json + src/app/api/cron/snapshot/route.ts)
// — no manual step needed once deployed. This script is the same logic for
// local use: manual re-syncs, or debugging against the same Postgres DB
// (run `vercel env pull .env.local` first to get DATABASE_URL locally).
// Idempotent — safe to run as often as you like.
//
// Usage: npm run snapshot

import { loadEnvLocal, getLeagueId } from "../src/lib/env";
loadEnvLocal();

import { closePool, getLatestFinishedGameweekId } from "../src/lib/db";
import { syncFinishedGameweeks } from "../src/lib/sync";

async function main() {
  const leagueId = getLeagueId();
  const previousLatest = await getLatestFinishedGameweekId();

  const { finishedGameweekIds } = await syncFinishedGameweeks(leagueId);
  const newLatest = finishedGameweekIds.length > 0 ? Math.max(...finishedGameweekIds) : null;

  if (newLatest === null) {
    console.log("[snapshot] no finished gameweeks yet.");
  } else if (previousLatest === null || newLatest > previousLatest) {
    console.log(`[snapshot] new finished gameweek(s) synced — latest is now GW${newLatest}.`);
  } else {
    console.log(`[snapshot] up to date, latest finished gameweek is GW${newLatest}.`);
  }
}

main()
  .catch((err) => {
    console.error("[snapshot] failed:", err);
    process.exitCode = 1;
  })
  .finally(closePool);
