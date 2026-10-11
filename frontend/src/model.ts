export const SKILL_KEYS = ["serve", "pass", "set", "attack", "block", "defense"] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export type Skills = Record<SkillKey, number>;

export const SKILL_LABEL: Record<SkillKey, string> = {
  serve: "Serving",
  pass: "Passing",
  set: "Setting",
  attack: "Attack",
  block: "Blocking",
  defense: "Defense",
};

export type Assessment = {
  id: string;
  recordedAt: string;
  skills: Skills;
  strengths: string;
  weaknesses: string;
  priorities: string;
};

export type Session = {
  id: string;
  exerciseId: string;
  title: string;
  minutes: number;
  completedAt: string;
};

export type Athlete = {
  id: number;
  name: string;
  initials: string;
  number: number;
  position: string;
  grade: string;
  attendance: number;
  color: string;
  assessments: Assessment[];
  sessions: Session[];
};

export type Formation = "4-2" | "5-1" | "6-2";

export type Lineup = {
  id: string;
  name: string;
  formation: Formation;
  rotation: number;
  slots: (number | null)[];
  savedAt: string;
};

export type LineupDraft = {
  sourceId: string | null;
  name: string;
  formation: Formation;
  rotation: number;
  slots: (number | null)[];
};

export type Exercise = {
  id: string;
  skill: SkillKey;
  title: string;
  detail: string;
  minutes: number;
  done: boolean;
};

export const FORMATIONS: Formation[] = ["4-2", "5-1", "6-2"];

const COURT_ROLES: Record<Formation, string[]> = {
  "4-2": ["Setter", "Middle", "Outside", "Outside", "Middle", "Setter"],
  "5-1": ["Outside", "Middle", "Opposite", "Outside", "Middle", "Setter"],
  "6-2": ["Setter", "Middle", "Outside", "Opposite", "Middle", "Setter"],
};

const NEXT_SLOT = [1, 2, 5, 0, 3, 4];

export const COURT_SPOTS: { index: number; number: string; row: "front" | "back"; skills: readonly SkillKey[] }[] = [
  { index: 0, number: "4", row: "front", skills: ["attack", "pass", "block"] },
  { index: 1, number: "3", row: "front", skills: ["block", "attack"] },
  { index: 2, number: "2", row: "front", skills: ["attack", "set", "block"] },
  { index: 3, number: "5", row: "back", skills: ["pass", "defense", "serve"] },
  { index: 4, number: "6", row: "back", skills: ["defense", "pass"] },
  { index: 5, number: "1", row: "back", skills: ["serve", "defense", "set"] },
];

const ROLE_SKILL: Record<string, SkillKey> = {
  Setter: "set",
  Outside: "attack",
  Opposite: "attack",
  Middle: "block",
};

const DRILLS: Record<SkillKey, { title: string; detail: string; minutes: number }> = {
  serve: { title: "Zone targets", detail: "Land 40 serves inside the assigned zone.", minutes: 12 },
  pass: { title: "Platform control", detail: "Pass 30 balls to the target cone.", minutes: 10 },
  set: { title: "Tempo sets", detail: "Deliver 24 sets to the same release point.", minutes: 10 },
  attack: { title: "High contact", detail: "Hit 20 balls with a full reach at contact.", minutes: 12 },
  block: { title: "Close the block", detail: "Finish 16 block steps before the hitter jumps.", minutes: 8 },
  defense: { title: "Read and dig", detail: "Dig 20 balls from a live or tossed attack.", minutes: 10 },
};

