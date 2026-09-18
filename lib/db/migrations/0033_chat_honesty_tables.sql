-- 0033_chat_honesty_tables.sql (FID-20260917-012 backfill)
--
-- FID-20260917-012 defined chat_reports + blocked_users in lib/db/schema/moderation.ts
-- but shipped no migration; the live verification probe (session 057) caught
-- `relation "blocked_users" does not exist` against the dev DB, meaning every
-- /api/chat/report and /api/chat/block call 500s in the running game.
--
-- Idempotent (IF NOT EXISTS) and mirrors the drizzle definitions exactly.

CREATE TABLE IF NOT EXISTS "chat_reports" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"message_id" varchar(64) NOT NULL,
	"channel_id" varchar(40) NOT NULL,
	"reporter_id" varchar(20) NOT NULL,
	"reported_user_id" varchar(20) NOT NULL,
	"reason" varchar(40) NOT NULL,
	"details" text,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"resolved_by" varchar(20),
	"resolved_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_reports_status_idx" ON "chat_reports" ("status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_reports_reported_idx" ON "chat_reports" ("reported_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "blocked_users" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"blocker_id" varchar(20) NOT NULL,
	"blocked_id" varchar(20) NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "blocked_pair_unique" UNIQUE("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocked_users_blocker_idx" ON "blocked_users" ("blocker_id");
