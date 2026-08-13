import { Pool } from "pg";

// Data model per PRD Section 7. gw_scores/season_snapshots are only ever
// written for gameweeks FPL has marked finished — see sync.ts, invoked by
// both the one-time backfill script and the Vercel Cron route. Running on
// Vercel's serverless functions rules out SQLite (no persistent disk), so
// this talks to a hosted Postgres (Vercel Postgres by default) instead.

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
  }
  pool = new Pool({ connectionString });
  return pool;
}

// Standalone scripts (backfill/snapshot) must call this when done, or the
// open pool connection keeps the Node process alive indefinitely. Not
// needed in the Next.js server / API routes — the pool is meant to stay
// warm across requests there.
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Lazily runs once per server instance (cheap no-op after the first call in
// the same warm serverless function / dev process).
export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = getPool().query(`
    CREATE TABLE IF NOT EXISTS managers (
      id SERIAL PRIMARY KEY,
      fpl_entry_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      team_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gameweeks (
      id INTEGER PRIMARY KEY, -- FPL event id, e.g. 1..38
      deadline_time TIMESTAMPTZ NOT NULL,
      is_finished BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS gw_scores (
      manager_id INTEGER NOT NULL REFERENCES managers(id),
      gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
      points INTEGER NOT NULL,
      chip_used TEXT, -- 'wildcard' | 'freehit' | 'bboost' | '3xc' | NULL
      overall_rank INTEGER,
      PRIMARY KEY (manager_id, gameweek_id)
    );

    CREATE TABLE IF NOT EXISTS season_snapshots (
      manager_id INTEGER NOT NULL REFERENCES managers(id),
      gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
      running_total INTEGER NOT NULL,
      league_rank INTEGER NOT NULL,
      PRIMARY KEY (manager_id, gameweek_id)
    );
  `).then(() => undefined);
  return schemaReady;
}

async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function upsertManager(
  fplEntryId: number,
  name: string,
  teamName: string
): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO managers (fpl_entry_id, name, team_name) VALUES ($1, $2, $3)
     ON CONFLICT (fpl_entry_id) DO UPDATE SET name = excluded.name, team_name = excluded.team_name
     RETURNING id`,
    [fplEntryId, name, teamName]
  );
  return rows[0].id;
}

export async function upsertGameweek(
  id: number,
  deadlineTime: string,
  isFinished: boolean
): Promise<void> {
  await query(
    `INSERT INTO gameweeks (id, deadline_time, is_finished) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET deadline_time = excluded.deadline_time, is_finished = excluded.is_finished`,
    [id, deadlineTime, isFinished]
  );
}

export async function upsertGwScore(
  managerId: number,
  gameweekId: number,
  points: number,
  chipUsed: string | null,
  overallRank: number | null
): Promise<void> {
  await query(
    `INSERT INTO gw_scores (manager_id, gameweek_id, points, chip_used, overall_rank)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (manager_id, gameweek_id) DO UPDATE SET
       points = excluded.points, chip_used = excluded.chip_used, overall_rank = excluded.overall_rank`,
    [managerId, gameweekId, points, chipUsed, overallRank]
  );
}

export async function upsertSeasonSnapshot(
  managerId: number,
  gameweekId: number,
  runningTotal: number,
  leagueRank: number
): Promise<void> {
  await query(
    `INSERT INTO season_snapshots (manager_id, gameweek_id, running_total, league_rank)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (manager_id, gameweek_id) DO UPDATE SET
       running_total = excluded.running_total, league_rank = excluded.league_rank`,
    [managerId, gameweekId, runningTotal, leagueRank]
  );
}

export interface ManagerRow {
  id: number;
  fpl_entry_id: number;
  name: string;
  team_name: string;
}

export async function getManagerByEntryId(entryId: number): Promise<ManagerRow | undefined> {
  const rows = await query<ManagerRow>("SELECT * FROM managers WHERE fpl_entry_id = $1", [
    entryId,
  ]);
  return rows[0];
}

export async function getManagerById(id: number): Promise<ManagerRow | undefined> {
  const rows = await query<ManagerRow>("SELECT * FROM managers WHERE id = $1", [id]);
  return rows[0];
}

export function getAllManagers(): Promise<ManagerRow[]> {
  return query<ManagerRow>("SELECT * FROM managers");
}

export interface GwScoreRow {
  manager_id: number;
  gameweek_id: number;
  points: number;
  chip_used: string | null;
  overall_rank: number | null;
}

export function getGwScoresForGameweek(gameweekId: number): Promise<GwScoreRow[]> {
  return query<GwScoreRow>("SELECT * FROM gw_scores WHERE gameweek_id = $1", [gameweekId]);
}

export function getGwScoresForManager(managerId: number): Promise<GwScoreRow[]> {
  return query<GwScoreRow>(
    "SELECT * FROM gw_scores WHERE manager_id = $1 ORDER BY gameweek_id ASC",
    [managerId]
  );
}

export function getAllGwScores(): Promise<GwScoreRow[]> {
  return query<GwScoreRow>("SELECT * FROM gw_scores");
}

export async function getLatestFinishedGameweekId(): Promise<number | null> {
  const rows = await query<{ max: number | null }>(
    "SELECT MAX(id) as max FROM gameweeks WHERE is_finished = TRUE"
  );
  return rows[0]?.max ?? null;
}

export async function getSeasonSnapshot(
  managerId: number,
  gameweekId: number
): Promise<{ league_rank: number } | undefined> {
  const rows = await query<{ league_rank: number }>(
    "SELECT league_rank FROM season_snapshots WHERE manager_id = $1 AND gameweek_id = $2",
    [managerId, gameweekId]
  );
  return rows[0];
}
