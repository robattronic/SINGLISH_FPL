'use client';
import { Fragment, useState } from 'react';
import Image from 'next/image';
import ManagerPanel from './ManagerPanel';
import type { LeagueStandingsEntry } from '@/lib/types';

export default function Standings({entries,winners,movements}:{entries:LeagueStandingsEntry[];winners:number[];movements:Record<number,string>}) {
  const [open,setOpen]=useState<number|null>(null);
  return <div className="expandable-standings"><div className="standings-head"><span>Rank</span><span>Manager / Team</span><span>GW pts</span><span>Total</span><span>Move</span></div>{entries.map(e=><Fragment key={e.entry}>
    <button className={`standings-summary rank-${e.rank}`} aria-expanded={open===e.entry} aria-controls={`squad-${e.entry}`} onClick={()=>setOpen(open===e.entry?null:e.entry)}>
      <span className="summary-rank">{e.rank}</span><span className="summary-manager"><strong>{e.player_name}{winners.includes(e.entry)&&<Image src="/motw-badge.png" alt="Latest MOTW winner" width={20} height={20} className="motw-badge"/>}</strong><small>{e.entry_name}</small></span><span>{e.event_total}</span><strong>{e.total}</strong><span className={`movement-${movements[e.entry]}`}>{movements[e.entry]==='up'?'▲':movements[e.entry]==='down'?'▼':movements[e.entry]==='same'?'—':'?'}<span className="expand-arrow" aria-hidden="true">{open===e.entry?'▴':'▾'}</span></span>
    </button><div id={`squad-${e.entry}`} hidden={open!==e.entry}>{open===e.entry&&<ManagerPanel entryId={e.entry}/>}</div>
  </Fragment>)}</div>;
}
