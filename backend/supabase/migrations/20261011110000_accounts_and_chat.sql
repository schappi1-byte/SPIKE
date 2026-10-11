-- Logins and team chat.
-- A login is a Supabase Auth user whose email is `<username>@spike.local`. Nobody sees or types that email.
-- Players sign in with their player_id as the username; coaches with `coach-<name>`.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  team_id text not null references public.teams (team_id) on delete cascade,
  role text not null check (role in ('coach', 'player')),
  player_id text unique references public.players (player_id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  check ((role = 'player') = (player_id is not null))
);

create table public.messages (
  message_id bigint generated always as identity primary key,
  team_id text not null references public.teams (team_id) on delete cascade,
  -- Null is the team chat. Otherwise this is the private chat between that player and the coaches.
  thread_player_id text references public.players (player_id) on delete cascade,
  sender_user_id uuid references auth.users (id) on delete set null,
  sender_name text not null,
  sender_role text not null check (sender_role in ('coach', 'player')),
  body text not null check (char_length(body) between 1 and 2000),
  via text not null default 'web' check (via in ('web', 'imessage')),
  texted_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (team_id, thread_player_id, message_id);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;

create policy "Users can read their own profile" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Everyone on the team reads the team chat. Coaches read every private chat; a player reads only their own.
create policy "Team members can read their chats" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.team_id = messages.team_id
        and (messages.thread_player_id is null or p.role = 'coach' or p.player_id = messages.thread_player_id)
    )
  );

-- Users post as themselves, from the web, into a chat they can read.
create policy "Team members can post in their chats" on public.messages
  for insert to authenticated
  with check (
    sender_user_id = (select auth.uid())
    and via = 'web'
    and texted_at is null
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.team_id = messages.team_id
        and p.role = messages.sender_role
        and p.display_name = messages.sender_name
        and (messages.thread_player_id is null or p.role = 'coach' or p.player_id = messages.thread_player_id)
    )
    and (
      messages.thread_player_id is null
      or exists (select 1 from public.players pl where pl.player_id = messages.thread_player_id and pl.team_id = messages.team_id)
    )
  );

grant select on public.profiles to authenticated;
grant select, insert on public.messages to authenticated;
grant all on public.profiles, public.messages to service_role;

-- The messaging service texts players when a coach posts.
alter publication supabase_realtime add table public.messages;
