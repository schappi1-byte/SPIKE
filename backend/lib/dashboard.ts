import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Position, RosterPlayer, Skill } from "../../lib/types";
import { SKILL_KEYS, isRated, type Assessment, type Athlete, type Exercise, type Formation, type Lineup, type Session, type SkillKey, type Skills } from "../../frontend/src/model";
import { coachPlayer } from "../../frontend/server/gemini";
import { currentAnalysis, payloadFrom, readAnalysis, type PlayerAnalysis } from "../../frontend/src/analysis";
import { planIsCurrent, readTrainingPlan, type SavedPlan, type WeekPlan } from "../../frontend/src/trainingPlan";
import { getAccount } from "./auth";
import { getRoster, getTeam, getTeamMatches } from "./data";
import { isSupabaseConfigured } from "./supabase";

/** Dashboard skill keys mapped to the skill_ratings columns. */
export const SKILL_COLUMN: Record<SkillKey, Skill> = {
  serve: "serving",
  pass: "passing",
  set: "setting",
  attack: "hitting",
  block: "blocking",
  defense: "defense",
};

const POSITION_LABEL: Record<Position, string> = {
  OH: "Outside Hitter",
  OPP: "Opposite",
  MB: "Middle Blocker",
  S: "Setter",
  L: "Libero",
  DS: "Defensive Specialist",
};

/** Shown for a skill the season stats could not rate, until a coach saves an evaluation. */
const UNRATED_VALUE = 50;

export interface StoredAnalysis {
  athleteId: number;
  sourceRecordedAt: string;
  generatedAt: string;
  analysis: PlayerAnalysis;
}

export type StoredPlan = SavedPlan & { planId: number };

export interface DashboardState {
  account: { role: "coach" | "player"; name: string; athleteId: number | null };
  team: { name: string; season: number };
  athletes: Athlete[];
  analyses: Record<number, StoredAnalysis>;
  plans: Record<number, StoredPlan>;
  lineups: Lineup[];
}

interface EvaluationRow {
  evaluation_id: number;
  player_id: string;
  recorded_at: string;
  skills: Skills;
  strengths: string;
  weaknesses: string;
  priorities: string;
  unrated: string[];
  analysis: unknown;
  analysis_at: string | null;
}

interface PlanRow {
  plan_id: number;
  player_id: string;
  plan: { generatedAt?: unknown; sourceRecordedAt?: unknown; analysisAt?: unknown; plan?: unknown; done?: unknown; session?: unknown };
}

interface LineupRow {
  lineup_id: number;
  name: string;
  formation: Formation;
  rotation: number;
  slots: (string | null)[];
  saved_at: string;
}

interface ProgressRow {
  player_id: string;
  exercise_id: string;
  assigned_date: string;
  completed: boolean;
  completion_date: string | null;
  exercises: { name: string; target_skill: Skill; duration_minutes: number; instructions: string } | null;
}

/** The signed-in account, or an error response. */
export async function dashboardAccount(): Promise<Account | Response> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) {
    return Response.json({ error: "Supabase keys are not set on the server." }, { status: 503 });
  }
  const account = await getAccount();
  if (!account) return Response.json({ error: "Log in to see your dashboard." }, { status: 401 });
  return account;
}

/** Coaches can act for anyone on their team; players only for themselves. */
export function canActFor(account: Account, player: { player_id: string; team_id: string }): boolean {
  if (player.team_id !== account.team_id) return false;
  return account.role === "coach" || account.player_id === player.player_id;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function skillFromColumn(column: Skill): SkillKey {
  return SKILL_KEYS.find((key) => SKILL_COLUMN[key] === column) ?? "serve";
}

/** The skill_ratings scale is 1-10; the dashboard uses 0-100. */
export function toTen(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value / 10)));
}

