-- 0042_resource_harvest_action_deadline.sql (FID-20261002-012)
--
-- Personal-technology harvest action cadence: add the authoritative
-- resource-harvest action deadline to players.
--
-- R9 (RED): advanced-mining (+25% harvesting speed, 3,000 RP) sold with zero
-- gameplay consumers. The source-audit correction pins the timing meaning:
-- harvest is IMMEDIATE server-side; the 3000ms cadence existed only as an
-- anti-cheat observation threshold. The proposed authoritative contract (a
-- per-player next-action deadline, base 3000ms / 1.25 = 2400ms when
-- advanced-mining is owned) is implemented as proposed and recorded in the
-- catalog for operator ratification.
--
--   * next_resource_harvest_at timestamptz — nullable; NULL = no deadline
--     (no retroactive cooldown: every existing player may act immediately).
--     Written ONLY with a successful resource payout inside the 002/011
--     harvest transaction (lib/harvestService.ts). Refusals (cave/forest
--     item tiles, already-harvested) never touch it.
--   * Consumers: lib/harvestService.ts (admission + write),
--     app/api/harvest/route.ts (timing DTO to manual/auto clients),
--     lib/antiCheatDetector.ts (the SAME researched cadence for cooldown
--     detection), utils/autoFarmEngine.ts (client pacing).
--
-- IDEMPOTENT: the column exist-check skips on re-run. NO backfill — there is
-- no historical truth to reconstruct (the deadline is per-action state, not a
-- duration to derive), and back-filling would impose a retroactive cooldown
-- the FID explicitly forbids.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'players'
      AND column_name = 'next_resource_harvest_at'
  ) THEN
    ALTER TABLE players ADD COLUMN next_resource_harvest_at timestamptz;
  END IF;
END $$;

-- No index: the deadline is read on the player row already locked by the
-- harvest transaction (username PK lookup) — a dedicated index would be dead
-- weight.
