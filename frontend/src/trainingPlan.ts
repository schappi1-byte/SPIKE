import type { PlayerAnalysis } from "./analysis.ts";
import type { Athlete } from "./model.ts";

export const ANIMATIONS = ["squat", "lunge", "calf-raise", "squat-jump", "shuffle", "arm-raise"] as const;
export type AnimationId = (typeof ANIMATIONS)[number] | "none";
export type Phase = "countdown" | "exercising" | "resting" | "paused" | "completed";

export type PlanExercise = {
  name: string;
  skill: string;
  animation: AnimationId;
  sets: number;
  reps: number;
  durationSec: number;
  restSec: number;
  instructions: string;
  difficulty: "easy" | "moderate";
  phase: "warmup" | "work" | "cooldown";
};

export type WeekPlan = { goal: string; days: { name: string; exercises: PlanExercise[] }[] };

export type Session = {
  day: number;
  exercise: number;
  set: number;
  phase: Phase;
  resume: Phase | null;
  remaining: number;
  shownReps: number;
  afterRest: "set" | "exercise";
};

export type SavedPlan = {
  planId?: number;
  athleteId: number;
  generatedAt: string;
  sourceRecordedAt: string;
  analysisAt: string | null;
  plan: WeekPlan;
  done: number[][];
  session: Session | null;
};

const ORDER = { warmup: 0, work: 1, cooldown: 2 };
const KEY = "spike-training-plan-v1";

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function whole(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function exercise(value: unknown): PlanExercise | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = text(item.name, 80);
  const skill = text(item.skill, 40);
  const instructions = text(item.instructions, 400);
  const sets = whole(item.sets, 1, 4);
  const reps = whole(item.reps, 0, 20);
  const durationSec = whole(item.durationSec, 0, 120);
  const restSec = whole(item.restSec, 10, 90);
  const phase = item.phase === "warmup" || item.phase === "work" || item.phase === "cooldown" ? item.phase : null;
  if (!name || !skill || !instructions || sets == null || reps == null || durationSec == null || restSec == null || !phase) return null;
  if (reps === 0 && durationSec === 0) return null;
  const animation = typeof item.animation === "string" && (ANIMATIONS as readonly string[]).includes(item.animation) ? item.animation as AnimationId : "none";
  const difficulty = item.difficulty === "easy" ? "easy" : "moderate";
  return { name, skill, animation, sets, reps: reps > 0 ? reps : 0, durationSec: reps > 0 ? 0 : durationSec, restSec, instructions, difficulty, phase };
}

export function readTrainingPlan(value: unknown): WeekPlan | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const goal = text(item.goal, 140);
  if (!goal || !Array.isArray(item.days) || item.days.length !== 7) return null;
  const days = item.days.map((day) => {
    if (!day || typeof day !== "object") return null;
    const entry = day as Record<string, unknown>;
    const name = text(entry.name, 20);
    if (!name || !Array.isArray(entry.exercises) || entry.exercises.length < 3 || entry.exercises.length > 6) return null;
    const exercises = entry.exercises.map(exercise);
    if (exercises.some((move) => move == null)) return null;
    const list = (exercises as PlanExercise[]).slice().sort((a, b) => ORDER[a.phase] - ORDER[b.phase]);
    if (!list.some((move) => move.phase === "warmup") || !list.some((move) => move.phase === "cooldown")) return null;
    return { name, exercises: list };
  });
  if (days.some((day) => day == null)) return null;
  return { goal, days: days as WeekPlan["days"] };
}

export function exerciseSeconds(move: PlanExercise): number {
  const work = move.reps > 0 ? move.reps * 2 : move.durationSec;
  return move.sets * work + Math.max(0, move.sets - 1) * move.restSec;
}

export function todayIndex(now = new Date()): number {
  return (now.getDay() + 6) % 7;
}

function blankDone(): number[][] {
  return Array.from({ length: 7 }, () => []);
}

/** The workout timer's copy on this device. The server keeps the plan and confirmed progress. */
export function loadPlan(athleteId: number): SavedPlan | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, SavedPlan>;
    const item = saved[String(athleteId)];
    const plan = item ? readTrainingPlan(item.plan) : null;
    if (!item || item.athleteId !== athleteId || !plan || !Array.isArray(item.done)) return null;
    return { ...item, plan, done: item.done.length === 7 ? item.done : blankDone() };
  } catch {
    return null;
  }
}

export function savePlan(item: SavedPlan) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, SavedPlan>;
    saved[String(item.athleteId)] = item;
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Progress still shows for this visit if storage is unavailable.
  }
}

