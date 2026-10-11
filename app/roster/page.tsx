import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";
import { coachPage } from "@/backend/lib/auth";
import { getRoster, getTeams } from "@/backend/lib/data";
import { isSupabaseConfigured, publicClient } from "@/backend/lib/supabase";
import { derivedStats, formatHitting, formatPercent } from "@/lib/volleyball";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  await coachPage();

  const db = publicClient();
  const [team] = await getTeams(db);
  if (!team) return <p className="muted">No teams yet. Run npm run db:seed to load the UNC Chapel Hill data.</p>;
  const roster = await getRoster(db, team.team_id);

  return (
    <>
      <h1>
        {team.school} {team.team_name}
      </h1>
      <p className="muted">
        {team.season} season · {team.wins}–{team.losses} · {team.matches} matches, {team.sets} sets
      </p>

      <h2>Roster</h2>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Class</th>
              <th className="num">Ht (cm)</th>
              <th className="num">Sets</th>
              <th className="num">Hit %</th>
              <th className="num">K/S</th>
              <th className="num">A/S</th>
              <th className="num">D/S</th>
              <th className="num">B/S</th>
              <th className="num">Recv %</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => {
              const stats = p.player_stats;
              const d = stats ? derivedStats(stats) : null;
              const assistsPerSet = stats && stats.sets_played > 0 ? stats.assists / stats.sets_played : 0;
              return (
                <tr key={p.player_id}>
                  <td className="num">{p.jersey_number ?? "—"}</td>
                  <td>
                    <Link href={`/players/${p.player_id}`}>{p.name}</Link>
                  </td>
                  <td>
                    <span className="pill">{p.position}</span>
                  </td>
                  <td>{p.class_year}</td>
                  <td className="num">{p.height_cm}</td>
                  <td className="num">{stats?.sets_played ?? "—"}</td>
                  <td className="num">{d ? formatHitting(d.hittingPercentage) : "—"}</td>
                  <td className="num">{d ? d.killsPerSet.toFixed(2) : "—"}</td>
                  <td className="num">{assistsPerSet.toFixed(2)}</td>
                  <td className="num">{d ? d.digsPerSet.toFixed(2) : "—"}</td>
                  <td className="num">{d ? d.blocksPerSet.toFixed(2) : "—"}</td>
                  <td className="num">{d ? formatPercent(d.receptionPercentage) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">Roster and stats: goheels.com, {team.season} season.</p>
    </>
  );
}
