-- FID-20260504-FLAG: Flag session earnings + challenge tracking
-- Adds columns to players table + flags table extensions
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_session_metal NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_session_energy NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_session_started_at TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_flee_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_flee_paid_metal NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_flee_paid_energy NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_grace_until TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_permanent_harvest_bonus NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_times_held INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_total_time_held BIGINT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_challenge_cooldown_until TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_flee_cooldown_until TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS flag_cannot_claim_until TIMESTAMPTZ;

-- Flags table: add session tracking + challenge state
ALTER TABLE flags ADD COLUMN IF NOT EXISTS flee_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS session_metal_earned NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS session_energy_earned NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS max_hold_expires_at TIMESTAMPTZ;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS respawn_at TIMESTAMPTZ;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS challenge_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS challenge_challenger_id TEXT;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS challenge_started_at TIMESTAMPTZ;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS challenge_expires_at TIMESTAMPTZ;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS challenge_lock_expires_at TIMESTAMPTZ;

-- Flag trail table for particle trails
CREATE TABLE IF NOT EXISTS flag_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_username TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flag_trails_expires ON flag_trails(expires_at);
CREATE INDEX IF NOT EXISTS idx_flag_trails_xy ON flag_trails(x, y);
ALTER TABLE flag_trails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read flag trails" ON flag_trails FOR SELECT USING (true);
CREATE POLICY "Service role can manage flag trails" ON flag_trails FOR ALL USING (auth.role() = 'service_role');