function baseline(player: RosterPlayer, recordedAt: string): { assessment: Assessment; unrated: SkillKey[] } {
  const ratings = player.skill_ratings;
  const unrated: SkillKey[] = [];
  const skills = {} as Skills;
  for (const key of SKILL_KEYS) {
    const value = ratings?.[SKILL_COLUMN[key]] ?? null;
    if (value == null) unrated.push(key);
    skills[key] = value == null ? UNRATED_VALUE : value * 10;
  }
  const feedback = player.coach_feedback;
  return {
    assessment: {
      id: `baseline-${player.player_id}`,
      recordedAt,
      skills,
      strengths: feedback?.strengths ?? "",
      weaknesses: feedback?.weaknesses ?? "",
      priorities: feedback?.improvement_goals ?? "",
      unrated,
    },
    unrated,
  };
}

function fromRow(row: EvaluationRow): Assessment {
  return {
    id: `evaluation-${row.evaluation_id}`,
    recordedAt: row.recorded_at,
    skills: row.skills,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    priorities: row.priorities,
    unrated: row.unrated as SkillKey[],
  };
}

function storedPlan(row: PlanRow, athleteId: number): StoredPlan | null {
  const source = row.plan;
  const plan = readTrainingPlan(source.plan);
  if (!plan || typeof source.generatedAt !== "string" || typeof source.sourceRecordedAt !== "string") return null;
  const done = Array.isArray(source.done) && source.done.length === 7 ? (source.done as number[][]) : Array.from({ length: 7 }, () => []);
  return {
    planId: row.plan_id,
    athleteId,
    generatedAt: source.generatedAt,
    sourceRecordedAt: source.sourceRecordedAt,
    analysisAt: typeof source.analysisAt === "string" ? source.analysisAt : null,
    plan,
    done,
    session: (source.session ?? null) as SavedPlan["session"],
  };
}

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Everything the dashboard shows for this account. Players get only their own records. */
export async function loadDashboard(db: SupabaseClient, account: Account): Promise<DashboardState> {
  const [team, roster, matches] = await Promise.all([getTeam(db, account.team_id), getRoster(db, account.team_id), getTeamMatches(db, account.team_id)]);
  const ids = new Map(roster.map((player, index) => [player.player_id, index + 1]));
  const visible = account.role === "coach" ? roster : roster.filter((player) => player.player_id === account.player_id);
  const visibleIds = visible.map((player) => player.player_id);
  const baselineAt = `${matches.at(-1)?.match_date ?? "2026-01-01"}T12:00:00.000Z`;

  const [evaluations, plans, progress, lineups] = await Promise.all([
    visibleIds.length
      ? db.from("evaluations").select("*").in("player_id", visibleIds).order("recorded_at").then((r) => unwrap<EvaluationRow[]>(r))
      : [],
    visibleIds.length
      ? db
          .from("training_plans")
          .select("plan_id, player_id, plan")
          .eq("kind", "week")
          .in("player_id", visibleIds)
          .order("created_at", { ascending: false })
          .then((r) => unwrap<PlanRow[]>(r))
      : [],
    visibleIds.length
      ? db
          .from("training_progress")
          .select("player_id, exercise_id, assigned_date, completed, completion_date, exercises(name, target_skill, duration_minutes, instructions)")
          .in("player_id", visibleIds)
          .order("assigned_date")
          .then((r) => unwrap<ProgressRow[]>(r))
      : [],
    account.role === "coach"
      ? db.from("lineups").select("*").eq("team_id", account.team_id).order("saved_at", { ascending: false }).then((r) => unwrap<LineupRow[]>(r))
      : [],
  ]);

  const analyses: Record<number, StoredAnalysis> = {};
  const storedPlans: Record<number, StoredPlan> = {};
  const athletes = visible.map((player): Athlete => {
    const id = ids.get(player.player_id) ?? 0;
    const rows = evaluations.filter((row) => row.player_id === player.player_id);
    const start = baseline(player, baselineAt);
    const assessments = rows.length ? rows.map(fromRow) : [start.assessment];
    const latestRow = rows.at(-1);
    const unrated = latestRow ? (latestRow.unrated as SkillKey[]) : start.unrated;

    const analysed = rows.filter((row) => row.analysis && row.analysis_at).sort((a, b) => (a.analysis_at ?? "").localeCompare(b.analysis_at ?? "")).at(-1);
    const analysis = analysed ? readAnalysis(analysed.analysis) : null;
    if (analysed && analysis) analyses[id] = { athleteId: id, sourceRecordedAt: analysed.recorded_at, generatedAt: analysed.analysis_at ?? "", analysis };

    const planRow = plans.find((row) => row.player_id === player.player_id);
    const plan = planRow ? storedPlan(planRow, id) : null;
    if (plan) storedPlans[id] = plan;

    const assigned = progress.filter((row) => row.player_id === player.player_id && row.exercises);
    const assignments: Exercise[] = assigned.map((row) => ({
      id: `${row.exercise_id}:${row.assigned_date}`,
      skill: skillFromColumn(row.exercises!.target_skill),
      title: row.exercises!.name,
      detail: row.exercises!.instructions,
      minutes: row.exercises!.duration_minutes,
      done: row.completed,
    }));
    const sessions: Session[] = assigned
      .filter((row) => row.completed && row.completion_date)
      .map((row) => ({
        id: `progress-${row.player_id}-${row.exercise_id}-${row.completion_date}`,
        exerciseId: `${skillFromColumn(row.exercises!.target_skill)}:${row.exercise_id}`,
        title: row.exercises!.name,
        minutes: row.exercises!.duration_minutes,
        completedAt: `${row.completion_date}T12:00:00.000Z`,
      }));

    const played = player.player_stats?.matches_played ?? 0;
    return {
      id,
      playerId: player.player_id,
      name: player.name,
      initials: initials(player.name),
      number: Number(player.jersey_number ?? 0),
      position: POSITION_LABEL[player.position] ?? player.position,
      grade: player.class_year,
      attendance: team?.matches ? Math.round((played / team.matches) * 100) : 0,
      color: "",
      assessments,
      sessions,
      unrated,
      assignments,
    };
  });

  const athleteOf = (playerId: string | null) => (playerId ? (ids.get(playerId) ?? null) : null);
  return {
    account: { role: account.role, name: account.display_name, athleteId: athleteOf(account.player_id) },
    team: { name: team ? `${team.school} ${team.team_name}` : "Team", season: team?.season ?? new Date().getFullYear() },
    athletes,
    analyses,
    plans: storedPlans,
    lineups: lineups.map((row) => ({
      id: String(row.lineup_id),
      name: row.name,
      formation: row.formation,
      rotation: row.rotation,
      slots: row.slots.map(athleteOf),
      savedAt: row.saved_at,
    })),
  };
}