export function clampSkill(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function overall(skills: Skills): number {
  const total = SKILL_KEYS.reduce((sum, key) => sum + skills[key], 0);
  return Math.round(total / SKILL_KEYS.length);
}

export function latestAssessment(athlete: Athlete): Assessment {
  return athlete.assessments[athlete.assessments.length - 1];
}

export function trendDelta(athlete: Athlete): number | null {
  if (athlete.assessments.length < 2) return null;
  const current = overall(latestAssessment(athlete).skills);
  const previous = overall(athlete.assessments[athlete.assessments.length - 2].skills);
  return current - previous;
}

export function trainingPlan(athlete: Athlete): Exercise[] {
  const current = latestAssessment(athlete);
  const focus = [...SKILL_KEYS].sort((a, b) => current.skills[a] - current.skills[b] || a.localeCompare(b)).slice(0, 3);
  return focus.map((skill) => {
    const drill = DRILLS[skill];
    const id = `${skill}:${drill.title}`;
    const done = athlete.sessions.some((session) => session.exerciseId === id && session.completedAt >= current.recordedAt);
    return { id, skill, ...drill, done };
  });
}

export function adherence(athlete: Athlete): number {
  const plan = trainingPlan(athlete);
  if (plan.length === 0) return 0;
  return Math.round((plan.filter((item) => item.done).length / plan.length) * 100);
}

export function attentionReason(athlete: Athlete): string | null {
  const rating = overall(latestAssessment(athlete).skills);
  const delta = trendDelta(athlete);
  if (rating < 78) return "Rating below 78";
  if (delta !== null && delta < 0) return "Rating declined since last evaluation";
  if (adherence(athlete) < 34) return "Training not started this cycle";
  return null;
}

export function sameSkills(a: Skills, b: Skills): boolean {
  return SKILL_KEYS.every((key) => a[key] === b[key]);
}

export function addAssessment(athlete: Athlete, input: Omit<Assessment, "id" | "recordedAt">, now = new Date().toISOString()): Athlete {
  const current = latestAssessment(athlete);
  const strengths = input.strengths.trim();
  const weaknesses = input.weaknesses.trim();
  const priorities = input.priorities.trim();
  const unchanged = sameSkills(current.skills, input.skills) && current.strengths === strengths && current.weaknesses === weaknesses && current.priorities === priorities;
  if (unchanged) return athlete;
  return {
    ...athlete,
    assessments: [
      ...athlete.assessments,
      { id: `assessment-${athlete.id}-${now}`, recordedAt: now, skills: { ...input.skills }, strengths, weaknesses, priorities },
    ],
  };
}

export function markSession(athlete: Athlete, exercise: Exercise, now = new Date().toISOString()): Athlete {
  const current = latestAssessment(athlete);
  const already = athlete.sessions.some((session) => session.exerciseId === exercise.id && session.completedAt >= current.recordedAt);
  if (already) return athlete;
  return {
    ...athlete,
    sessions: [
      ...athlete.sessions,
      {
        id: `session-${athlete.id}-${now}`,
        exerciseId: exercise.id,
        title: exercise.title,
        minutes: exercise.minutes,
        completedAt: now,
      },
    ],
  };
}

export function courtRoles(formation: Formation): string[] {
  return COURT_ROLES[formation];
}

export function advanceSlots(slots: (number | null)[], steps: number): (number | null)[] {
  let current = [...slots];
  const count = ((steps % 6) + 6) % 6;
  for (let step = 0; step < count; step += 1) {
    const next: (number | null)[] = [null, null, null, null, null, null];
    current.forEach((id, index) => {
      next[NEXT_SLOT[index]] = id;
    });
    current = next;
  }
  return current;
}

export function withRotation(draft: LineupDraft, rotation: number): LineupDraft {
  const next = Math.min(6, Math.max(1, rotation));
  return { ...draft, rotation: next, slots: advanceSlots(draft.slots, next - draft.rotation) };
}

export function placeAthlete(slots: (number | null)[], slotIndex: number, athleteId: number): (number | null)[] {
  const cleared = slots.map((id) => (id === athleteId ? null : id));
  cleared[slotIndex] = athleteId;
  return cleared;
}

export function moveOnCourt(slots: (number | null)[], slotIndex: number, athleteId: number): (number | null)[] {
  const from = slots.indexOf(athleteId);
  if (from === slotIndex) return slots;
  const occupant = slots[slotIndex];
  if (from >= 0 && occupant != null) {
    const next = [...slots];
    next[from] = occupant;
    next[slotIndex] = athleteId;
    return next;
  }
  return placeAthlete(slots, slotIndex, athleteId);
}

export function spotFit(athlete: Athlete | undefined, skills: readonly SkillKey[]): number {
  if (!athlete) return 0;
  const ratings = latestAssessment(athlete).skills;
  const total = skills.reduce((sum, key) => sum + ratings[key], 0);
  return Math.round(total / skills.length);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export type RotationScore = { rotation: number; score: number; front: number; back: number; fits: number[] };

export function scoreArrangement(slots: (number | null)[], athletes: Athlete[]): { fits: number[]; current: number; front: number; back: number } {
  const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const fits = COURT_SPOTS.map((spot) => spotFit(slots[spot.index] != null ? byId.get(slots[spot.index] as number) : undefined, spot.skills));
  return { fits, current: average(fits), front: average(fits.slice(0, 3)), back: average(fits.slice(3)) };
}

export function scoreLineup(slots: (number | null)[], rotation: number, athletes: Athlete[]): { current: number; front: number; back: number; overall: number; best: RotationScore; weakest: RotationScore; rotations: RotationScore[] } {
  const rotations = [1, 2, 3, 4, 5, 6].map((next) => {
    const scored = scoreArrangement(advanceSlots(slots, next - rotation), athletes);
    return { rotation: next, score: scored.current, front: scored.front, back: scored.back, fits: scored.fits };
  });
  const current = rotations.find((item) => item.rotation === rotation) ?? rotations[0];
  const best = rotations.reduce((lead, item) => (item.score > lead.score ? item : lead));
  const weakest = rotations.reduce((lead, item) => (item.score < lead.score ? item : lead));
  return { current: current.score, front: current.front, back: current.back, overall: average(rotations.map((item) => item.score)), best, weakest, rotations };
}

export function setterSpotIndices(formation: Formation, rotation: number): number[] {
  const markers: (number | null)[] = courtRoles(formation).map((role, index) => (role === "Setter" ? index + 1 : null));
  return advanceSlots(markers, rotation - 1).flatMap((value, index) => (value != null ? [index] : []));
}

export function lineupNotes(slots: (number | null)[], formation: Formation, rotation: number, athletes: Athlete[]): string[] {
  const notes: string[] = [];
  const ids = slots.filter((id): id is number => id != null);
  if (new Set(ids).size !== ids.length) notes.push("Duplicate assignment");
  if (slots.some((id) => id == null)) notes.push("Missing player");
  if (formation === "4-2") {
    const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));
    const invalid = setterSpotIndices(formation, rotation).some((index) => {
      const athlete = slots[index] != null ? byId.get(slots[index] as number) : undefined;
      return !athlete?.position.toLowerCase().includes("setter");
    });
    if (invalid) notes.push("Invalid setter for 4-2");
  }
  const scored = scoreArrangement(slots, athletes);
  const low = COURT_SPOTS.filter((spot, index) => slots[spot.index] != null && scored.fits[index] < 70).map((spot) => spot.number);
  if (low.length) notes.push(`Low fit in position ${low.join(", ")}`);
  const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const skillAt = (indexes: number[], skill: SkillKey) => {
    const values = indexes.map((index) => (slots[index] != null ? latestAssessment(byId.get(slots[index] as number)!).skills[skill] : null));
    if (values.some((value) => value == null)) return null;
    return average(values as number[]);
  };
  const frontAttack = skillAt([0, 1, 2], "attack");
  const backDefense = skillAt([3, 4, 5], "defense");
  if (frontAttack != null && frontAttack >= 85) notes.push("Strong front row attack");
  if (backDefense != null && backDefense < 75) notes.push("Weak back row defense");
  return notes;
}

export function suggestSlots(athletes: Athlete[], formation: Formation, rotation = 1): (number | null)[] {
  const used = new Set<number>();
  const base = courtRoles(formation).map((role) => {
    const skill = ROLE_SKILL[role] ?? "defense";
    const ranked = athletes
      .filter((athlete) => !used.has(athlete.id))
      .sort((a, b) => roleScore(b, role, skill) - roleScore(a, role, skill) || a.number - b.number);
    const pick = ranked[0];
    if (!pick) return null;
    used.add(pick.id);
    return pick.id;
  });
  return advanceSlots(base, rotation - 1);
}

function roleScore(athlete: Athlete, role: string, skill: SkillKey): number {
  const rating = latestAssessment(athlete).skills[skill];
  const bonus = athlete.position.toLowerCase().includes(role.toLowerCase()) ? 10 : 0;
  return rating + bonus;
}

export function historyPoints(athlete: Athlete): { label: string; value: number; at: string }[] {
  return athlete.assessments.map((assessment) => ({
    at: assessment.recordedAt,
    label: formatWhen(assessment.recordedAt),
    value: overall(assessment.skills),
  }));
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}
