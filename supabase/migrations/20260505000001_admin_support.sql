-- Migration: Add is_banned column and player_sessions table
-- Created: 2026-05-04 | FID: FID-20260504-ADMIN

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS banned_by TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ban_reason TEXT;

CREATE TABLE IF NOT EXISTS player_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL REFERENCES players(username) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration INTERVAL,
  device_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_sessions_username ON player_sessions(username);
CREATE INDEX IF NOT EXISTS idx_player_sessions_last_active ON player_sessions(last_active);

ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage player_sessions" ON player_sessions FOR ALL USING (auth.role() = 'service_role');
