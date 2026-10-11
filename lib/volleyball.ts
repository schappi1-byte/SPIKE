import type { CourtPosition, Player, PlayerStats, Position, RosterPlayer, Skill, SkillRatings } from "./types";

export const COURT_POSITIONS: readonly CourtPosition[] = [1, 2, 3, 4, 5, 6];
export const FRONT_ROW: ReadonlySet<number> = new Set([2, 3, 4]);

export const COURT_LABELS: Record<CourtPosition, string> = {
  1: "Right back (serving)",
  2: "Right front",
  3: "Middle front",
  4: "Left front",
  5: "Left back",
  6: "Middle back",
};

export const POSITION_NAMES: Record<Position, string> = {
  OH: "Outside hitter",
  OPP: "Opposite",
  MB: "Middle blocker",
  S: "Setter",
  L: "Libero",
  DS: "Defensive specialist",
};

export interface DerivedStats {
  hittingPercentage: number | null;
  killsPerSet: number;
  acesPerSet: number;
  digsPerSet: number;
  blocksPerSet: number;
  totalBlocks: number;
  /** Share of serves received without an error. */
  receptionPercentage: number | null;
  /** Share of serves that weren't errors. */
  serveInPercentage: number | null;
}

export function derivedStats(stats: PlayerStats): DerivedStats {
  const perSet = (value: number) => (stats.sets_played > 0 ? value / stats.sets_played : 0);
  const totalBlocks = stats.block_solos + 0.5 * stats.block_assists;
  return {
    hittingPercentage: stats.attack_attempts > 0 ? (stats.kills - stats.attack_errors) / stats.attack_attempts : null,
    killsPerSet: perSet(stats.kills),
    acesPerSet: perSet(stats.service_aces),
    digsPerSet: perSet(stats.digs),
    blocksPerSet: perSet(totalBlocks),
    totalBlocks,
    receptionPercentage: stats.reception_attempts > 0 ? 1 - stats.reception_errors / stats.reception_attempts : null,
    serveInPercentage: stats.serve_attempts > 0 ? 1 - stats.service_errors / stats.serve_attempts : null,
  };
}

export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

export function formatHitting(value: number | null): string {
  if (value === null) return "—";
  const fixed = value.toFixed(3);
  return value >= 0 ? fixed.replace(/^0/, "") : fixed.replace(/^-0/, "-");
}

/** Main skill for each role; the training focus when no skill has enough data to rate. */
export const PRIMARY_SKILL: Record<Position, Skill> = {
  OH: "hitting",
  OPP: "hitting",
  MB: "blocking",
  S: "setting",
  L: "passing",
  DS: "passing",
};

/**
 * Lowest ratings first, ignoring skills the player's role doesn't use and skills without enough data.
 * Middles are replaced by the libero in the back row, so passing and defense don't count for them.
 * Keep in sync with IGNORED in backend/scripts/build-data.py.
 */
export function weakestSkills(player: Player, ratings: SkillRatings): Skill[] {
  const ignored: Record<Position, Skill[]> = {
    OH: ["setting"],
    OPP: ["setting"],
    MB: ["setting", "passing", "defense"],
    S: ["hitting"],
    L: ["setting", "hitting", "blocking"],
    DS: ["setting", "hitting", "blocking"],
  };
  const skip = new Set(ignored[player.position]);
  return (["serving", "passing", "setting", "hitting", "blocking", "defense"] as const)
    .filter((skill) => !skip.has(skill) && ratings[skill] !== null)
    .sort((a, b) => (ratings[a] ?? 0) - (ratings[b] ?? 0));
}

/** Hitting percentage pulled toward .200 over 40 attempts, so a 3-for-3 sub doesn't outrank a starter. */
export function attackEfficiency(stats: PlayerStats | null): number {
  const priorAttempts = 40;
  const prior = 0.2;
  if (!stats) return prior;
  return (stats.kills - stats.attack_errors + prior * priorAttempts) / (stats.attack_attempts + priorAttempts);
}

export type Lineup = Record<CourtPosition, string>;

/** After a sideout: 2 goes to 1, 1 to 6, 6 to 5, 5 to 4, 4 to 3, 3 to 2. */
export function rotate(lineup: Lineup): Lineup {
  return { 1: lineup[2], 2: lineup[3], 3: lineup[4], 4: lineup[5], 5: lineup[6], 6: lineup[1] };
}

export function rotationLineup(start: Lineup, rotationNumber: number): Lineup {
  let lineup = start;
  for (let i = 1; i < rotationNumber; i += 1) lineup = rotate(lineup);
  return lineup;
}

export interface RotationPlan {
  start: Lineup;
  setters: [string, string];
  middles: [string, string];
  pins: [string, string];
  libero: string | null;
  score: number;
}

