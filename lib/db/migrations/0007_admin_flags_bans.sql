-- Player flags: reshape to the anti-cheat domain shape written by lib/antiCheatDetector
-- (flagType/severity/username-keyed). The pivot's playerId/flag columns had no matching
-- writer (detector inserts crashed on player_id NOT NULL; clear-flags deleted zero rows).
-- Table was empty (verified) — additive reshape, no data migration needed. Idempotent.
-- Legacy columns playerId/flag become nullable: the detector's domain insert doesn't
-- supply them and no reader consumes them.
ALTER TABLE "player_flags" ADD COLUMN IF NOT EXISTS "username" varchar(20);
ALTER TABLE "player_flags" ADD COLUMN IF NOT EXISTS "flag_type" varchar(50);
ALTER TABLE "player_flags" ADD COLUMN IF NOT EXISTS "severity" varchar(10) DEFAULT 'LOW';
ALTER TABLE "player_flags" ADD COLUMN IF NOT EXISTS "evidence" text;
ALTER TABLE "player_flags" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
ALTER TABLE "player_flags" ADD COLUMN IF NOT EXISTS "resolved" smallint DEFAULT 0;
ALTER TABLE "player_flags" ADD COLUMN IF NOT EXISTS "occurrence_count" integer DEFAULT 1;
ALTER TABLE "player_flags" ALTER COLUMN "player_id" DROP NOT NULL;
ALTER TABLE "player_flags" ALTER COLUMN "flag" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "player_flags_username_idx" ON "player_flags" ("username");
CREATE INDEX IF NOT EXISTS "player_flags_resolved_idx" ON "player_flags" ("resolved");
-- Backfill username from legacy playerId rows (empty table today; belt-and-suspenders).
UPDATE "player_flags" SET "username" = "player_id" WHERE "username" IS NULL;

-- Account bans: the admin ban flow needs username-keyed domain columns. The `bans` table
-- is SHARED with lib/moderationService channel bans (playerId + moderatorId = channelId);
-- those columns stay untouched. Account-ban columns are additive and distinguishable by
-- scope: channel rows have moderatorId set and bannedBy NULL.
ALTER TABLE "bans" ADD COLUMN IF NOT EXISTS "username" varchar(20);
ALTER TABLE "bans" ADD COLUMN IF NOT EXISTS "banned_by" varchar(20);
ALTER TABLE "bans" ADD COLUMN IF NOT EXISTS "banned_at" timestamp;
ALTER TABLE "bans" ADD COLUMN IF NOT EXISTS "is_permanent" smallint DEFAULT 0;
ALTER TABLE "bans" ADD COLUMN IF NOT EXISTS "active" smallint DEFAULT 0;
CREATE INDEX IF NOT EXISTS "bans_username_active_idx" ON "bans" ("username", "active");

-- Player account-ban gate columns (additive; login reads them, admin ban route writes them).
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "banned" smallint DEFAULT 0;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "ban_reason" text;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "banned_at" timestamp;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "banned_by" varchar(20);
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "ban_expires_at" timestamp;
