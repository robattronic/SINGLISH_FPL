import type {
  BootstrapStatic,
  CupStatus,
  LeagueStandingsResponse,
  ManagerHistoryResponse,
  ManagerPicksResponse,
} from "./types";

// Server-side only: FPL's API has no CORS headers, so every call here must
// go through a Next.js API route / server component, never straight from
// client-side JS (PRD Section 4).

const BASE_URL = "https://fantasy.premierleague.com/api";

// A browser-like UA avoids sporadic 403s from FPL's edge; no API key exists.
const HEADERS = { "User-Agent": "Mozilla/5.0 (fpl-league-tracker)" };

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Finished-gameweek data never changes, so callers (backfill/snapshot
// scripts) should skip calling this at all once a gameweek is already
// recorded in the DB — this function itself does no caching, it just talks
// to the API. Failures degrade to null rather than throwing, since FPL
// occasionally reshapes responses off-season (PRD Section 4 "Known risk").
async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    // Explicit no-store: relying on the page's `dynamic = "force-dynamic"`
    // to propagate down into this fetch isn't reliable on Vercel — it was
    // observed serving stale FPL data (Vercel Data Cache) despite that
    // route config, so this is pinned directly on the fetch call instead.
    const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) {
      console.warn(`[fpl-client] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[fpl-client] ${path} failed:`, err);
    return null;
  }
}

export function getBootstrapStatic(): Promise<BootstrapStatic | null> {
  return fetchJson<BootstrapStatic>("/bootstrap-static/");
}

export function getLeagueStandingsPage(
  leagueId: number,
  page = 1
): Promise<LeagueStandingsResponse | null> {
  return fetchJson<LeagueStandingsResponse>(
    `/leagues-classic/${leagueId}/standings/?page_standings=${page}`
  );
}

// Loops pagination automatically (PRD: leagues over 50 managers span pages).
export async function getAllLeagueStandings(
  leagueId: number
): Promise<LeagueStandingsResponse | null> {
  const first = await getLeagueStandingsPage(leagueId, 1);
  if (!first) return null;

  let page = 1;
  let hasNext = first.standings.has_next;
  const allResults = [...first.standings.results];

  while (hasNext) {
    page += 1;
    await sleep(250);
    const next = await getLeagueStandingsPage(leagueId, page);
    if (!next) break;
    allResults.push(...next.standings.results);
    hasNext = next.standings.has_next;
  }

  return {
    ...first,
    standings: { ...first.standings, results: allResults, has_next: false },
  };
}

export function getManagerHistory(entryId: number): Promise<ManagerHistoryResponse | null> {
  return fetchJson<ManagerHistoryResponse>(`/entry/${entryId}/history/`);
}

export function getManagerPicks(
  entryId: number,
  gameweek: number
): Promise<ManagerPicksResponse | null> {
  return fetchJson<ManagerPicksResponse>(`/entry/${entryId}/event/${gameweek}/picks/`);
}

export function getManagerCup(entryId: number): Promise<CupStatus | null> {
  return fetchJson<CupStatus>(`/entry/${entryId}/cup/`);
}
