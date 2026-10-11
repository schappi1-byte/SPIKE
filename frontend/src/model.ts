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
  /** Skills with no rating in the data. Their stored value is a placeholder and is left out of every score. */
  unrated?: SkillKey[];
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
  playerId?: string;
  /** Skills the season stats could not rate, until a coach saves an evaluation. */
  unrated?: SkillKey[];
  /** Exercises the coaching staff assigned (training_progress). */
  assignments?: Exercise[];
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

export function clampSkill(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isRated(assessment: Pick<Assessment, "unrated">, key: SkillKey): boolean {
  return !assessment.unrated?.includes(key);
}

/** Mean of the rated skills, or null when none are rated. */
export function rating(assessment: Pick<Assessment, "skills" | "unrated">): number | null {
  const keys = SKILL_KEYS.filter((key) => isRated(assessment, key));
  if (keys.length === 0) return null;
  return Math.round(keys.reduce((sum, key) => sum + assessment.skills[key], 0) / keys.length);
}

export function latestAssessment(athlete: Athlete): Assessment {
  return athlete.assessments[athlete.assessments.length - 1]!;
}

export function trendDelta(athlete: Athlete): number | null {
  if (athlete.assessments.length < 2) return null;
  const current = rating(latestAssessment(athlete));
  const previous = rating(athlete.assessments[athlete.assessments.length - 2]!);
  return current == null || previous == null ? null : current - previous;
}

export function trainingPlan(athlete: Athlete): Exercise[] {
  return athlete.assignments ?? [];
}

/** Share of assigned exercises completed, or null when nothing is assigned. */
export function adherence(athlete: Athlete): number | null {
  const plan = trainingPlan(athlete);
  if (plan.length === 0) return null;
  return Math.round((plan.filter((item) => item.done).length / plan.length) * 100);
}

export function attentionReason(athlete: Athlete): string | null {
  const value = rating(latestAssessment(athlete));
  const delta = trendDelta(athlete);
  const progress = adherence(athlete);
  if (value == null) return "No ratings yet";
  if (value < 78) return "Rating below 78";
  if (delta !== null && delta < 0) return "Rating declined since last evaluation";
  if (progress !== null && progress < 34) return "Assigned training not started";
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

export function courtRoles(formation: Formation): string[] {
  return COURT_ROLES[formation];
}

export function advanceSlots(slots: (number | null)[], steps: number): (number | null)[] {
  let current = [...slots];
  const count = ((steps % 6) + 6) % 6;
  for (let step = 0; step < count; step += 1) {
    const next: (number | null)[] = [null, null, null, null, null, null];
    current.forEach((id, index) => {
      next[NEXT_SLOT[index] ?? index] = id;
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

/** Mean of the spot's skills the athlete has ratings for; an empty spot is 0, an athlete with none rated is null. */
export function spotFit(athlete: Athlete | undefined, skills: readonly SkillKey[]): number | null {
  if (!athlete) return 0;
  const latest = latestAssessment(athlete);
  const rated = skills.filter((key) => isRated(latest, key));
  if (rated.length === 0) return null;
  return Math.round(rated.reduce((sum, key) => sum + latest.skills[key], 0) / rated.length);
}

function average(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value != null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
}

export type RotationScore = { rotation: number; score: number | null; front: number | null; back: number | null; fits: (number | null)[] };

export function scoreArrangement(slots: (number | null)[], athletes: Athlete[]): { fits: (number | null)[]; current: number | null; front: number | null; back: number | null } {
  const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const fits = COURT_SPOTS.map((spot) => spotFit(slots[spot.index] != null ? byId.get(slots[spot.index] as number) : undefined, spot.skills));
  return { fits, current: average(fits), front: average(fits.slice(0, 3)), back: average(fits.slice(3)) };
}

export function scoreLineup(slots: (number | null)[], rotation: number, athletes: Athlete[]): { current: number | null; front: number | null; back: number | null; overall: number | null; best: RotationScore; weakest: RotationScore; rotations: RotationScore[] } {
  const rotations = [1, 2, 3, 4, 5, 6].map((next) => {
    const scored = scoreArrangement(advanceSlots(slots, next - rotation), athletes);
    return { rotation: next, score: scored.current, front: scored.front, back: scored.back, fits: scored.fits };
  });
  const current = rotations.find((item) => item.rotation === rotation) ?? rotations[0]!;
  const best = rotations.reduce((lead, item) => ((item.score ?? -1) > (lead.score ?? -1) ? item : lead));
  const weakest = rotations.reduce((lead, item) => ((item.score ?? 101) < (lead.score ?? 101) ? item : lead));
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
  const low = COURT_SPOTS.filter((spot, index) => slots[spot.index] != null && (scored.fits[index] ?? 100) < 70).map((spot) => spot.number);
  if (low.length) notes.push(`Low fit in position ${low.join(", ")}`);
  const byId = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const skillAt = (indexes: number[], skill: SkillKey) => {
    const values = indexes.map((index) => {
      const athlete = slots[index] != null ? byId.get(slots[index] as number) : undefined;
      const latest = athlete ? latestAssessment(athlete) : null;
      return latest && isRated(latest, skill) ? latest.skills[skill] : null;
    });
    if (values.some((value) => value == null)) return null;
    return average(values);
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
  const latest = latestAssessment(athlete);
  const value = isRated(latest, skill) ? latest.skills[skill] : 0;
  const bonus = athlete.position.toLowerCase().includes(role.toLowerCase()) ? 10 : 0;
  return value + bonus;
}

export function historyPoints(athlete: Athlete): { label: string; value: number; at: string }[] {
  return athlete.assessments.flatMap((assessment) => {
    const value = rating(assessment);
    return value == null ? [] : [{ at: assessment.recordedAt, label: formatWhen(assessment.recordedAt), value }];
  });
}

/** Timestamps from the database and the browser can differ in format for the same moment. */
export function sameTime(a: string, b: string): boolean {
  return a === b || new Date(a).getTime() === new Date(b).getTime();
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
