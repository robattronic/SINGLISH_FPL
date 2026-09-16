'use client';
import { useEffect, useState } from 'react';
import type { ManagerDetails } from '@/lib/manager-details';

const labels: Record<string,string> = {wildcard:'Wildcard',freehit:'Free Hit',bboost:'Bench Boost','3xc':'Triple Captain'};
export default function ManagerPanel({entryId,initialGw}:{entryId:number;initialGw?:number}) {
  const [gw,setGw] = useState<number | undefined>(initialGw);
  const [data,setData] = useState<ManagerDetails>();
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  const [view,setView] = useState<'pitch'|'list'>('pitch');
  useEffect(()=>{
    const controller = new AbortController();
    setData(undefined); setError('');
    fetch(`/api/squad/${entryId}${gw ? `?gw=${gw}` : ''}`,{signal:controller.signal})
      .then(async response=>{const result=await response.json(); if(!response.ok) throw new Error(result.error || 'Unable to load squad.'); return result;})
      .then(result=>{if(!controller.signal.aborted) setData(result);})
      .catch(e=>{if(!controller.signal.aborted) setError(e.message || 'Unable to load squad.');});
    return ()=>controller.abort();
  },[entryId,gw,retry]);
  if(error) return <div className="manager-panel" role="alert"><p>{error}</p><button onClick={()=>setRetry(retry+1)}>Retry</button></div>;
  if(!data) return <div className="manager-panel" role="status">Loading squad and transfer history…</div>;
  const card = (p:ManagerDetails['players'][number],bench=false)=><div className="mini-player" key={p.id}>
    <div className="mini-shirt" aria-hidden="true">{p.team}</div>
    <strong title={p.name}>{p.name}</strong><span>{p.captain?'C · ':p.vice?'VC · ':''}{(bench?p.raw:p.counted) ?? '—'} pts</span>
  </div>;
  return <div className="manager-panel">
    <div className="panel-toolbar">
      <label>Gameweek <select aria-label="Squad gameweek" value={data.gw} onChange={e=>setGw(Number(e.target.value))}>{data.gameweeks.map(n=><option key={n} value={n}>GW{n}</option>)}</select></label>
      <span className="panel-stat">{data.points} GW pts · {data.hit ? `−${data.hit} transfer hit`:'No transfer hit'}</span>
      <a href={`/manager/${entryId}?gw=${data.gw}`}>Full squad ↗</a>
    </div>
    <div className="panel-toolbar"><div className="panel-switch" aria-label="Squad display"><button aria-pressed={view==='pitch'} onClick={()=>setView('pitch')}>Pitch</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button></div><span>{data.activeChip ? `${labels[data.activeChip] ?? data.activeChip} active` : 'No chip active'}</span></div>
    {data.provisional && <p className="panel-note">Live points are provisional. Captain changes and automatic substitutions may still be pending.</p>}
    {view==='pitch' ? <><div className="mini-pitch" aria-label="Starting eleven formation">{[1,2,3,4,0].map(type=>{const row=data.players.filter(p=>p.position<=11 && p.type===type); return row.length ? <div className="mini-pitch-row" key={type}>{row.map(p=>card(p))}</div>:null;})}</div><h3>Bench · player points before multipliers</h3><div className="mini-bench">{data.players.filter(p=>p.position>11).map(p=>card(p,true))}</div></> : <div className="panel-list">{data.players.map(p=><div key={p.id}><span>{p.position>11?'Bench · ':''}{p.name} {p.captain?'(C)':p.vice?'(VC)':''}<small>{p.team}</small></span><span>{p.raw ?? '—'} pts <small>{p.counted ?? '—'} counted</small></span></div>)}</div>}
    <div className="panel-info-grid"><section><h3>Chip history</h3><p className="panel-note">Status as of GW{data.gw}</p>{!data.chipsAvailable?<p>Chip history unavailable.</p>:<div className="panel-chips">{data.chips.map(c=><div className={`panel-chip ${c.used?'used':''}`} key={c.id}><strong>{labels[c.name] ?? c.name}</strong><small>GW{c.start}–{c.stop}</small><span>{c.used ? `Used GW${c.used}`:data.gw<c.start?'Upcoming':data.gw>c.stop?'Expired unused':'Unused'}</span></div>)}</div>}</section>
    <section><h3>Free transfers</h3><strong className="ft-number">{data.gw>=Math.max(...data.gameweeks) && data.gw===38?'Season complete':data.estimatedFt ?? 'Unavailable'}</strong><p className="panel-note">Estimated allowance for GW{data.gw+1}, before unpublished moves. Derived from public history; special rule changes may affect this estimate.</p><h3>Recent transfers</h3><p className="panel-note">Latest 20 published moves through GW{data.gw}. Pre-deadline moves may be hidden.</p>{!data.transfersAvailable?<p>Transfer history unavailable.</p>:!data.transfers.length?<p>No published transfers.</p>:<ul className="panel-transfers">{data.transfers.map((t,i)=><li key={`${t.time}-${i}`}><small>GW{t.gw}</small><span><del>{t.outgoing}</del> → <strong>{t.incoming}</strong></span></li>)}</ul>}</section></div>
  </div>;
}
