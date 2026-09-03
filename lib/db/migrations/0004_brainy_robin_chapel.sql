ALTER TABLE "players" ALTER COLUMN "created_at" SET DEFAULT '2026-09-03 20:24:22.085';--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "protection_until" timestamp;