/** One athlete as the dashboard sees it, if this account may act for them. */
export async function loadAthleteFor(db: SupabaseClient, account: Account, playerId: string) {
  const state = await loadDashboard(db, account);
  const athlete = state.athletes.find((item) => item.playerId === playerId) ?? null;
  if (!athlete) return null;
  return { state, athlete, analysis: state.analyses[athlete.id] ?? null, plan: state.plans[athlete.id] ?? null };
}

/**
 * The evaluations row for the athlete's latest assessment. A stats baseline has no row yet,
 * so it is saved first (unchanged) and the analysis is attached to it.
 */
export async function latestEvaluationId(db: SupabaseClient, athlete: Athlete): Promise<number> {
  const latest = athlete.assessments.at(-1);
  if (latest && latest.id.startsWith("evaluation-")) return Number(latest.id.slice("evaluation-".length));
  if (!latest || !athlete.playerId) throw new Error("This player has no evaluation yet.");
  const { data, error } = await db
    .from("evaluations")
    .insert({
      player_id: athlete.playerId,
      recorded_at: latest.recordedAt,
      skills: latest.skills,
      strengths: latest.strengths,
      weaknesses: latest.weaknesses,
      priorities: latest.priorities,
      unrated: athlete.unrated ?? [],
    })
    .select("evaluation_id")
    .single<{ evaluation_id: number }>();
  if (error || !data) throw new Error(error?.message ?? "Could not save the evaluation.");
  return data.evaluation_id;
}

