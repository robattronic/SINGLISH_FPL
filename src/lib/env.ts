import fs from "node:fs";
import path from "node:path";

// Standalone scripts (run via tsx, not the Next.js server) don't get
// .env.local loaded automatically the way Next.js routes do. This is a
// minimal KEY=VALUE loader so scripts/*.ts can read FPL_LEAGUE_ID without
// adding a dotenv dependency.
export function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function getLeagueId(): number {
  const raw = process.env.FPL_LEAGUE_ID;
  if (!raw) throw new Error("FPL_LEAGUE_ID is not set (check .env.local)");
  const id = Number(raw);
  if (!Number.isFinite(id)) throw new Error(`FPL_LEAGUE_ID is not numeric: ${raw}`);
  return id;
}
