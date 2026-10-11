import type { ResearchMatch, TeamMatch } from "./types";

export interface MatchLine {
  hittingPercentage: number;
  killPercentage: number;
  receptionPercentage: number;
  serveInPercentage: number;
  acesPerSet: number;
  digsPerSet: number;
  blocksPerSet: number;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** Pooled team numbers across a set of matches, so long matches weigh more than sweeps. */
export function matchLine(matches: TeamMatch[]): MatchLine {
  const sum = (pick: (m: TeamMatch) => number) => matches.reduce((total, m) => total + pick(m), 0);
  const sets = sum((m) => m.sets_won + m.sets_lost);
  const attempts = sum((m) => m.attack_attempts);
  return {
    hittingPercentage: ratio(sum((m) => m.kills - m.attack_errors), attempts),
    killPercentage: ratio(sum((m) => m.kills), attempts),
    receptionPercentage: 1 - ratio(sum((m) => m.reception_errors), sum((m) => m.reception_attempts)),
    serveInPercentage: 1 - ratio(sum((m) => m.service_errors), sum((m) => m.serve_attempts)),
    acesPerSet: ratio(sum((m) => m.service_aces), sets),
    digsPerSet: ratio(sum((m) => m.digs), sets),
    blocksPerSet: ratio(sum((m) => m.block_solos + 0.5 * m.block_assists), sets),
  };
}

export function hittingPercentage(m: TeamMatch): number {
  return ratio(m.kills - m.attack_errors, m.attack_attempts);
}

export const RESEARCH_KPIS = [
  { key: "direct_attack_effectiveness_pct", label: "Attack effectiveness (%)" },
  { key: "functional_serve_effectiveness_pct", label: "Serve effectiveness (%)" },
  { key: "reception_effectiveness_pct", label: "Reception effectiveness (%)" },
  { key: "blocking_points_per_set", label: "Block points per set" },
  { key: "unforced_errors_per_set", label: "Unforced errors per set" },
] as const;

export type ResearchKpi = (typeof RESEARCH_KPIS)[number]["key"];

function kpiValue(m: ResearchMatch, key: ResearchKpi): number {
  if (key === "blocking_points_per_set") return m.blocking_points / m.total_sets;
  if (key === "unforced_errors_per_set") return m.unforced_errors / m.total_sets;
  return Number(m[key]);
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export interface ResearchSummary {
  wins: number;
  losses: number;
  kpis: { key: ResearchKpi; label: string; won: number; lost: number }[];
  attackMedian: number;
  winRateAboveMedian: number;
  winRateBelowMedian: number;
}

/** Won vs lost means in the study's national matches, the comparison its authors report. */
export function researchSummary(matches: ResearchMatch[]): ResearchSummary {
  const national = matches.filter((m) => m.competition_level === "national");
  const won = national.filter((m) => m.match_outcome === "win");
  const lost = national.filter((m) => m.match_outcome === "loss");
  const attack = national.map((m) => kpiValue(m, "direct_attack_effectiveness_pct"));
  const attackMedian = median(attack);
  const above = national.filter((m) => kpiValue(m, "direct_attack_effectiveness_pct") >= attackMedian);
  const below = national.filter((m) => kpiValue(m, "direct_attack_effectiveness_pct") < attackMedian);
  const winRate = (group: ResearchMatch[]) => ratio(group.filter((m) => m.match_outcome === "win").length, group.length);
  return {
    wins: won.length,
    losses: lost.length,
    kpis: RESEARCH_KPIS.map(({ key, label }) => ({
      key,
      label,
      won: mean(won.map((m) => kpiValue(m, key))),
      lost: mean(lost.map((m) => kpiValue(m, key))),
    })),
    attackMedian,
    winRateAboveMedian: winRate(above),
    winRateBelowMedian: winRate(below),
  };
}
