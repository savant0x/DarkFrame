-- 0039_clan_wmd_timestamptz.sql (FID-20260919-018)
--
-- The clan WMD cooldown and retaliation timestamps are read for behavior:
-- `isClanOnWMDCooldown` compares wmd_cooldown_until against now(), and
-- `hasRetaliationRights` compares expires_at against now(). Both columns were
-- `timestamp without time zone`, so every read was skewed by the process UTC
-- offset — a 24h cooldown read as 28h under America/New_York, and retaliation
-- rights expired early. Same class as FID-20260916-009 D2 (0032 protection_until).
--
-- Every value was written by node-pg / pg now() as a UTC literal in a naive
-- column, so reinterpret with AT TIME ZONE 'UTC' — no instant shifts.

ALTER TABLE "clans"
  ALTER COLUMN "wmd_cooldown_until" TYPE timestamp with time zone
  USING ("wmd_cooldown_until" AT TIME ZONE 'UTC');

ALTER TABLE "clans"
  ALTER COLUMN "last_wmd_launch" TYPE timestamp with time zone
  USING ("last_wmd_launch" AT TIME ZONE 'UTC');

ALTER TABLE "wmd_retaliation_rights"
  ALTER COLUMN "expires_at" TYPE timestamp with time zone
  USING ("expires_at" AT TIME ZONE 'UTC');

ALTER TABLE "wmd_retaliation_rights"
  ALTER COLUMN "granted_at" TYPE timestamp with time zone
  USING ("granted_at" AT TIME ZONE 'UTC');
