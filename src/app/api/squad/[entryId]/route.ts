import { NextResponse } from 'next/server';
import { fetchJson, getBootstrapStatic, getManagerHistory, getManagerPicks, getEventLive } from '@/lib/fpl-client';
import { estimateFreeTransfers, type DetailBootstrap, type ManagerDetails } from '@/lib/manager-details';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: { entryId: string } }) {
  const id = Number(params.entryId);
  const requested = new URL(request.url).searchParams.get('gw');
  if (!Number.isSafeInteger(id) || id <= 0 || (requested !== null && (!/^\d+$/.test(requested) || Number(requested)<1 || Number(requested)>38))) return NextResponse.json({error:'Invalid manager or gameweek.'}, {status:400});
  const bootstrap = await getBootstrapStatic() as DetailBootstrap | null;
  if (!bootstrap?.events || !bootstrap.elements || !bootstrap.teams) return NextResponse.json({error:'FPL player data is unavailable. Please retry.'}, {status:502});
  const gameweeks = bootstrap.events.filter(e => Date.parse(e.deadline_time) <= Date.now()).map(e=>e.id);
  const gw = requested ? Number(requested) : Math.max(0,...gameweeks);
  if (!gameweeks.includes(gw)) return NextResponse.json({error:'Squads are available after the gameweek deadline.'}, {status:404});
  const [picks,live,history,transfers] = await Promise.all([
    getManagerPicks(id,gw), getEventLive(gw), getManagerHistory(id),
    fetchJson<{element_in:number; element_out:number; event:number; time:string}[]>(`/entry/${id}/transfers/`)
  ]);
  if (!picks?.picks || !picks.entry_history) return NextResponse.json({error:'This squad is unavailable. Please retry shortly.'}, {status:502});
  const players = new Map(bootstrap.elements.map(e=>[e.id,e]));
  const teams = new Map(bootstrap.teams.map(t=>[t.id,t.short_name]));
  const points = new Map((live?.elements ?? []).map(e=>[e.id,e.stats.total_points]));
  const cap = 1+(bootstrap.game_settings?.max_extra_free_transfers ?? 4);
  const result: ManagerDetails = {
    gw, gameweeks, points:picks.entry_history.points, hit:picks.entry_history.event_transfers_cost,
    activeChip:picks.active_chip, provisional:!bootstrap.events.find(e=>e.id===gw)?.finished,
    estimatedFt:history ? estimateFreeTransfers(history,gw,cap) : null,
    chipsAvailable:!!history && Array.isArray(bootstrap.chips), transfersAvailable:Array.isArray(transfers),
    players:picks.picks.map(p=>{
      const player = players.get(p.element); const raw = points.get(p.element) ?? null;
      return {id:p.element,name:player?.web_name ?? `Player ${p.element}`,team:teams.get(player?.team ?? 0) ?? '',type:player?.element_type ?? 0,position:p.position,captain:p.is_captain,vice:p.is_vice_captain,raw,counted:raw===null?null:raw*p.multiplier};
    }).sort((a,b)=>a.position-b.position),
    chips:(bootstrap.chips ?? []).map(c=>({id:c.id,name:c.name,start:c.start_event,stop:c.stop_event,used:history?.chips.find(h=>h.name===c.name && h.event>=c.start_event && h.event<=c.stop_event && h.event<=gw)?.event ?? null})),
    transfers:(Array.isArray(transfers)?transfers:[]).filter(t=>t.event<=gw).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,20).map(t=>({gw:t.event,incoming:players.get(t.element_in)?.web_name ?? `Player ${t.element_in}`,outgoing:players.get(t.element_out)?.web_name ?? `Player ${t.element_out}`,time:t.time}))
  };
  return NextResponse.json(result,{headers:{'Cache-Control':'private, max-age=60'}});
}
