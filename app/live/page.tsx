import { SetupNotice } from "@/components/SetupNotice";
import { coachPage, getAccount } from "@/backend/lib/auth";
import { getLiveSession, getRoster, getTeams } from "@/backend/lib/data";
import { isSupabaseConfigured, publicClient } from "@/backend/lib/supabase";
import { LiveCourt } from "./LiveCourt";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  await coachPage();

  const db = publicClient();
  const [team] = await getTeams(db);
  if (!team) return <p className="muted">No teams yet. Run npm run db:seed.</p>;
  const [roster, session, account] = await Promise.all([getRoster(db, team.team_id), getLiveSession(db, team.team_id), getAccount()]);

  return (
    <>
      <h1>Live court</h1>
      <p className="muted">
        {team.school} {team.team_name}. This page updates by itself when the coach sends a new rotation.
      </p>
      <LiveCourt
        teamId={team.team_id}
        initialRows={session.rows}
        players={Object.fromEntries(roster.map((p) => [p.player_id, { name: p.name, position: p.position }]))}
        myPlayerId={account?.player_id ?? null}
      />
    </>
  );
}