export function startSession(day: number): Session {
  return { day, exercise: 0, set: 0, phase: "countdown", resume: null, remaining: 3, shownReps: 0, afterRest: "set" };
}

function begin(exercise: PlanExercise, session: Session, patch: Partial<Session> = {}): Session {
  return { ...session, ...patch, phase: "exercising", resume: null, remaining: exercise.reps > 0 ? 0 : exercise.durationSec, shownReps: 0, afterRest: "set" };
}

export function tickSession(session: Session, exercise: PlanExercise, next: PlanExercise | null, delta: number): { session: Session; finished: boolean } {
  if (session.phase === "paused" || session.phase === "completed") return { session, finished: false };
  if (session.phase === "exercising" && exercise.reps > 0) {
    if (session.shownReps >= exercise.reps) return { session, finished: false };
    return { session: { ...session, shownReps: Math.min(exercise.reps, session.shownReps + delta / 1.6) }, finished: false };
  }
  const remaining = session.remaining - delta;
  if (remaining > 0) return { session: { ...session, remaining }, finished: false };
  if (session.phase === "countdown") return { session: begin(exercise, session), finished: false };
  if (session.phase === "exercising") return finishEffort(session, exercise);
  if (session.afterRest === "set") return { session: begin(exercise, session, { set: session.set + 1 }), finished: false };
  if (next) return { session: begin(next, session, { exercise: session.exercise + 1, set: 0 }), finished: true };
  return { session: { ...session, phase: "completed", remaining: 0 }, finished: true };
}

export function finishEffort(session: Session, exercise: PlanExercise): { session: Session; finished: boolean } {
  const anotherSet = session.set + 1 < exercise.sets;
  return {
    session: { ...session, phase: "resting", remaining: exercise.restSec, shownReps: exercise.reps, afterRest: anotherSet ? "set" : "exercise", resume: null },
    finished: false,
  };
}

/** Asks the server for a Gemini week plan. The server builds it from saved records and saves it. */
export async function requestTrainingPlan(athlete: Athlete): Promise<SavedPlan & { planId: number }> {
  let response: Response;
  try {
    response = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: athlete.playerId }),
    });
  } catch {
    throw new Error("The training request did not reach the server. Try again.");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Gemini could not build a training plan.";
    throw new Error(message);
  }
  const saved = body && typeof body === "object" && "plan" in body && body.plan && typeof body.plan === "object" ? (body.plan as Record<string, unknown>) : null;
  const plan = saved ? readTrainingPlan(saved.plan) : null;
  if (!saved || !plan || typeof saved.planId !== "number" || typeof saved.generatedAt !== "string" || typeof saved.sourceRecordedAt !== "string") {
    throw new Error("Gemini returned an incomplete training plan. Try again.");
  }
  return {
    planId: saved.planId,
    athleteId: athlete.id,
    generatedAt: saved.generatedAt,
    sourceRecordedAt: saved.sourceRecordedAt,
    analysisAt: typeof saved.analysisAt === "string" ? saved.analysisAt : null,
    plan,
    done: blankDone(),
    session: null,
  };
}

/** The server's plan, with this device's running workout if it belongs to the same plan. */
export function withLocalProgress(server: SavedPlan): SavedPlan {
  const local = loadPlan(server.athleteId);
  if (!local || local.generatedAt !== server.generatedAt) return server;
  const done = server.done.map((day, index) => [...new Set([...day, ...(local.done[index] ?? [])])]);
  return { ...server, done, session: local.session ?? server.session };
}

/** A workout in progress is saved paused, so it resumes cleanly on any device. */
function resumable(session: Session | null): Session | null {
  if (!session || session.phase === "paused" || session.phase === "completed") return session;
  return { ...session, phase: "paused", resume: session.phase };
}

/** What the server needs to know changed: finished exercises, or starting, pausing, moving on, or ending a workout. */
export function progressKey(item: SavedPlan): string {
  const session = item.session;
  return JSON.stringify([item.done, session ? [session.day, session.exercise, session.phase === "paused", session.phase === "completed"] : null]);
}

export async function syncProgress(planId: number, item: SavedPlan): Promise<string | null> {
  try {
    const response = await fetch("/api/training", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, done: item.done, session: resumable(item.session) }),
    });
    if (response.ok) return null;
    const body: unknown = await response.json().catch(() => null);
    return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Progress could not be saved.";
  } catch {
    return "Progress could not be saved. Check your connection; it will be sent with your next change.";
  }
}

export type { PlayerAnalysis };
