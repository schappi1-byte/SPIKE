// Writes rotations.csv and live_rotation.csv from the 4-2 optimizer, using the CSVs that build-data.py produced.
// Usage: node backend/scripts/build-rotations.mts
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { COURT_POSITIONS, courtSlots, optimizeFourTwo, rotationLineup } from "../../lib/volleyball.ts";
import type { Player, PlayerStats, RosterPlayer, SkillRatings } from "../../lib/types.ts";

const dir = new URL("../data/unc_chapel_hill/", import.meta.url);
const read = (file: string): Record<string, string>[] => parse(readFileSync(new URL(file, dir)), { columns: true, skip_empty_lines: true });
const numberOrNull = (value: string | undefined) => (value === undefined || value === "" ? null : Number(value));

const ratings = new Map(read("skill_ratings.csv").map((r) => [r.player_id, r]));
const stats = new Map(read("player_stats.csv").map((r) => [r.player_id, r]));

const roster: RosterPlayer[] = read("players.csv").map((p) => {
  const r = ratings.get(p.player_id);
  const s = stats.get(p.player_id);
  return {
    ...(p as unknown as Player),
    eligible_positions: (p.eligible_positions ?? "").split("|") as Player["eligible_positions"],
    height_cm: Number(p.height_cm),
    is_setter: p.is_setter === "true",
    skill_ratings: r
      ? ({
          player_id: p.player_id,
          serving: numberOrNull(r.serving),
          passing: numberOrNull(r.passing),
          setting: numberOrNull(r.setting),
          hitting: numberOrNull(r.hitting),
          blocking: numberOrNull(r.blocking),
          defense: numberOrNull(r.defense),
        } as SkillRatings)
      : null,
    player_stats: s
      ? (Object.fromEntries(Object.entries(s).map(([k, v]) => [k, k === "player_id" ? v : Number(v)])) as unknown as PlayerStats)
      : null,
    coach_feedback: null,
  };
});

const byId = new Map(roster.map((p) => [p.player_id, p]));
const plan = optimizeFourTwo(roster);
const teamId = roster[0]?.team_id ?? "";
const startOrder = new Map(COURT_POSITIONS.map((pos) => [plan.start[pos], pos]));

const csv = (rows: Record<string, string | number>[]) =>
  [Object.keys(rows[0] ?? {}).join(","), ...rows.map((r) => Object.values(r).join(","))].join("\n") + "\n";

const rotations = [1, 2, 3, 4, 5, 6].flatMap((n) => {
  const slots = courtSlots(plan, n);
  const setter = slots.find((s) => s.isFrontRowSetter)?.rotationPlayerId ?? plan.setters[0];
  return slots.map((slot) => {
    const player = byId.get(slot.rotationPlayerId);
    return {
      team_id: teamId,
      rotation_number: n,
      court_position: slot.courtPosition,
      player_id: slot.rotationPlayerId,
      player_position: player?.position ?? "",
      eligible_positions: player?.eligible_positions.join("|") ?? "",
      setter_player_id: setter,
      rotation_order: startOrder.get(slot.rotationPlayerId) ?? 0,
      on_court_player_id: slot.onCourtPlayerId,
    };
  });
});

const live = courtSlots(plan, 1).map((slot) => ({
  session_id: "session-unc-2026-10-10",
  team_id: teamId,
  rotation_number: 1,
  player_id: slot.onCourtPlayerId,
  court_position: slot.courtPosition,
  updated_at: "2026-10-10T19:12:00-04:00",
  update_status: "synced",
}));

writeFileSync(new URL("rotations.csv", dir), csv(rotations));
writeFileSync(new URL("live_rotation.csv", dir), csv(live));

const name = (id: string | null) => (id ? byId.get(id)?.name ?? id : "none");
console.log(`Setters: ${plan.setters.map(name).join(", ")}`);
console.log(`Middles: ${plan.middles.map(name).join(", ")}`);
console.log(`Pins: ${plan.pins.map(name).join(", ")}`);
console.log(`Libero: ${name(plan.libero)}`);
console.log(`Rotation 1: ${COURT_POSITIONS.map((pos) => `${pos}=${name(rotationLineup(plan.start, 1)[pos])}`).join(", ")}`);
console.log(`rotations.csv: ${rotations.length} rows, live_rotation.csv: ${live.length} rows`);
