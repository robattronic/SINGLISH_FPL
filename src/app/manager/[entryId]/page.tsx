import Link from "next/link";
import {
  getBootstrapStatic,
  getEventLive,
  getManagerBasicInfo,
  getManagerPicks,
} from "@/lib/fpl-client";

export const dynamic = "force-dynamic";

// Squad view for a single manager/gameweek — like the FPL app's "Points"
// screen. Uses the FPL entry id directly (not our local managers.id) so
// this works even for a manager our sync hasn't picked up yet.
export default async function ManagerSquadPage({
  params,
  searchParams,
}: {
  params: { entryId: string };
  searchParams: { gw?: string };
}) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId)) {
    return (
      <main>
        <p className="empty-state">Invalid manager id.</p>
      </main>
    );
  }

  const bootstrap = await getBootstrapStatic();
  const currentEvent = bootstrap?.events.find((e) => e.is_current);
  const lastFinished = [...(bootstrap?.events ?? [])].reverse().find((e) => e.finished);
  const gw = Number(searchParams.gw) || currentEvent?.id || lastFinished?.id || 1;

  const [info, picks, live] = await Promise.all([
    getManagerBasicInfo(entryId),
    getManagerPicks(entryId, gw),
    getEventLive(gw),
  ]);

  if (!picks) {
    return (
      <main>
        <Link href="/" className="back-link">&larr; Back to standings</Link>
        <h1>{info?.name ?? "Manager"}</h1>
        <p className="empty-state">
          No squad data for GW{gw} yet — the manager may not have set a team for this
          gameweek, or it hasn't started.
        </p>
      </main>
    );
  }

  const elementById = new Map((bootstrap?.elements ?? []).map((el) => [el.id, el]));
  const teamById = new Map((bootstrap?.teams ?? []).map((t) => [t.id, t]));
  const typeById = new Map((bootstrap?.element_types ?? []).map((t) => [t.id, t]));
  const liveById = new Map((live?.elements ?? []).map((el) => [el.id, el]));

  const rows = picks.picks.map((pick) => {
    const player = elementById.get(pick.element);
    const team = player ? teamById.get(player.team) : undefined;
    const positionType = player ? typeById.get(player.element_type) : undefined;
    const rawPoints = liveById.get(pick.element)?.stats.total_points ?? 0;
    return {
      ...pick,
      name: player?.web_name ?? `Player #${pick.element}`,
      team: team?.short_name ?? "",
      positionLabel: positionType?.singular_name_short ?? "",
      rawPoints,
      appliedPoints: rawPoints * pick.multiplier,
    };
  });

  const starters = rows.filter((r) => r.position <= 11);
  const bench = rows.filter((r) => r.position > 11);

  const squadTotal = starters.reduce((sum, r) => sum + r.appliedPoints, 0);

  return (
    <main>
      <Link href="/" className="back-link">&larr; Back to standings</Link>
      <h1>{info?.name ?? "Manager"}</h1>
      <p className="subtitle">
        {info ? `${info.player_first_name} ${info.player_last_name} — ` : ""}
        GW{gw} squad
        {picks.active_chip ? ` — ${CHIP_LABELS[picks.active_chip] ?? picks.active_chip} active` : ""}
      </p>

      <section>
        <h2>Starting XI — {squadTotal} pts</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Pos</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {starters.map((r) => (
              <tr key={r.element}>
                <td>
                  {r.name}
                  {r.is_captain ? " (C)" : r.is_vice_captain ? " (VC)" : ""}
                </td>
                <td>{r.team}</td>
                <td>{r.positionLabel}</td>
                <td>{r.appliedPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Bench</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Pos</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {bench.map((r) => (
              <tr key={r.element}>
                <td>{r.name}</td>
                <td>{r.team}</td>
                <td>{r.positionLabel}</td>
                <td>{r.rawPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};
