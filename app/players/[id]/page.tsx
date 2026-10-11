import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { getExercises, getLatestPlan, getProgress, getRosterPlayer } from "@/backend/lib/data";
import { isSupabaseConfigured, publicClient } from "@/backend/lib/supabase";
import { SKILLS } from "@/lib/types";
import { derivedStats, formatHitting, POSITION_NAMES } from "@/lib/volleyball";
import { PlanGenerator } from "./PlanGenerator";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { id } = await params;
  const db = publicClient();
  const [player, progress, exercises, latestPlan] = await Promise.all([
    getRosterPlayer(db, id),
    getProgress(db, id),
    getExercises(db),
    getLatestPlan(db, id),
  ]);
  if (!player) notFound();

  const stats = player.player_stats;
  const d = stats ? derivedStats(stats) : null;
  const exerciseName = new Map(exercises.map((e) => [e.exercise_id, e.name]));

  return (
    <>
      <p>
        <Link href="/">← Roster</Link>
      </p>
      <h1>{player.name}</h1>
      <p className="muted">
        {POSITION_NAMES[player.position]} · {player.class_year} · {player.height_cm} cm · can play {player.eligible_positions.join(", ")}
      </p>

      {stats && d ? (
        <>
          <h2>Season stats</h2>
          <div className="grid stats">
            <Stat label="Hitting %" value={formatHitting(d.hittingPercentage)} />
            <Stat label="Kills / set" value={d.killsPerSet.toFixed(2)} />
            <Stat label="Aces / set" value={d.acesPerSet.toFixed(2)} />
            <Stat label="Digs / set" value={d.digsPerSet.toFixed(2)} />
            <Stat label="Blocks / set" value={d.blocksPerSet.toFixed(2)} />
            <Stat label="Assists" value={String(stats.assists)} />
            <Stat label="Matches / sets" value={`${stats.matches_played} / ${stats.sets_played}`} />
          </div>
        </>
      ) : null}

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Skill ratings</h2>
          {player.skill_ratings
            ? SKILLS.map((skill) => {
                const value = player.skill_ratings?.[skill] ?? 0;
                return (
                  <div key={skill} className="rating-bar">
                    <span style={{ textTransform: "capitalize" }}>{skill}</span>
                    <div className="track">
                      <div className="fill" style={{ width: `${value * 10}%` }} />
                    </div>
                    <span>{value}</span>
                  </div>
                );
              })
            : <p className="muted">No ratings yet.</p>}
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Coach feedback</h2>
          {player.coach_feedback ? (
            <>
              <p>
                <strong>Strengths:</strong> {player.coach_feedback.strengths}
              </p>
              <p>
                <strong>Weaknesses:</strong> {player.coach_feedback.weaknesses}
              </p>
              <p>
                <strong>Goal:</strong> {player.coach_feedback.improvement_goals}
              </p>
              <p className="muted">{player.coach_feedback.coach_comments}</p>
            </>
          ) : (
            <p className="muted">No feedback yet.</p>
          )}
        </div>
      </div>

      <h2>Training progress</h2>
      <div className="panel" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Drill</th>
              <th>Assigned</th>
              <th>Status</th>
              <th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {progress.map((p) => (
              <tr key={`${p.exercise_id}-${p.assigned_date}`}>
                <td>{exerciseName.get(p.exercise_id) ?? p.exercise_id}</td>
                <td>{p.assigned_date}</td>
                <td>{p.completed ? `Completed ${p.completion_date}` : "In progress"}</td>
                <td className="num">{p.progress_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Training plan</h2>
      <PlanGenerator
        playerId={player.player_id}
        exerciseNames={Object.fromEntries(exerciseName)}
        initialPlan={latestPlan?.plan ?? null}
        initialCreatedAt={latestPlan?.created_at ?? null}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
