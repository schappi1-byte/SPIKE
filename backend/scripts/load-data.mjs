import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.local.");
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });
const dataDir = new URL("../data/", import.meta.url);

async function readCsv(path) {
  const text = await readFile(fileURLToPath(new URL(path, dataDir)), "utf8");
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

const int = (value) => Number.parseInt(value, 10);
const intOrNull = (value) => (value === "" ? null : int(value));
const bool = (value) => value === "true";
const list = (value) => value.split("|").filter(Boolean);
const orNull = (value) => (value === "" ? null : value);
const numbers = (r, except, mapValue = int) =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, except.includes(k) ? v : mapValue(v)]));

// Parents before children so foreign keys resolve.
const tables = [
  {
    table: "teams",
    file: "unc_chapel_hill/team.csv",
    conflict: "team_id",
    map: (r) => ({ ...r, season: int(r.season), matches: int(r.matches), sets: int(r.sets), wins: int(r.wins), losses: int(r.losses) }),
  },
  {
    table: "players",
    file: "unc_chapel_hill/players.csv",
    conflict: "player_id",
    map: (r) => ({
      ...r,
      eligible_positions: list(r.eligible_positions),
      height_cm: int(r.height_cm),
      is_setter: bool(r.is_setter),
      jersey_number: orNull(r.jersey_number),
      hometown: orNull(r.hometown),
      previous_school: orNull(r.previous_school),
    }),
    // Players no longer in the CSV are deleted; their stats, plans, and contacts cascade.
    prune: { column: "team_id", key: "player_id" },
  },
  {
    table: "player_stats",
    file: "unc_chapel_hill/player_stats.csv",
    conflict: "player_id",
    map: (r) => ({ ...numbers(r, ["player_id", "points"]), points: Number(r.points) }),
  },
  {
    table: "skill_ratings",
    file: "unc_chapel_hill/skill_ratings.csv",
    conflict: "player_id",
    map: (r) => numbers(r, ["player_id"], intOrNull),
  },
  {
    table: "coach_feedback",
    file: "unc_chapel_hill/coach_feedback.csv",
    conflict: "player_id",
    map: (r) => r,
  },
  {
    table: "exercises",
    file: "exercises.csv",
    conflict: "exercise_id",
    map: (r) => ({ ...r, duration_minutes: int(r.duration_minutes), reps: int(r.reps), video_url: orNull(r.video_url) }),
  },
  {
    table: "training_progress",
    file: "unc_chapel_hill/training_progress.csv",
    conflict: "player_id,exercise_id,assigned_date",
    map: (r) => ({ ...r, completed: bool(r.completed), completion_date: orNull(r.completion_date), progress_score: int(r.progress_score) }),
  },
  {
    table: "rotations",
    file: "unc_chapel_hill/rotations.csv",
    conflict: "team_id,rotation_number,court_position",
    map: (r) => ({
      ...r,
      rotation_number: int(r.rotation_number),
      court_position: int(r.court_position),
      eligible_positions: list(r.eligible_positions),
      rotation_order: int(r.rotation_order),
    }),
  },
  {
    table: "live_rotation",
    file: "unc_chapel_hill/live_rotation.csv",
    conflict: "session_id,court_position",
    map: (r) => ({ ...r, rotation_number: int(r.rotation_number), court_position: int(r.court_position) }),
  },
  {
    table: "team_matches",
    file: "unc_chapel_hill/team_matches.csv",
    conflict: "team_id,match_date,opponent",
    map: (r) => ({
      ...numbers(r, ["team_id", "match_date", "opponent", "venue", "is_conference", "result", "set_scores", "points"]),
      is_conference: bool(r.is_conference),
      points: Number(r.points),
    }),
  },
  {
    table: "research_studies",
    file: "research/research_studies.csv",
    conflict: "study_id",
    map: (r) => ({ ...r, year: int(r.year) }),
  },
  {
    table: "research_matches",
    file: "research/research_matches.csv",
    conflict: "study_id,match_id",
    map: (r) => ({
      ...numbers(r, ["study_id", "match_id", "competition_level", "phase", "match_outcome"], Number),
    }),
  },
];

function fail(table, error) {
  console.error(`${table}: ${error.message}`);
  process.exit(1);
}

for (const { table, file, conflict, map, prune } of tables) {
  const rows = (await readCsv(file)).map(map);
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
  if (error) fail(table, error);

  let removed = 0;
  if (prune) {
    for (const scope of new Set(rows.map((r) => r[prune.column]))) {
      const keep = rows.filter((r) => r[prune.column] === scope).map((r) => r[prune.key]);
      const { data, error: pruneError } = await supabase
        .from(table)
        .delete()
        .eq(prune.column, scope)
        .not(prune.key, "in", `(${keep.join(",")})`)
        .select(prune.key);
      if (pruneError) fail(table, pruneError);
      removed += data.length;
    }
  }
  console.log(`${table}: ${rows.length} rows${removed ? `, removed ${removed} no longer in the CSV` : ""}`);
}
