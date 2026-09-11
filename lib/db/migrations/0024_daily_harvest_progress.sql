-- FID-20260911-045 — create the daily harvest milestone progress table.
--
-- checkDailyHarvestMilestone (lib/researchPointService.ts) has referenced this
-- table since the Mongo era, but it was never materialized in Postgres: every
-- harvest's milestone check threw "relation does not exist" and the swallow
-- catch in harvestService silently dropped it. Zero harvest_milestone RP was
-- ever awarded (confirmed against fame's rp_history).
--
-- Naming: the service's raw SQL uses UNQUOTED camelCase identifiers
-- (FROM dailyHarvestProgress, columns playerUsername …), which Postgres folds
-- to lower-case — so the physical names here are intentionally all-lowercase.
-- Key: (playerusername, date, resetperiod) matches the ON CONFLICT upsert.
CREATE TABLE IF NOT EXISTS dailyharvestprogress (
  id serial PRIMARY KEY,
  playerusername varchar(50) NOT NULL,
  date varchar(10) NOT NULL,
  resetperiod varchar(2) NOT NULL,
  harvestcount integer NOT NULL DEFAULT 0,
  milestonescompleted jsonb NOT NULL DEFAULT '[]'::jsonb,
  totalrpearned integer NOT NULL DEFAULT 0,
  lastharvestat timestamptz NOT NULL DEFAULT now(),
  createdat timestamptz NOT NULL DEFAULT now(),
  updatedat timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dailyharvestprogress_unique UNIQUE (playerusername, date, resetperiod)
);

CREATE INDEX IF NOT EXISTS dailyharvestprogress_player_date_idx
  ON dailyharvestprogress (playerusername, date);
