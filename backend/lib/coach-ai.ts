import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getExercises, getProgress, getResearch, getRosterPlayer, getTeam, getTeamMatches } from "./data";
import type { Exercise, RosterPlayer, Skill, Team, TeamMatch, TrainingPlan, TrainingProgress } from "../../lib/types";
import { SKILLS } from "../../lib/types";
import { matchLine, researchSummary, type ResearchSummary } from "../../lib/insights";
import { derivedStats, formatHitting, formatPercent, POSITION_NAMES, PRIMARY_SKILL, weakestSkills } from "../../lib/volleyball";

const MASTERED_SCORE = 85;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export interface PlayerContext {
  player: RosterPlayer;
  progress: (TrainingProgress & { exercise: Exercise | undefined })[];
  focusSkill: Skill;
  candidates: Exercise[];
  team: Team | null;
  matches: TeamMatch[];
  research: ResearchSummary | null;
}

export async function loadPlayerContext(db: SupabaseClient, playerId: string): Promise<PlayerContext | null> {
  const [player, progress, exercises, research] = await Promise.all([
    getRosterPlayer(db, playerId),
    getProgress(db, playerId),
    getExercises(db),
    getResearch(db),
  ]);
  if (!player?.skill_ratings) return null;
  const [team, matches] = await Promise.all([getTeam(db, player.team_id), getTeamMatches(db, player.team_id)]);

  const byId = new Map(exercises.map((e) => [e.exercise_id, e]));
  const focusSkill = weakestSkills(player, player.skill_ratings)[0] ?? PRIMARY_SKILL[player.position];
  const mastered = new Set(progress.filter((p) => p.completed && p.progress_score >= MASTERED_SCORE).map((p) => p.exercise_id));
  const forSkill = exercises.filter((e) => e.target_skill === focusSkill);
  const unmastered = forSkill.filter((e) => !mastered.has(e.exercise_id));
  const candidates = unmastered.length > 0 ? unmastered : forSkill.length > 0 ? forSkill : exercises;
  // Plans need at least one drill; with none loaded there is nothing to build from.
  if (candidates.length === 0) return null;

  return {
    player,
    progress: progress.map((p) => ({ ...p, exercise: byId.get(p.exercise_id) })),
    focusSkill,
    candidates,
    team,
    matches,
    research: research.matches.length ? researchSummary(research.matches) : null,
  };
}

function teamContext(ctx: PlayerContext) {
  if (!ctx.team) return null;
  const wins = matchLine(ctx.matches.filter((m) => m.result === "win"));
  const losses = matchLine(ctx.matches.filter((m) => m.result === "loss"));
  return {
    school: ctx.team.school,
    record: `${ctx.team.wins}-${ctx.team.losses}`,
    hitting_percentage_in_wins: formatHitting(wins.hittingPercentage),
    hitting_percentage_in_losses: formatHitting(losses.hittingPercentage),
    serve_receive_in_wins: formatPercent(wins.receptionPercentage),
    serve_receive_in_losses: formatPercent(losses.receptionPercentage),
  };
}

function researchContext(ctx: PlayerContext) {
  const r = ctx.research;
  if (!r) return null;
  return {
    source: "Sanhueza-Tapia et al. (2026), 58 women's U16 matches",
    finding: "Attack effectiveness was the only indicator that separated wins from losses.",
    win_rate_with_attack_effectiveness_at_or_above_median: formatPercent(r.winRateAboveMedian, 0),
    win_rate_below_median: formatPercent(r.winRateBelowMedian, 0),
  };
}

function contextForModel(ctx: PlayerContext) {
  const { player } = ctx;
  const stats = player.player_stats;
  const derived = stats ? derivedStats(stats) : null;
  return {
    player: { name: player.name, position: POSITION_NAMES[player.position], class_year: player.class_year },
    stats: stats && derived
      ? {
          matches_played: stats.matches_played,
          sets_played: stats.sets_played,
          kills: stats.kills,
          attack_attempts: stats.attack_attempts,
          hitting_percentage: formatHitting(derived.hittingPercentage),
          kills_per_set: derived.killsPerSet.toFixed(2),
          assists_per_set: stats.sets_played ? (stats.assists / stats.sets_played).toFixed(2) : "0.00",
          aces: stats.service_aces,
          service_errors: stats.service_errors,
          serves_in: formatPercent(derived.serveInPercentage),
          digs_per_set: derived.digsPerSet.toFixed(2),
          blocks_per_set: derived.blocksPerSet.toFixed(2),
          reception_errors: stats.reception_errors,
          serve_receive_attempts: stats.reception_attempts,
          serve_receive: formatPercent(derived.receptionPercentage),
        }
      : null,
    team: teamContext(ctx),
    research: researchContext(ctx),
    ratings: Object.fromEntries(SKILLS.map((s) => [s, player.skill_ratings?.[s] ?? "not enough data"])),
    coach_feedback: player.coach_feedback,
    focus_skill: ctx.focusSkill,
    training_history: ctx.progress.map((p) => ({
      exercise_id: p.exercise_id,
      name: p.exercise?.name,
      skill: p.exercise?.target_skill,
      completed: p.completed,
      progress_score: p.progress_score,
    })),
    candidate_exercises: ctx.candidates.map((e) => ({
      exercise_id: e.exercise_id,
      name: e.name,
      difficulty: e.difficulty,
      duration_minutes: e.duration_minutes,
      reps: e.reps,
      instructions: e.instructions,
    })),
  };
}

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    reason: { type: "string" },
    sessions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          day: { type: "string", enum: DAYS },
          exercise_id: { type: "string" },
          duration_minutes: { type: "integer", minimum: 5, maximum: 45 },
          reps: { type: "integer", minimum: 5, maximum: 100 },
          coaching_cue: { type: "string" },
        },
        required: ["day", "exercise_id", "duration_minutes", "reps", "coaching_cue"],
      },
    },
  },
  required: ["reason", "sessions"],
};

