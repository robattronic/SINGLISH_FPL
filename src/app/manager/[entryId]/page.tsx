import Link from 'next/link';
import { getManagerBasicInfo } from '@/lib/fpl-client';
import ManagerPanel from '@/app/components/ManagerPanel';

export const dynamic = 'force-dynamic';

export default async function ManagerSquadPage({params,searchParams}:{params:{entryId:string};searchParams:{gw?:string}}) {
  const entryId = Number(params.entryId);
  if (!Number.isSafeInteger(entryId) || entryId < 1) return <main><p>Invalid manager.</p><Link href="/">Back to standings</Link></main>;
  const info = await getManagerBasicInfo(entryId);
  const gw = searchParams.gw && /^\d+$/.test(searchParams.gw) ? Number(searchParams.gw) : undefined;
  return <main>
    <Link href="/" className="back-link">← Back to standings</Link>
    <h1>{info?.name ?? 'Manager squad'}</h1>
    <p className="subtitle">{info ? `${info.player_first_name} ${info.player_last_name}` : 'Squad, chips and transfers'}</p>
    <ManagerPanel entryId={entryId} initialGw={gw}/>
  </main>;
}
