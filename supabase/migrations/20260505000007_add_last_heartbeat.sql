-- Migration: Add last_heartbeat column to player_sessions for online presence tracking
-- FID: FID-20260505-CHAT-PERSISTENCE-ONLINE-USERS | 2026-05-05
--
-- OVERVIEW:
-- Adds a dedicated last_heartbeat column to separate "session start time" from
-- "last activity time". The started_at column will now only be set on session
-- creation, while last_heartbeat tracks the most recent heartbeat. This allows
-- the online/route.ts to query for recently-active sessions without conflating
-- session age with activity recency.

ALTER TABLE player_sessions ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_player_sessions_heartbeat ON player_sessions(last_heartbeat) WHERE ended_at IS NULL;
