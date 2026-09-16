import type { BootstrapStatic, ManagerHistoryResponse } from './types';

export type DetailBootstrap = BootstrapStatic & {
  chips?: { id: number; name: string; start_event: number; stop_event: number }[];
  game_settings?: { max_extra_free_transfers?: number };
};

// Estimate the next deadline's allowance, before unpublished transfers.
// Missing history must never be silently interpreted as a rolled transfer.
export function estimateFreeTransfers(history: ManagerHistoryResponse, gw: number, cap: number) {
  const entries = history.current.filter(e => e.event <= gw).sort((a,b) => a.event-b.event);
  if (!entries.length || entries[entries.length-1].event !== gw) return null;
  let allowance = 1;
  for (let i=1; i<entries.length; i++) {
    const entry = entries[i];
    if (entry.event !== entries[i-1].event+1 || !Number.isInteger(entry.event_transfers)) return null;
    const chip = history.chips.find(c => c.event === entry.event)?.name;
    if (chip !== 'wildcard' && chip !== 'freehit') allowance = Math.min(cap, Math.max(0, allowance-entry.event_transfers)+1);
  }
  return allowance;
}

export interface ManagerDetails {
  gw: number; gameweeks: number[]; points: number; hit: number; activeChip: string | null;
  estimatedFt: number | null; chipsAvailable: boolean; transfersAvailable: boolean;
  provisional: boolean;
  players: { id: number; name: string; team: string; type: number; position: number; captain: boolean; vice: boolean; raw: number | null; counted: number | null }[];
  chips: { id: number; name: string; start: number; stop: number; used: number | null }[];
  transfers: { gw: number; incoming: string; outgoing: string; time: string }[];
}
