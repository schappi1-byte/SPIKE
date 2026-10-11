import { SKILL_KEYS, type Athlete, type SkillKey, type Skills } from "./model.ts";

export type Recommendation = {
  skill: string;
  title: string;
  explanation: string;
  instructions: string;
  dosage: string;
  purpose: string;
};

export type PlayerAnalysis = {
  summary: string;
  priorities: Recommendation[];
  drills: Recommendation[];
  gym: Recommendation[];
  goals: Recommendation[];
};

export type PlayerPayload = {
  player: { name: string; position: string; grade: string; number: number };
  evaluations: {
    recordedAt: string;
    skills: Skills;
    strengths: string;
    weaknesses: string;
    priorities: string;
  }[];
};

const TEXT_KEYS = ["skill", "title", "explanation", "instructions", "dosage", "purpose"] as const;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function recommendation(value: unknown): Recommendation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const fields = TEXT_KEYS.map((key) => text(item[key], 500));
  if (fields.some((field) => field == null)) return null;
  const [skill, title, explanation, instructions, dosage, purpose] = fields as [string, string, string, string, string, string];
  return { skill, title, explanation, instructions, dosage, purpose };
}

function list(value: unknown, min: number, max: number): Recommendation[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null;
  const items = value.map(recommendation);
  if (items.some((item) => item == null)) return null;
  return items as Recommendation[];
}

export function readAnalysis(value: unknown): PlayerAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const summary = text(item.summary, 800);
  const priorities = list(item.priorities, 3, 3);
  const drills = list(item.drills, 1, 4);
  const gym = list(item.gym, 1, 4);
  const goals = list(item.goals, 1, 4);
  if (!summary || !priorities || !drills || !gym || !goals) return null;
  return { summary, priorities, drills, gym, goals };
}

function note(value: unknown): string | null {
  if (value == null || value === "") return "";
  return text(value, 1000);
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

export function parsePayload(value: unknown): PlayerPayload | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const player = body.player;
  const evaluations = body.evaluations;
  if (!player || typeof player !== "object" || !Array.isArray(evaluations) || evaluations.length < 1 || evaluations.length > 12) return null;
  const info = player as Record<string, unknown>;
  const name = text(info.name, 80);
  const position = text(info.position, 80);
  const grade = text(info.grade, 40);
  if (!name || !position || !grade || typeof info.number !== "number" || !Number.isFinite(info.number)) return null;
  const history = evaluations.map((item) => {
    if (!item || typeof item !== "object") return null;
    const entry = item as Record<string, unknown>;
    const recordedAt = text(entry.recordedAt, 40);
    const skills = skillsOf(entry.skills);
    const strengths = note(entry.strengths);
    const weaknesses = note(entry.weaknesses);
    const priorities = note(entry.priorities);
    if (!recordedAt || !skills || strengths == null || weaknesses == null || priorities == null) return null;
    return { recordedAt, skills, strengths, weaknesses, priorities };
  });
  if (history.some((item) => item == null)) return null;
  return { player: { name, position, grade, number: Math.round(info.number) }, evaluations: history as PlayerPayload["evaluations"] };
}

export function payloadFrom(athlete: Athlete): PlayerPayload {
  return {
    player: { name: athlete.name, position: athlete.position, grade: athlete.grade, number: athlete.number },
    evaluations: athlete.assessments.slice(-12).map((item) => ({
      recordedAt: item.recordedAt,
      skills: { ...item.skills },
      strengths: item.strengths,
      weaknesses: item.weaknesses,
      priorities: item.priorities,
    })),
  };
}

export type SavedAnalysis = { athleteId: number; sourceRecordedAt: string; generatedAt: string; analysis: PlayerAnalysis };

/** Asks the server to analyze the athlete's saved evaluations. The server saves the result. */
export async function requestAnalysis(athlete: Athlete): Promise<SavedAnalysis> {
  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: athlete.playerId }),
    });
  } catch {
    throw new Error("The analysis request did not reach the server. Try again.");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Gemini could not complete the analysis.";
    throw new Error(message);
  }
  const saved = body && typeof body === "object" && "analysis" in body && body.analysis && typeof body.analysis === "object" ? (body.analysis as Record<string, unknown>) : null;
  const analysis = saved ? readAnalysis(saved.analysis) : null;
  if (!saved || !analysis || typeof saved.sourceRecordedAt !== "string" || typeof saved.generatedAt !== "string") {
    throw new Error("Gemini returned an incomplete analysis. Try again.");
  }
  return { athleteId: athlete.id, sourceRecordedAt: saved.sourceRecordedAt, generatedAt: saved.generatedAt, analysis };
}

export function skillDelta(current: Skills, previous: Skills | null, key: SkillKey): number | null {
  return previous ? current[key] - previous[key] : null;
}