function gemini(): { ai: GoogleGenAI; model: string } | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return { ai: new GoogleGenAI({ apiKey }), model: process.env.GEMINI_MODEL || "gemini-3.5-flash" };
}

/** Easiest drills first, spread over the week. Used when Gemini is unavailable or returns bad ids. */
function fallbackPlan(ctx: PlayerContext): TrainingPlan {
  const order = { Beginner: 0, Intermediate: 1, Advanced: 2 };
  const drills = [...ctx.candidates].sort((a, b) => order[a.difficulty] - order[b.difficulty]);
  const rated = ctx.player.skill_ratings?.[ctx.focusSkill] != null;
  const feedback = rated ? ctx.player.coach_feedback?.weaknesses : undefined;
  const why = rated
    ? `${ctx.focusSkill} is the lowest rating for this role`
    : `There isn't enough match data to rate this player yet, so the plan builds ${ctx.focusSkill}, the core skill for a ${POSITION_NAMES[ctx.player.position].toLowerCase()}`;
  return {
    focus_skill: ctx.focusSkill,
    reason: feedback ? `${why}. Season stats: ${feedback}.` : `${why}.`,
    sessions: DAYS.slice(0, Math.max(3, Math.min(5, drills.length))).flatMap((day, i) => {
      const drill = drills[i % drills.length];
      return drill
        ? [{ day, exercise_id: drill.exercise_id, duration_minutes: drill.duration_minutes, reps: drill.reps, coaching_cue: drill.instructions }]
        : [];
    }),
  };
}

export async function generateTrainingPlan(ctx: PlayerContext): Promise<{ plan: TrainingPlan; source: "gemini" | "fallback" }> {
  const client = gemini();
  if (!client) return { plan: fallbackPlan(ctx), source: "fallback" };

  const allowed = new Set(ctx.candidates.map((e) => e.exercise_id));
  try {
    const response = await client.ai.models.generateContent({
      model: client.model,
      contents: JSON.stringify(contextForModel(ctx)),
      config: {
        systemInstruction:
          "You are a college volleyball coach writing a one-week individual training plan. " +
          "Use only the player data provided. Every exercise_id must come from candidate_exercises. " +
          "Ground the reason in the player's real stats, and use the team and research context when they show why the skill matters. " +
          "Start with an easier drill if the player scored below 75 on a drill for this skill. " +
          "Keep each coaching_cue to one short, specific sentence the player can act on.",
        responseMimeType: "application/json",
        responseJsonSchema: PLAN_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const parsed = JSON.parse(response.text ?? "") as Omit<TrainingPlan, "focus_skill">;
    if (parsed.sessions.length === 0 || !parsed.sessions.every((s) => allowed.has(s.exercise_id))) {
      return { plan: fallbackPlan(ctx), source: "fallback" };
    }
    return { plan: { focus_skill: ctx.focusSkill, reason: parsed.reason, sessions: parsed.sessions }, source: "gemini" };
  } catch (error) {
    console.error("Gemini training plan failed, using fallback:", error instanceof Error ? error.message : error);
    return { plan: fallbackPlan(ctx), source: "fallback" };
  }
}

export function planAsText(plan: TrainingPlan, exercises: Exercise[], playerName: string): string {
  const byId = new Map(exercises.map((e) => [e.exercise_id, e]));
  const lines = plan.sessions.map((s) => {
    const name = byId.get(s.exercise_id)?.name ?? s.exercise_id;
    return `${s.day}: ${name}, ${s.duration_minutes} min, ${s.reps} reps. ${s.coaching_cue}`;
  });
  return [`${playerName}, your SPIKE plan this week focuses on ${plan.focus_skill}.`, plan.reason, "", ...lines].join("\n");
}

/** Short iMessage-length answer grounded in the player's data. */
export async function answerPlayerQuestion(ctx: PlayerContext, question: string, liveRotation: string | null): Promise<string> {
  const client = gemini();
  if (!client) {
    return "SPIKE can't answer questions yet because GEMINI_API_KEY isn't set. Text PLAN for your training plan or ROTATION for your court position.";
  }
  try {
    const response = await client.ai.models.generateContent({
      model: client.model,
      contents: JSON.stringify({ ...contextForModel(ctx), current_rotation: liveRotation, question }),
      config: {
        systemInstruction:
          "You are SPIKE, a volleyball coaching assistant replying by text message to one player. " +
          "Answer only from the player data provided and general volleyball technique. " +
          "If the data doesn't contain the answer, say so. Keep the reply under 600 characters, plain text, no markdown.",
        temperature: 0.5,
        maxOutputTokens: 300,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return response.text?.trim() || "Sorry, I couldn't come up with an answer. Try asking another way.";
  } catch (error) {
    console.error("Gemini answer failed:", error instanceof Error ? error.message : error);
    return "SPIKE's coaching assistant is unavailable right now. Text PLAN for your training plan or ROTATION for your court position.";
  }
}
