-- Migration 0020: exact factory investment tracking (FID-20260909-032 §7)
--
-- invested_metal / invested_energy record the LIFETIME resources spent on a
-- factory — upgrades (sum of paid level costs) plus unit production (unit
-- config price × quantity at build time). Maintained at write time by
-- app/api/factory/build-unit and app/api/factory/upgrade via SQL deltas;
-- a one-shot backfill (scripts/backfill-factory-investment.ts) seeds existing
-- rows from the same math the pre-column reconstruction used (upgrade-path
-- cumulative cost + surviving-units provenance pricing), i.e. a lower bound
-- that becomes exact from the moment the columns go live.
--
-- Idempotent (repo convention since 0017): ADD COLUMN IF NOT EXISTS.
-- Abandon/release reset the factory to neutral and zero the invested columns —
-- the factory itself forgets its spend when it forgets its owner.

ALTER TABLE factories ADD COLUMN IF NOT EXISTS invested_metal integer NOT NULL DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS invested_energy integer NOT NULL DEFAULT 0;