type Rated = RosterPlayer & { skill_ratings: SkillRatings };

/** Unknown skills count as below average so a player with no data isn't picked over a proven one. */
const UNRATED = 3;
const rating = (p: Rated, skill: Skill) => p.skill_ratings[skill] ?? UNRATED;

/** Sets played / (sets played + 10): a 17-set sample counts for less than a 46-set season. */
const reliability = (p: Rated) => {
  const sets = p.player_stats?.sets_played ?? 0;
  return sets / (sets + 10);
};

/**
 * Attack efficiency gets its own term for hitters: in Sanhueza-Tapia et al. (2026) it was the only
 * indicator that separated wins from losses (odds of winning x3.8 per standard deviation).
 */
const ATTACK_WEIGHT = 30;

const roleScore = {
  setter: (p: Rated) => (rating(p, "setting") * 3 + rating(p, "serving") + rating(p, "defense")) * reliability(p),
  middle: (p: Rated) =>
    (rating(p, "blocking") * 2 + rating(p, "hitting") * 2 + rating(p, "serving") + attackEfficiency(p.player_stats) * ATTACK_WEIGHT) *
    reliability(p),
  pin: (p: Rated) =>
    (rating(p, "hitting") * 2 +
      rating(p, "passing") +
      rating(p, "blocking") +
      rating(p, "serving") +
      attackEfficiency(p.player_stats) * ATTACK_WEIGHT) *
    reliability(p),
  libero: (p: Rated) => (rating(p, "defense") * 2 + rating(p, "passing") * 2) * reliability(p),
};

function pickBest(pool: Rated[], count: number, score: (p: Rated) => number, taken: Set<string>): Rated[] {
  const picked = pool
    .filter((p) => !taken.has(p.player_id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, count);
  for (const p of picked) taken.add(p.player_id);
  return picked;
}

/**
 * 4-2 lineup: two setters opposite each other so one is always front row,
 * two middles opposite each other, two pins opposite each other, and a
 * libero who replaces whichever middle is in the back row.
 */
export function optimizeFourTwo(roster: RosterPlayer[]): RotationPlan {
  const rated = roster.filter((p): p is Rated => p.skill_ratings !== null);
  const eligible = (pos: Position) => rated.filter((p) => p.eligible_positions.includes(pos));
  const taken = new Set<string>();

  const setters = pickBest(rated.filter((p) => p.is_setter), 2, roleScore.setter, taken);
  const middles = pickBest(eligible("MB"), 2, roleScore.middle, taken);
  const [p1] = pickBest(eligible("OH"), 1, roleScore.pin, taken);
  const [p2] = pickBest(eligible("OPP"), 1, roleScore.pin, taken);
  const [libero] = pickBest(eligible("L"), 1, roleScore.libero, taken);

  const [s1, s2] = setters;
  const [m1, m2] = middles;
  const pins = [p1, p2].filter((p): p is Rated => p !== undefined);
  if (!s1 || !s2 || !m1 || !m2 || !p1 || !p2) {
    throw new Error("A 4-2 needs two setters, two middle blockers, and two outside or opposite hitters.");
  }

  // Strongest hitter and setter start in the front row.
  const start: Lineup = {
    1: p2.player_id,
    2: s1.player_id,
    3: m1.player_id,
    4: p1.player_id,
    5: s2.player_id,
    6: m2.player_id,
  };

  const score =
    setters.reduce((sum, p) => sum + roleScore.setter(p), 0) +
    middles.reduce((sum, p) => sum + roleScore.middle(p), 0) +
    pins.reduce((sum, p) => sum + roleScore.pin(p), 0) +
    (libero ? roleScore.libero(libero) : 0);

  return {
    start,
    setters: [s1.player_id, s2.player_id],
    middles: [m1.player_id, m2.player_id],
    pins: [p1.player_id, p2.player_id],
    libero: libero?.player_id ?? null,
    score,
  };
}

export interface CourtSlot {
  courtPosition: CourtPosition;
  rotationPlayerId: string;
  onCourtPlayerId: string;
  isFrontRowSetter: boolean;
}

/** Who stands where in a rotation, with the libero in for the back-row middle. */
export function courtSlots(plan: RotationPlan, rotationNumber: number): CourtSlot[] {
  const lineup = rotationLineup(plan.start, rotationNumber);
  const middles = new Set(plan.middles);
  const setters = new Set(plan.setters);
  return COURT_POSITIONS.map((pos) => {
    const id = lineup[pos];
    const front = FRONT_ROW.has(pos);
    return {
      courtPosition: pos,
      rotationPlayerId: id,
      onCourtPlayerId: !front && middles.has(id) && plan.libero ? plan.libero : id,
      isFrontRowSetter: front && setters.has(id),
    };
  });
}
