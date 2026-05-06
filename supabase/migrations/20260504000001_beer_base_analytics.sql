-- ============================================================================
-- DarkFrame Supabase Migration: Beer Base Analytics Tables
-- Phase: Post-initial schema
-- Created: 2026-05-03
-- ============================================================================

create table beer_base_spawn_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null,
  tier integer not null check (tier between 0 and 5),
  position_x integer not null,
  position_y integer not null,
  spawned_by text not null,
  schedule_id text
);

create table beer_base_defeat_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null,
  tier integer not null check (tier between 0 and 5),
  defeated_by text not null,
  rewards jsonb not null default '{"m": 0, "e": 0}',
  alive_seconds integer not null
);

create index idx_spawn_events_created on beer_base_spawn_events(created_at desc);
create index idx_spawn_events_tier on beer_base_spawn_events(tier);
create index idx_defeat_events_created on beer_base_defeat_events(created_at desc);
create index idx_defeat_events_tier on beer_base_defeat_events(tier);
create index idx_defeat_events_player on beer_base_defeat_events(defeated_by);

alter table beer_base_spawn_events enable row level security;
alter table beer_base_defeat_events enable row level security;

create policy "Service role can manage spawn events" on beer_base_spawn_events for all using (auth.role() = 'service_role');
create policy "Service role can manage defeat events" on beer_base_defeat_events for all using (auth.role() = 'service_role');
