-- Session/activity analytics: Mongo-parity columns (lib/sessionTracker, lib/activityLogger).
-- Nullable everywhere so legacy auth-token rows stay valid. Idempotent (safe to re-apply).
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "session_id" varchar(64);
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "start_time" timestamp;
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "end_time" timestamp;
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "duration" integer;
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "actions_count" integer DEFAULT 0;
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "resources_gained_metal" integer DEFAULT 0;
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "resources_gained_energy" integer DEFAULT 0;
ALTER TABLE "player_sessions" ADD COLUMN IF NOT EXISTS "ip_address" varchar(64);
CREATE INDEX IF NOT EXISTS "player_sessions_session_id_idx" ON "player_sessions" ("session_id");
ALTER TABLE "player_activity" ADD COLUMN IF NOT EXISTS "session_id" varchar(64);
ALTER TABLE "player_activity" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
