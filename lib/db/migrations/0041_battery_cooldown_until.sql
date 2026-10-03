-- 0041_battery_cooldown_until.sql (FID-20261002-007)
--
-- Defense battery cooldown lifecycle: add the durable shot-recovery deadline.
--
-- R13 (RED): both live interception paths parked batteries in COOLDOWN with
-- only the mutable `updated_at` audit time — no recovery deadline, no consumer.
-- The repair completer only queried `repair_completes_at` (the DISTINCT
-- paid-repair deadline), so a COOLDOWN battery could only return to IDLE via
-- a paid repair.
--
--   * cooldown_until timestamptz — nullable; NULL = not in cooldown. New shots
--     persist now + cooldown_duration milliseconds at reservation time
--     (defenseService shared conditional reservation; both live interception
--     paths + the scheduled/lazy recovery consumers read it).
--   * Partial due-recovery index on (cooldown_until) WHERE status = 'COOLDOWN'.
--   * Legacy backfill: existing COOLDOWN rows get
--     cooldown_until = updated_at + cooldown_duration, BUT only for VALIDATED
--     durations (positive integers). Ambiguous rows (missing/nonpositive
--     duration) are NOT guessed — they are counted and reported via NOTICE and
--     stay in COOLDOWN until a paid repair or operator action resolves them.
--
-- IDEMPOTENT: the column/index exist-checks skip; the backfill predicate
-- (cooldown_until IS NULL) means re-running preserves existing real deadlines
-- and never restarts a cooldown.

DO $$
DECLARE
  backfilled int := 0;
  ambiguous int := 0;
BEGIN
  -- (1) Deadline column (schema mirrors this in lib/db/schema/wmd.ts).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wmd_defense_batteries'
      AND column_name = 'cooldown_until'
  ) THEN
    ALTER TABLE wmd_defense_batteries ADD COLUMN cooldown_until timestamptz;
  END IF;

  -- (2) Due-recovery index (matches wmd_defense_cooldown_due_idx in schema).
  CREATE INDEX IF NOT EXISTS wmd_defense_cooldown_due_idx
    ON wmd_defense_batteries (cooldown_until)
    WHERE status = 'COOLDOWN';

  -- (3) Validated legacy backfill: only unambiguous due cooldowns.
  UPDATE wmd_defense_batteries
  SET cooldown_until = updated_at + make_interval(secs => cooldown_duration / 1000.0)
  WHERE status = 'COOLDOWN'
    AND cooldown_until IS NULL
    AND cooldown_duration IS NOT NULL
    AND cooldown_duration > 0;
  GET DIAGNOSTICS backfilled = ROW_COUNT;

  -- (4) Report (never guess) ambiguous legacy rows: COOLDOWN without a
  -- validated duration. A later sweep does not resurrect them; the paid
  -- repair path or an operator resolves them with evidence.
  SELECT count(*) INTO ambiguous
  FROM wmd_defense_batteries
  WHERE status = 'COOLDOWN'
    AND cooldown_until IS NULL;

  RAISE NOTICE '0041_battery_cooldown_until: % cooldown deadline(s) backfilled from updated_at + validated duration; % ambiguous COOLDOWN row(s) left untouched (reported, not guessed)', backfilled, ambiguous;
END $$;
