// Manager of the Week logic (PRD Section 5.1) and the season-end "Most
// MOTW" prize tiebreak (PRD Section 6). Kept as pure functions over plain
// data so they're usable from API routes, scripts, or tests without a live
// DB connection.

export interface GwScoreLike {
  manager_id: number;
  gameweek_id: number;
  points: number;
}

export interface MotwLeaderboardEntry {
  managerId: number;
  wins: number;
  gameweeksWon: number[];
}

// A single gameweek's MOTW winner(s). Ties are both credited — this is a
// season-wide running tally, never reset between weeks.
export function getWeeklyMotwWinners(scores: GwScoreLike[]): number[] {
  if (scores.length === 0) return [];
  const maxPoints = Math.max(...scores.map((s) => s.points));
  return scores.filter((s) => s.points === maxPoints).map((s) => s.manager_id);
}

// Builds the always-visible MOTW leaderboard: every manager ranked by total
// wins, with the list of gameweeks each of them won attached (for the
// per-manager profile history view).
export function buildMotwLeaderboard(allScores: GwScoreLike[]): MotwLeaderboardEntry[] {
  const byGameweek = new Map<number, GwScoreLike[]>();
  for (const score of allScores) {
    const list = byGameweek.get(score.gameweek_id) ?? [];
    list.push(score);
    byGameweek.set(score.gameweek_id, list);
  }

  const tally = new Map<number, MotwLeaderboardEntry>();
  for (const [gameweekId, scores] of byGameweek) {
    for (const managerId of getWeeklyMotwWinners(scores)) {
      const entry = tally.get(managerId) ?? { managerId, wins: 0, gameweeksWon: [] };
      entry.wins += 1;
      entry.gameweeksWon.push(gameweekId);
      tally.set(managerId, entry);
    }
  }

  return [...tally.values()].sort((a, b) => b.wins - a.wins);
}

// Season-end "Most MOTW" prize (Section 6): if multiple managers tie on
// total wins, the one ranked higher in the season standings takes the
// prize outright — no split. `leagueRankByManagerId` uses FPL's own rank
// (1 = best).
export function resolveMostMotwWinner(
  leaderboard: MotwLeaderboardEntry[],
  leagueRankByManagerId: Map<number, number>
): number | null {
  if (leaderboard.length === 0) return null;

  const topWins = leaderboard[0].wins;
  const tied = leaderboard.filter((e) => e.wins === topWins);

  if (tied.length === 1) return tied[0].managerId;

  let winner = tied[0];
  let bestRank = leagueRankByManagerId.get(winner.managerId) ?? Infinity;
  for (const candidate of tied.slice(1)) {
    const rank = leagueRankByManagerId.get(candidate.managerId) ?? Infinity;
    if (rank < bestRank) {
      winner = candidate;
      bestRank = rank;
    }
  }
  return winner.managerId;
}
