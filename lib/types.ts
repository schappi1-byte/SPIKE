export type Position = "OH" | "OPP" | "MB" | "S" | "L" | "DS";
export type Skill = "serving" | "passing" | "setting" | "hitting" | "blocking" | "defense";
export type CourtPosition = 1 | 2 | 3 | 4 | 5 | 6;

export const SKILLS: readonly Skill[] = ["serving", "passing", "setting", "hitting", "blocking", "defense"];

export interface Team {
  team_id: string;
  team_name: string;
  school: string;
  gender: "women" | "men";
  season: number;
  matches: number;
  sets: number;
  wins: number;
  losses: number;
}

export interface Player {
  player_id: string;
  team_id: string;
  name: string;
  position: Position;
  eligible_positions: Position[];
  height_cm: number;
  class_year: string;
  is_setter: boolean;
}

export interface PlayerStats {
  player_id: string;
  matches_played: number;
  sets_played: number;
  kills: number;
  attack_attempts: number;
  attack_errors: number;
  assists: number;
  service_aces: number;
  service_errors: number;
  digs: number;
  block_solos: number;
  block_assists: number;
  reception_errors: number;
}

export type SkillRatings = { player_id: string } & Record<Skill, number>;

export interface CoachFeedback {
  player_id: string;
  strengths: string;
  weaknesses: string;
  coach_comments: string;
  improvement_goals: string;
}

export interface Exercise {
  exercise_id: string;
  name: string;
  target_skill: Skill;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  instructions: string;
  duration_minutes: number;
  reps: number;
  equipment: string;
  video_url: string | null;
}

export interface TrainingProgress {
  player_id: string;
  exercise_id: string;
  assigned_date: string;
  completed: boolean;
  completion_date: string | null;
  progress_score: number;
}

export interface LiveRotationRow {
  session_id: string;
  team_id: string;
  rotation_number: number;
  player_id: string;
  court_position: number;
  updated_at: string;
  update_status: "pending" | "synced";
}

export interface RosterPlayer extends Player {
  player_stats: PlayerStats | null;
  skill_ratings: SkillRatings | null;
  coach_feedback: CoachFeedback | null;
}

export interface PlanSession {
  day: string;
  exercise_id: string;
  duration_minutes: number;
  reps: number;
  coaching_cue: string;
}

export interface TrainingPlan {
  focus_skill: Skill;
  reason: string;
  sessions: PlanSession[];
}
