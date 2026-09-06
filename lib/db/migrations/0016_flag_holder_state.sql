-- Migration 0016: flag holder state (FID-20260906-001, Option A — design-doc faithful)
--
-- Implements FLAG_FEATURE_PLAN.md mechanics:
--  - Session earnings tracking (gross metal/energy gained while holding) to power
--    the escalating flee-cost economy (10%→30% of session earnings).
--  - Challenge channel state (30s steal channel, 5s bearer lock).
--  - Flee counter (max 5 flees, 6th challenge = auto-loss).
--  - Grace period (1h challenge immunity after a successful steal).
--
-- Also adds the 12-hour hold milestone payout target (permanent +2% harvest)
-- to players if the column is absent.

ALTER TABLE flags
  ADD COLUMN IF NOT EXISTS session_earnings_metal bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_earnings_energy bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flee_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_until timestamp,
  ADD COLUMN IF NOT EXISTS challenge_challenger varchar(20),
  ADD COLUMN IF NOT EXISTS challenge_started_at timestamp,
  ADD COLUMN IF NOT EXISTS challenge_ends_at timestamp,
  ADD COLUMN IF NOT EXISTS last_flee_at timestamp,
  ADD COLUMN IF NOT EXISTS flee_destination_x integer,
  ADD COLUMN IF NOT EXISTS flee_destination_y integer,
  ADD COLUMN IF NOT EXISTS milestone_12h_awarded smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spawn_x integer,
  ADD COLUMN IF NOT EXISTS spawn_y integer;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS permanent_harvest_bonus smallint NOT NULL DEFAULT 0;

-- Bearer lookup by holder username (channel/flee/earnings paths query by it)
CREATE INDEX IF NOT EXISTS idx_flags_holder ON flags (current_holder);
