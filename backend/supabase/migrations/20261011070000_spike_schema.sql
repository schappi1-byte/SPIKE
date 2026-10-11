-- SPIKE schema. Mirrors the CSVs in data/.
-- All keys stay on the server. Reads use the publishable key (anon role).
-- Writes use the secret key (service_role).

create table public.teams (
  team_id text primary key,
  team_name text not null,
  school text not null,
  gender text not null check (gender in ('women', 'men')),
  season int not null,
  matches int not null check (matches >= 0),
  sets int not null check (sets >= 0),
  wins int not null check (wins >= 0),
  losses int not null check (losses >= 0)
);

create table public.players (
  player_id text primary key,
  team_id text not null references public.teams (team_id) on delete cascade,
  name text not null,
  position text not null check (position in ('OH', 'OPP', 'MB', 'S', 'L', 'DS')),
  eligible_positions text[] not null,
  height_cm int not null check (height_cm > 0),
  class_year text not null,
  is_setter boolean not null default false
);
create index players_team_id_idx on public.players (team_id);

-- Phone numbers are private. No Data API grant for anon or authenticated.
create table public.player_contacts (
  player_id text primary key references public.players (player_id) on delete cascade,
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  texts_opt_in boolean not null default false,
  last_reminder_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.player_stats (
  player_id text primary key references public.players (player_id) on delete cascade,
  matches_played int not null check (matches_played >= 0),
  sets_played int not null check (sets_played >= 0),
  kills int not null check (kills >= 0),
  attack_attempts int not null check (attack_attempts >= 0),
  attack_errors int not null check (attack_errors >= 0),
  assists int not null check (assists >= 0),
  service_aces int not null check (service_aces >= 0),
  service_errors int not null check (service_errors >= 0),
  digs int not null check (digs >= 0),
  block_solos int not null check (block_solos >= 0),
  block_assists int not null check (block_assists >= 0),
  reception_errors int not null check (reception_errors >= 0)
);

create table public.skill_ratings (
  player_id text primary key references public.players (player_id) on delete cascade,
  serving smallint not null check (serving between 1 and 10),
  passing smallint not null check (passing between 1 and 10),
  setting smallint not null check (setting between 1 and 10),
  hitting smallint not null check (hitting between 1 and 10),
  blocking smallint not null check (blocking between 1 and 10),
  defense smallint not null check (defense between 1 and 10)
);

create table public.coach_feedback (
  player_id text primary key references public.players (player_id) on delete cascade,
  strengths text not null,
  weaknesses text not null,
  coach_comments text not null,
  improvement_goals text not null
);

create table public.exercises (
  exercise_id text primary key,
  name text not null,
  target_skill text not null check (target_skill in ('serving', 'passing', 'setting', 'hitting', 'blocking', 'defense')),
  difficulty text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  instructions text not null,
  duration_minutes int not null check (duration_minutes > 0),
  reps int not null check (reps > 0),
  equipment text not null,
  video_url text
);

create table public.training_progress (
  player_id text not null references public.players (player_id) on delete cascade,
  exercise_id text not null references public.exercises (exercise_id) on delete cascade,
  assigned_date date not null,
  completed boolean not null default false,
  completion_date date,
  progress_score smallint not null default 0 check (progress_score between 0 and 100),
  primary key (player_id, exercise_id, assigned_date),
  check ((completed and completion_date is not null) or (not completed and completion_date is null))
);

create table public.rotations (
  team_id text not null references public.teams (team_id) on delete cascade,
  rotation_number smallint not null check (rotation_number between 1 and 6),
  court_position smallint not null check (court_position between 1 and 6),
  player_id text not null references public.players (player_id) on delete cascade,
  player_position text not null,
  eligible_positions text[] not null,
  setter_player_id text not null references public.players (player_id) on delete cascade,
  rotation_order smallint not null check (rotation_order between 1 and 6),
  on_court_player_id text not null references public.players (player_id) on delete cascade,
  primary key (team_id, rotation_number, court_position)
);

create table public.live_rotation (
  session_id text not null,
  team_id text not null references public.teams (team_id) on delete cascade,
  rotation_number smallint not null check (rotation_number between 1 and 6),
  player_id text not null references public.players (player_id) on delete cascade,
  court_position smallint not null check (court_position between 1 and 6),
  updated_at timestamptz not null default now(),
  update_status text not null default 'synced' check (update_status in ('pending', 'synced')),
  primary key (session_id, court_position)
);

create table public.training_plans (
  plan_id bigint generated always as identity primary key,
  player_id text not null references public.players (player_id) on delete cascade,
  focus_skill text not null check (focus_skill in ('serving', 'passing', 'setting', 'hitting', 'blocking', 'defense')),
  plan jsonb not null,
  created_at timestamptz not null default now(),
  texted_at timestamptz
);
create index training_plans_player_created_idx on public.training_plans (player_id, created_at desc);

-- Row-level security on every table. Read policies only for the public tables.
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_contacts enable row level security;
alter table public.player_stats enable row level security;
alter table public.skill_ratings enable row level security;
alter table public.coach_feedback enable row level security;
alter table public.exercises enable row level security;
alter table public.training_progress enable row level security;
alter table public.rotations enable row level security;
alter table public.live_rotation enable row level security;
alter table public.training_plans enable row level security;

create policy "Anyone can read teams" on public.teams for select to anon, authenticated using (true);
create policy "Anyone can read players" on public.players for select to anon, authenticated using (true);
create policy "Anyone can read player stats" on public.player_stats for select to anon, authenticated using (true);
create policy "Anyone can read skill ratings" on public.skill_ratings for select to anon, authenticated using (true);
create policy "Anyone can read coach feedback" on public.coach_feedback for select to anon, authenticated using (true);
create policy "Anyone can read exercises" on public.exercises for select to anon, authenticated using (true);
create policy "Anyone can read training progress" on public.training_progress for select to anon, authenticated using (true);
create policy "Anyone can read rotations" on public.rotations for select to anon, authenticated using (true);
create policy "Anyone can read live rotation" on public.live_rotation for select to anon, authenticated using (true);
create policy "Anyone can read training plans" on public.training_plans for select to anon, authenticated using (true);

-- Data API grants. New tables are not exposed automatically in this project.
grant select on
  public.teams,
  public.players,
  public.player_stats,
  public.skill_ratings,
  public.coach_feedback,
  public.exercises,
  public.training_progress,
  public.rotations,
  public.live_rotation,
  public.training_plans
to anon, authenticated;

grant all on
  public.teams,
  public.players,
  public.player_contacts,
  public.player_stats,
  public.skill_ratings,
  public.coach_feedback,
  public.exercises,
  public.training_progress,
  public.rotations,
  public.live_rotation,
  public.training_plans
to service_role;

-- The messaging service subscribes to these changes to text players.
alter publication supabase_realtime add table public.live_rotation, public.training_plans;
