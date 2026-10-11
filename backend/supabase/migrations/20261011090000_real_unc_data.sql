-- Real UNC Chapel Hill 2026 data (goheels.com) and published research benchmarks.

alter table public.players
  add column jersey_number text,
  add column hometown text,
  add column previous_school text;

alter table public.player_stats
  add column matches_started int not null default 0 check (matches_started >= 0),
  add column set_errors int not null default 0 check (set_errors >= 0),
  add column serve_attempts int not null default 0 check (serve_attempts >= 0),
  add column reception_attempts int not null default 0 check (reception_attempts >= 0),
  add column block_errors int not null default 0 check (block_errors >= 0),
  add column ball_handling_errors int not null default 0 check (ball_handling_errors >= 0),
  add column points numeric(6, 1) not null default 0 check (points >= 0);

-- Null means too few attempts to rate the skill.
alter table public.skill_ratings
  alter column serving drop not null,
  alter column passing drop not null,
  alter column setting drop not null,
  alter column hitting drop not null,
  alter column blocking drop not null,
  alter column defense drop not null;

create table public.team_matches (
  team_id text not null references public.teams (team_id) on delete cascade,
  match_date date not null,
  opponent text not null,
  venue text not null check (venue in ('home', 'away', 'neutral')),
  is_conference boolean not null default false,
  result text not null check (result in ('win', 'loss')),
  sets_won smallint not null check (sets_won between 0 and 3),
  sets_lost smallint not null check (sets_lost between 0 and 3),
  set_scores text not null,
  kills int not null check (kills >= 0),
  attack_errors int not null check (attack_errors >= 0),
  attack_attempts int not null check (attack_attempts >= 0),
  assists int not null check (assists >= 0),
  service_aces int not null check (service_aces >= 0),
  service_errors int not null check (service_errors >= 0),
  serve_attempts int not null check (serve_attempts >= 0),
  reception_errors int not null check (reception_errors >= 0),
  reception_attempts int not null check (reception_attempts >= 0),
  digs int not null check (digs >= 0),
  block_solos int not null check (block_solos >= 0),
  block_assists int not null check (block_assists >= 0),
  points numeric(6, 1) not null check (points >= 0),
  primary key (team_id, match_date, opponent)
);

create table public.research_studies (
  study_id text primary key,
  title text not null,
  authors text not null,
  year smallint not null,
  doi text not null,
  license text not null,
  population text not null
);

create table public.research_matches (
  study_id text not null references public.research_studies (study_id) on delete cascade,
  match_id text not null,
  competition_level text not null,
  phase text not null,
  match_outcome text not null check (match_outcome in ('win', 'loss')),
  sets_won smallint not null check (sets_won >= 0),
  sets_lost smallint not null check (sets_lost >= 0),
  total_sets smallint not null check (total_sets > 0),
  functional_serve_effectiveness_pct numeric(5, 1) not null,
  reception_effectiveness_pct numeric(5, 1) not null,
  direct_attack_effectiveness_pct numeric(5, 1) not null,
  blocking_points int not null check (blocking_points >= 0),
  unforced_errors int not null check (unforced_errors >= 0),
  primary key (study_id, match_id)
);

alter table public.team_matches enable row level security;
alter table public.research_studies enable row level security;
alter table public.research_matches enable row level security;

create policy "Anyone can read team matches" on public.team_matches for select to anon, authenticated using (true);
create policy "Anyone can read research studies" on public.research_studies for select to anon, authenticated using (true);
create policy "Anyone can read research matches" on public.research_matches for select to anon, authenticated using (true);

grant select on public.team_matches, public.research_studies, public.research_matches to anon, authenticated;
grant all on public.team_matches, public.research_studies, public.research_matches to service_role;
