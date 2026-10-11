import { planTraining } from "@/frontend/server/gemini";
import { canActFor, dashboardAccount, focusSkill, geminiOptions, geminiPayload, loadAthleteFor } from "@/backend/lib/dashboard";
import { adminClient } from "@/backend/lib/supabase";

const PHASES = new Set(["countdown", "exercising", "resting", "paused", "completed"]);

/** Gemini's seven-day plan for a player, saved as a 'week' training plan. */
export async function POST(request: Request) {
  const account = await dashboardAccount();
  if (account instanceof Response) return account;

  const body = (await request.json().catch(() => null)) as { playerId?: unknown } | null;
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  if (!playerId) return Response.json({ error: "playerId is required." }, { status: 400 });

  const db = adminClient();
  const found = await loadAthleteFor(db, account, playerId);
  if (!found) return Response.json({ error: "You can only plan for yourself, or for players on your team as a coach." }, { status: 403 });

  const result = await planTraining({ ...geminiPayload(found.athlete), analysis: found.analysis?.analysis ?? null }, geminiOptions());
  if (!("plan" in result.body)) return Response.json(result.body, { status: result.status });

  const record = {
    generatedAt: new Date().toISOString(),
    sourceRecordedAt: found.athlete.assessments.at(-1)?.recordedAt ?? "",
    analysisAt: found.analysis?.generatedAt ?? null,
    plan: result.body.plan,
    done: Array.from({ length: 7 }, () => []),
    session: null,
  };
  const { data, error } = await db
    .from("training_plans")
    .insert({ player_id: playerId, kind: "week", focus_skill: focusSkill(found.athlete), plan: record })
    .select("plan_id")
    .single<{ plan_id: number }>();
  if (error || !data) return Response.json({ error: `The plan was created but not saved: ${error?.message ?? "unknown error"}` }, { status: 500 });

  return Response.json({ plan: { ...record, planId: data.plan_id, athleteId: found.athlete.id } });
}

function doneOf(value: unknown): number[][] | null {
  if (!Array.isArray(value) || value.length !== 7) return null;
  const days = value.map((day) => (Array.isArray(day) && day.length <= 12 && day.every((item) => Number.isInteger(item) && item >= 0 && item < 12) ? (day as number[]) : null));
  return days.every((day) => day != null) ? (days as number[][]) : null;
}

function sessionOf(value: unknown): Record<string, unknown> | null | undefined {
  if (value == null) return null;
  if (typeof value !== "object") return undefined;
  const session = value as Record<string, unknown>;
  const numbers = ["day", "exercise", "set", "remaining", "shownReps"].every((key) => typeof session[key] === "number" && Number.isFinite(session[key]));
  if (!numbers || typeof session.phase !== "string" || !PHASES.has(session.phase)) return undefined;
  if (session.resume != null && (typeof session.resume !== "string" || !PHASES.has(session.resume))) return undefined;
  if (session.afterRest !== "set" && session.afterRest !== "exercise") return undefined;
  const { day, exercise, set, phase, resume, remaining, shownReps, afterRest } = session;
  return { day, exercise, set, phase, resume: resume ?? null, remaining, shownReps, afterRest };
}

/** Saves workout progress: finished exercises per day and a paused workout to resume. */
export async function PATCH(request: Request) {
  const account = await dashboardAccount();
  if (account instanceof Response) return account;

  const body = (await request.json().catch(() => null)) as { planId?: unknown; done?: unknown; session?: unknown } | null;
  const planId = typeof body?.planId === "number" ? body.planId : null;
  const done = doneOf(body?.done);
  const session = sessionOf(body?.session);
  if (planId == null || !done || session === undefined) return Response.json({ error: "The training progress could not be read." }, { status: 400 });

  const db = adminClient();
  const { data: row } = await db
    .from("training_plans")
    .select("plan_id, kind, plan, players(player_id, team_id)")
    .eq("plan_id", planId)
    .maybeSingle<{ plan_id: number; kind: string; plan: Record<string, unknown>; players: { player_id: string; team_id: string } | null }>();
  if (!row || row.kind !== "week" || !row.players || !canActFor(account, row.players)) {
    return Response.json({ error: "That training plan isn't yours to update." }, { status: 403 });
  }

  const { error } = await db
    .from("training_plans")
    .update({ plan: { ...row.plan, done, session }, updated_at: new Date().toISOString() })
    .eq("plan_id", planId);
  if (error) return Response.json({ error: `Progress was not saved: ${error.message}` }, { status: 500 });
  return Response.json({ ok: true });
}
