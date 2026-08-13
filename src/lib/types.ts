// Minimal shapes for the FPL endpoints this app actually reads.
// FPL's API is undocumented and unversioned — these are intentionally
// permissive (extra fields are ignored) rather than exhaustive.

export type Chip = "wildcard" | "freehit" | "bboost" | "3xc";

export interface BootstrapStatic {
  events: Array<{
    id: number;
    deadline_time: string;
    finished: boolean;
    is_current: boolean;
    is_next: boolean;
  }>;
}

export interface LeagueStandingsEntry {
  id: number;
  entry: number; // manager id
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  rank_sort: number;
  total: number;
  event_total: number;
}

export interface NewEntriesEntry {
  entry: number;
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
  joined_time: string;
}

export interface LeagueStandingsResponse {
  league: {
    id: number;
    name: string;
    has_cup: boolean;
  };
  // Pre-season (or before a manager's first finished gameweek), FPL lists
  // joiners here instead of in `standings.results` — there's no rank/total
  // yet to standing on. See sync.ts.
  new_entries: {
    has_next: boolean;
    page: number;
    results: NewEntriesEntry[];
  };
  standings: {
    has_next: boolean;
    page: number;
    results: LeagueStandingsEntry[];
  };
}

export interface ManagerHistoryEntry {
  event: number; // gameweek
  points: number;
  total_points: number;
  rank: number;
  overall_rank: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
}

export interface ManagerChip {
  name: Chip;
  event: number;
  time: string;
}

export interface ManagerHistoryResponse {
  current: ManagerHistoryEntry[];
  chips: ManagerChip[];
}

export interface ManagerPicksResponse {
  active_chip: Chip | null;
  entry_history: ManagerHistoryEntry;
  picks: Array<{
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
  }>;
}

export interface CupStatus {
  cup_league: number | null;
  matches: Array<{
    id: number;
    event: number;
    entry_1_entry: number;
    entry_1_points: number;
    entry_2_entry: number;
    entry_2_points: number;
    winner: number | null;
    league_id: number;
    round: number;
  }>;
}

export interface ManagerEntry {
  id: number;
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
}
