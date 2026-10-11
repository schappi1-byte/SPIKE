import { SetupNotice } from "@/components/SetupNotice";
import { getRoster, getTeams } from "@/backend/lib/data";
import { isSupabaseConfigured, publicClient } from "@/backend/lib/supabase";
import { optimizeFourTwo } from "@/lib/volleyball";
import { LineupBoard, type PlayerInfo } from "./LineupBoard";

export const dynamic = "force-dynamic";

export default async function LineupPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const db = publicClient();
  const [team] = await getTeams(db);
  if (!team) return <p className="muted">No teams yet. Run npm run db:seed.</p>;
  const roster = await getRoster(db, team.team_id);

  let plan;
  try {
    plan = optimizeFourTwo(roster);
  } catch (e) {
    return <p className="error">{e instanceof Error ? e.message : "Could not build a lineup."}</p>;
  }

  const players: Record<string, PlayerInfo> = Object.fromEntries(
    roster.map((p) => [p.player_id, { name: p.name, position: p.position }]),
  );
  const name = (id: string | null) => (id ? players[id]?.name ?? id : "None");

  return (
    <>
      <h1>4–2 lineup</h1>
      <p className="muted">
        Built from skill ratings. The two setters stay opposite each other, so one is always in the front row. The libero replaces whichever
        middle blocker is in the back row.
      </p>

      <div className="grid stats" style={{ margin: "20px 0" }}>
        <Pick label="Setters" value={plan.setters.map(name).join(" & ")} />
        <Pick label="Middle blockers" value={plan.middles.map(name).join(" & ")} />
        <Pick label="Outside & opposite" value={plan.pins.map(name).join(" & ")} />
        <Pick label="Libero" value={name(plan.libero)} />
      </div>

      <LineupBoard teamId={team.team_id} plan={plan} players={players} />
    </>
  );
}

function Pick({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel stat">
      <div className="label">{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}
