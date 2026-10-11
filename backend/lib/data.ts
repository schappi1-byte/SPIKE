import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChatMessage,
  Exercise,
  LiveRotationRow,
  ResearchMatch,
  ResearchStudy,
  RosterPlayer,
  Team,
  TeamMatch,
  TrainingPlan,
  TrainingProgress,
} from "../../lib/types";

const ROSTER_SELECT = "*, player_stats(*), skill_ratings(*), coach_feedback(*)";

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function getTeams(db: SupabaseClient): Promise<Team[]> {
  return unwrap<Team[]>(await db.from("teams").select("*").order("school"));
}

export async function getTeam(db: SupabaseClient, teamId: string): Promise<Team | null> {
  return unwrap<Team | null>(await db.from("teams").select("*").eq("team_id", teamId).maybeSingle());
}

export async function getRoster(db: SupabaseClient, teamId: string): Promise<RosterPlayer[]> {
  const roster = unwrap<RosterPlayer[]>(await db.from("players").select(ROSTER_SELECT).eq("team_id", teamId));
  const jersey = (p: RosterPlayer) => Number(p.jersey_number ?? Number.POSITIVE_INFINITY);
  return roster.sort((a, b) => jersey(a) - jersey(b) || a.name.localeCompare(b.name));
}

export async function getTeamMatches(db: SupabaseClient, teamId: string): Promise<TeamMatch[]> {
  return unwrap<TeamMatch[]>(await db.from("team_matches").select("*").eq("team_id", teamId).order("match_date"));
}

export async function getResearch(db: SupabaseClient): Promise<{ studies: ResearchStudy[]; matches: ResearchMatch[] }> {
  const [studies, matches] = await Promise.all([
    db.from("research_studies").select("*").order("year", { ascending: false }),
    db.from("research_matches").select("*").order("match_id"),
  ]);
  return { studies: unwrap<ResearchStudy[]>(studies), matches: unwrap<ResearchMatch[]>(matches) };
}

export async function getRosterPlayer(db: SupabaseClient, playerId: string): Promise<RosterPlayer | null> {
  return unwrap<RosterPlayer | null>(await db.from("players").select(ROSTER_SELECT).eq("player_id", playerId).maybeSingle());
}

export async function getExercises(db: SupabaseClient): Promise<Exercise[]> {
  return unwrap<Exercise[]>(await db.from("exercises").select("*").order("exercise_id"));
}

export async function getProgress(db: SupabaseClient, playerId: string): Promise<TrainingProgress[]> {
  return unwrap<TrainingProgress[]>(
    await db.from("training_progress").select("*").eq("player_id", playerId).order("assigned_date", { ascending: false }),
  );
}

export interface SavedPlan {
  plan_id: number;
  player_id: string;
  focus_skill: string;
  plan: TrainingPlan;
  created_at: string;
  texted_at: string | null;
}

export async function getLatestPlan(db: SupabaseClient, playerId: string): Promise<SavedPlan | null> {
  return unwrap<SavedPlan | null>(
    await db
      .from("training_plans")
      .select("*")
      .eq("player_id", playerId)
      .eq("kind", "drills")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

const MESSAGE_COLUMNS = "message_id, team_id, thread_player_id, sender_user_id, sender_name, sender_role, body, via, created_at";
const MESSAGE_PAGE = 200;

/** Messages in one chat, oldest first. `thread` null is the team chat. With `after`, only newer messages. */
export async function getMessages(db: SupabaseClient, teamId: string, thread: string | null, after = 0): Promise<ChatMessage[]> {
  let query = db.from("messages").select(MESSAGE_COLUMNS).eq("team_id", teamId);
  query = thread === null ? query.is("thread_player_id", null) : query.eq("thread_player_id", thread);
  if (after > 0) {
    return unwrap<ChatMessage[]>(await query.gt("message_id", after).order("message_id").limit(MESSAGE_PAGE));
  }
  const latest = unwrap<ChatMessage[]>(await query.order("message_id", { ascending: false }).limit(MESSAGE_PAGE));
  return latest.reverse();
}

/** Most recently updated live session for a team, or a stable default for the first push. */
export async function getLiveSession(db: SupabaseClient, teamId: string): Promise<{ sessionId: string; rows: LiveRotationRow[] }> {
  const latest = unwrap<{ session_id: string } | null>(
    await db.from("live_rotation").select("session_id").eq("team_id", teamId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  );
  const sessionId = latest?.session_id ?? `${teamId}-live`;
  const rows = unwrap<LiveRotationRow[]>(
    await db.from("live_rotation").select("*").eq("session_id", sessionId).order("court_position"),
  );
  return { sessionId, rows };
}
