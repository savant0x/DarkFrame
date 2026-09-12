-- FID-20260912-062 (B3) — global daily RP cap: ledger table + audit column.
--
-- B3 is the safety backstop from the FID-060 income audit: awardRP() clamps
-- total BASE RP earned per player per UTC day to DAILY_RP_CAP (25,000) across
-- ALL sources (admin bypasses). This migration materializes the ledger the
-- clamp reads/writes.
--
-- Naming: the service's raw SQL uses UNQUOTED identifiers (rp_daily_totals,
-- columns playerusername, daykey, baserpedtoday, updatedat), which Postgres
-- folds to lower-case — physical names here are intentionally all-lowercase.
-- The UNIQUE constraint backs the service's ON CONFLICT upsert.
CREATE TABLE IF NOT EXISTS rp_daily_totals (
  id serial PRIMARY KEY,
  playerusername varchar(50) NOT NULL,
  daykey varchar(10) NOT NULL,
  baserpedtoday integer NOT NULL DEFAULT 0,
  updatedat timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT rp_daily_totals_unique UNIQUE (playerusername, daykey)
);

CREATE INDEX IF NOT EXISTS idx_rp_daily_totals_day ON rp_daily_totals (daykey);

-- awardRP now tags transactions that bypassed the cap (admin grants) in the
-- rptransactions audit table (created lowercase by migration 0009).
ALTER TABLE rptransactions ADD COLUMN IF NOT EXISTS bypasseddailycap integer NOT NULL DEFAULT 0;
