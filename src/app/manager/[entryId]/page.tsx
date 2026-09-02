import Link from "next/link";
import {
  getBootstrapStatic,
  getEventLive,
  getManagerBasicInfo,
  getManagerPicks,
} from "@/lib/fpl-client";

export const dynamic = "force-dynamic";

// Squad view for a single manager/gameweek — a pitch/formation layout like
// the FPL app's own team view. Uses the FPL entry id directly (not our
// local managers.id) so this works even for a manager our sync hasn't
// picked up yet.
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

  // Pitch rows, attack (top) to defence (bottom) — matches the FPL app's
  // own team-view orientation.
  const gk = starters.filter((r) => r.positionLabel === "GKP");
  const def = starters.filter((r) => r.positionLabel === "DEF");
  const mid = starters.filter((r) => r.positionLabel === "MID");
  const fwd = starters.filter((r) => r.positionLabel === "FWD");
  const formation = `${def.length}-${mid.length}-${fwd.length}`;

  const renderPlayer = (r: (typeof rows)[number]) => (
    <div className="player-card" key={r.element}>
      {(r.is_captain || r.is_vice_captain) && (
        <span className="armband">{r.is_captain ? "C" : "VC"}</span>
      )}
      <div className="shirt" />
      <div className="player-points">{r.appliedPoints}</div>
      <div className="player-name">{r.name}</div>
      <div className="player-team">{r.team}</div>
    </div>
  );

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
        <h2>
          Starting XI — {squadTotal} pts <span className="formation-tag">{formation}</span>
        </h2>
        <div className="pitch">
          <div className="pitch-row">{fwd.map(renderPlayer)}</div>
          <div className="pitch-row">{mid.map(renderPlayer)}</div>
          <div className="pitch-row">{def.map(renderPlayer)}</div>
          <div className="pitch-row">{gk.map(renderPlayer)}</div>
        </div>
      </section>

      <section>
        <h2>Bench</h2>
        <div className="bench-strip">
          {bench.map((r) => (
            <div className="player-card player-card-bench" key={r.element}>
              <div className="shirt" />
              <div className="player-points">{r.rawPoints}</div>
              <div className="player-name">{r.name}</div>
              <div className="player-team">{r.team}</div>
            </div>
          ))}
        </div>
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
