-- 0038_law17_ticket_removals.sql (FID-20260919-017)
--
-- The five Law-17 ticketed tables with no path to a genuine consumer (all held
-- 0 rows at removal time; full evidence in dev/LAW17-TICKET-TRIAGE-2026-09-19.md):
--
--   achievements          — read-only: no writer anywhere; the live achievement
--                           store is players.achievements (jsonb).
--   wmd_votes             — zero references repo-wide; superseded by wmd_clan_votes.
--   wmd_consequence_events— its only writer sat behind applyClanWMDConsequences,
--                           which has zero callers repo-wide.
--   wmd_resource_pools    — writer reachable (vote resolution) but no reader, no UI;
--                           the pool amount is never spent.
--   wmd_defense_grids     — writer reachable but no reader/UI; real clan defense is
--                           wmd_defense_batteries.
--
-- Idempotent (IF EXISTS) so re-runs and fresh environments are safe.

DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS wmd_votes;
DROP TABLE IF EXISTS wmd_consequence_events;
DROP TABLE IF EXISTS wmd_resource_pools;
DROP TABLE IF EXISTS wmd_defense_grids;
