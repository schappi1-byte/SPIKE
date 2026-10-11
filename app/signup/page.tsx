import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { getAccount } from "@/backend/lib/auth";
import { getRoster, getTeams } from "@/backend/lib/data";
import { adminClient, isSupabaseConfigured } from "@/backend/lib/supabase";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  if (await getAccount()) redirect("/");

  const db = adminClient();
  const [team] = await getTeams(db);
  if (!team) return <p className="muted">No teams yet. Run npm run db:seed.</p>;
  const [roster, { data: claimed }] = await Promise.all([
    getRoster(db, team.team_id),
    db.from("profiles").select("player_id").not("player_id", "is", null),
  ]);
  const taken = new Set((claimed ?? []).map((r: { player_id: string }) => r.player_id));
  const open = roster
    .filter((p) => !taken.has(p.player_id))
    .map((p) => ({ player_id: p.player_id, label: p.jersey_number ? `#${p.jersey_number} ${p.name}` : p.name }));

  return (
    <div className="auth-card">
      <h1>Sign up</h1>
      <p className="muted">
        {team.school} {team.team_name}. You only do this once. After that, log in with your name and passcode.
      </p>
      <SignupForm players={open} />
      <p className="muted">
        Already signed up? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