/** Lowest-rated skill, as the training_plans.focus_skill column expects. */
export function focusSkill(athlete: Athlete): Skill {
  const latest = athlete.assessments.at(-1);
  if (!latest) return "serving";
  const rated = SKILL_KEYS.filter((key) => isRated(latest, key));
  const keys = rated.length ? rated : [...SKILL_KEYS];
  const lowest = [...keys].sort((a, b) => latest.skills[a] - latest.skills[b])[0] ?? "serve";
  return SKILL_COLUMN[lowest];
}

export function geminiOptions() {
  return { apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL };
}

const DAILY_GEMINI_LIMIT = 4;

/** Gemini requests for this player in the last 24 hours. A combined request saves both results with one timestamp. */
async function geminiCallsToday(db: SupabaseClient, playerId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [analysed, planned] = await Promise.all([
    db.from("evaluations").select("analysis_at").eq("player_id", playerId).gte("analysis_at", since).then((r) => unwrap<{ analysis_at: string }[]>(r)),
    db.from("training_plans").select("plan").eq("player_id", playerId).eq("kind", "week").gte("created_at", since).then((r) => unwrap<{ plan: { generatedAt?: unknown } }[]>(r)),
  ]);
  const stamps = [...analysed.map((row) => row.analysis_at), ...planned.map((row) => String(row.plan.generatedAt))];
  return new Set(stamps.map((stamp) => new Date(stamp).getTime())).size;
}

/**
 * The athlete's analysis and week plan for their latest evaluation. Saved results are reused; otherwise one
 * Gemini request makes whatever is missing. A new analysis always comes with a matching week plan.
 */
export async function coachResults(db: SupabaseClient, found: NonNullable<Awaited<ReturnType<typeof loadAthleteFor>>>, need: "analysis" | "plan"): Promise<Response | { analysis: StoredAnalysis | null; plan: StoredPlan | null }> {
  const { athlete } = found;
  const latest = athlete.assessments.at(-1);
  if (!latest || !athlete.playerId) return Response.json({ error: "This player has no evaluation yet." }, { status: 400 });
  const analysis = currentAnalysis(athlete, found.analysis);
  const plan = found.plan && planIsCurrent(athlete, found.plan, found.analysis) ? found.plan : null;
  if (need === "analysis" ? analysis : plan) return { analysis, plan };

  if ((await geminiCallsToday(db, athlete.playerId)) >= DAILY_GEMINI_LIMIT) {
    return Response.json({ error: `This player has used today's ${DAILY_GEMINI_LIMIT} Gemini requests. Saved results are still shown; try again tomorrow.` }, { status: 429 });
  }
  const want = { analysis: need === "analysis" || !analysis, plan: true };
  const result = await coachPlayer({ ...payloadFrom(athlete), analysis: want.analysis ? null : analysis?.analysis ?? null }, want, geminiOptions());
  if ("error" in result.body) return Response.json(result.body, { status: result.status });

  const generatedAt = new Date().toISOString();
  let saved = analysis;
  if (result.body.analysis) {
    const evaluationId = await latestEvaluationId(db, athlete).catch((caught: Error) => caught);
    const { error } = evaluationId instanceof Error ? { error: evaluationId } : await db.from("evaluations").update({ analysis: result.body.analysis, analysis_at: generatedAt }).eq("evaluation_id", evaluationId);
    if (error) return Response.json({ error: `The analysis was created but not saved: ${error.message}` }, { status: 500 });
    saved = { athleteId: athlete.id, sourceRecordedAt: latest.recordedAt, generatedAt, analysis: result.body.analysis };
  }
  const record = { generatedAt, sourceRecordedAt: latest.recordedAt, analysisAt: saved?.generatedAt ?? null, plan: result.body.plan!, done: Array.from({ length: 7 }, () => []), session: null };
  const { data, error } = await db
    .from("training_plans")
    .insert({ player_id: athlete.playerId, kind: "week", focus_skill: focusSkill(athlete), plan: record })
    .select("plan_id")
    .single<{ plan_id: number }>();
  if (error || !data) return Response.json({ error: `The plan was created but not saved: ${error?.message ?? "unknown error"}` }, { status: 500 });
  return { analysis: saved, plan: { ...record, planId: data.plan_id, athleteId: athlete.id } };
}

export type { WeekPlan };
