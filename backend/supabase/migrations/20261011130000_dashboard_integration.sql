-- Coach evaluations over time, saved lineups, and the dashboard's weekly training plans.
-- Only the server writes or reads these new tables (with the secret key, after checking the signed-in account).

create table public.evaluations (
  evaluation_id bigint generated always as identity primary key,
  player_id text not null references public.players (player_id) on delete cascade,
  recorded_at timestamptz not null default now(),
  -- 0-100 per skill: serve, pass, set, attack, block, defense.
  skills jsonb not null,
  strengths text not null default '',
  weaknesses text not null default '',
  priorities text not null default '',
  -- Skills the season stats could not rate. Only set on the stats baseline; empty once a coach evaluates.
  unrated text[] not null default '{}',
  analysis jsonb,
  analysis_at timestamptz,
  created_by uuid references auth.users (id) on delete set null
);
create index evaluations_player_recorded_idx on public.evaluations (player_id, recorded_at);

create table public.lineups (
  lineup_id bigint generated always as identity primary key,
  team_id text not null references public.teams (team_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  formation text not null check (formation in ('4-2', '5-1', '6-2')),
  rotation smallint not null check (rotation between 1 and 6),
  -- Court positions 1-6, each a player_id or null for an empty spot.
  slots text[] not null check (cardinality(slots) = 6),
  saved_at timestamptz not null default now()
);
create index lineups_team_saved_idx on public.lineups (team_id, saved_at desc);

alter table public.evaluations enable row level security;
alter table public.lineups enable row level security;

-- 'drills' plans come from /api/training-plan and are texted to players. 'week' plans come from the dashboard.
alter table public.training_plans add column kind text not null default 'drills' check (kind in ('drills', 'week'));
alter table public.training_plans add column updated_at timestamptz not null default now();
