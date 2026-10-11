import { SKILL_KEYS, type Skills } from "@/frontend/src/model";
import { requireCoach } from "@/backend/lib/auth";
import { SKILL_COLUMN, latestEvaluationId, loadAthleteFor, loadDashboard, toTen } from "@/backend/lib/dashboard";
import { adminClient } from "@/backend/lib/supabase";

function note(value: unknown): string | null {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > 1000) return null;
  return value.trim();
}

function skillsOf(value: unknown): Skills | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const skills = {} as Skills;
  for (const key of SKILL_KEYS) {
    const rating = source[key];
    if (typeof rating !== "number" || !Number.isFinite(rating) || rating < 0 || rating > 100) return null;
    skills[key] = Math.round(rating);
  }
  return skills;
}

/** Saves a coach evaluation to the history, and makes it the player's current ratings and feedback. */
export async function POST(request: Request) {
  const coach = await requireCoach();
  if (coach instanceof Response) return coach;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  const skills = skillsOf(body?.skills);
  const strengths = note(body?.strengths);
  const weaknesses = note(body?.weaknesses);
  const priorities = note(body?.priorities);
  if (!playerId || !skills || strengths == null || weaknesses == null || priorities == null) {
    return Response.json({ error: "Every skill needs a rating from 0 to 100, and notes must be under 1,000 characters." }, { status: 400 });
  }

  const db = adminClient();
  const found = await loadAthleteFor(db, coach, playerId);
  if (!found) return Response.json({ error: "That player isn't on your team." }, { status: 403 });

  try {
    // Keeps the season-stats baseline in the history, so the first coach evaluation shows a trend.
    await latestEvaluationId(db, found.athlete);
  } catch (error) {
    return Response.json({ error: `The evaluation was not saved: ${error instanceof Error ? error.message : "unknown error"}` }, { status: 500 });
  }

  const { error } = await db
    .from("evaluations")
    .insert({ player_id: playerId, skills, strengths, weaknesses, priorities, created_by: coach.user_id });
  if (error) return Response.json({ error: `The evaluation was not saved: ${error.message}` }, { status: 500 });

  const ratings = Object.fromEntries(SKILL_KEYS.map((key) => [SKILL_COLUMN[key], toTen(skills[key])]));
  const { data: existing } = await db.from("coach_feedback").select("coach_comments").eq("player_id", playerId).maybeSingle<{ coach_comments: string }>();
  const [ratingResult, feedbackResult] = await Promise.all([
    db.from("skill_ratings").upsert({ player_id: playerId, ...ratings }),
    db.from("coach_feedback").upsert({
      player_id: playerId,
      strengths,
      weaknesses,
      improvement_goals: priorities,
      coach_comments: existing?.coach_comments ?? "",
    }),
  ]);
  const syncError = ratingResult.error ?? feedbackResult.error;
  if (syncError) {
    return Response.json({ error: `The evaluation was saved, but the current ratings were not updated: ${syncError.message}` }, { status: 500 });
  }

  return Response.json(await loadDashboard(db, coach));
}
