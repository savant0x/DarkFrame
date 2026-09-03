ALTER TABLE "players" ALTER COLUMN "created_at" SET DEFAULT '2026-09-03 19:53:24.007';--> statement-breakpoint
ALTER TABLE "wmd_notifications" ALTER COLUMN "viewed_by" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "wmd_security_status" ALTER COLUMN "alert_level" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "wmd_security_status" ALTER COLUMN "alert_level" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "wmd_spies" ALTER COLUMN "clan_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wmd_spy_missions" ALTER COLUMN "spy_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "wmd_spy_missions" ALTER COLUMN "spy_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "wmd_spy_missions" ALTER COLUMN "target_name" SET NOT NULL;