-- Drop players_sessions if it was created with wrong schema (dev environment, no data)
drop table if exists player_sessions cascade;

create table player_sessions (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  session_id text not null unique,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip_address text
);

create index idx_player_sessions_player on player_sessions(player_username, started_at desc);
create index idx_player_sessions_active on player_sessions(started_at) where ended_at is null;

alter table player_sessions enable row level security;
create policy "Anyone can read sessions" on player_sessions for select using (true);
create policy "Service role can manage sessions" on player_sessions for all using (auth.role() = 'service_role');

-- Ban enforcement
alter table players add column if not exists is_banned boolean not null default false;
create index if not exists idx_players_is_banned on players(is_banned);
