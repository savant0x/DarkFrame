CREATE TABLE "admin_dashboard_notifications" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"alert_id" varchar(50),
	"type" varchar(30) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" varchar(500) NOT NULL,
	"data" jsonb,
	"read" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clan_relations" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"clan_id1" varchar(24) NOT NULL,
	"clan_id2" varchar(24) NOT NULL,
	"relation" varchar(20) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"last_updated" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"to" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"alert_id" varchar(50),
	"status" varchar(20) NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_notifications" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"type" varchar(30) NOT NULL,
	"alert_id" varchar(50),
	"title" varchar(200) NOT NULL,
	"message" varchar(500) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"read" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_alerts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"type" varchar(30) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" varchar(500) NOT NULL,
	"player_id" varchar(20),
	"player_name" varchar(50),
	"clan_id" varchar(24),
	"clan_name" varchar(50),
	"target_clan_id" varchar(24),
	"target_clan_name" varchar(50),
	"missile_id" varchar(50),
	"vote_id" varchar(50),
	"operation_id" varchar(50),
	"data" jsonb,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery_status" jsonb DEFAULT '{}'::jsonb,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar(20),
	"resolved_at" timestamp,
	"resolved_by" varchar(20),
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_consequence_events" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"event_id" varchar(50) NOT NULL,
	"launcher_clan_id" varchar(24) NOT NULL,
	"target_clan_id" varchar(24) NOT NULL,
	"warhead_type" varchar(20) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"reputation_loss" integer DEFAULT 0 NOT NULL,
	"cooldown_days" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_counter_intel_operations" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"operation_id" varchar(50) NOT NULL,
	"operator_id" varchar(20) NOT NULL,
	"target_area" varchar(30) NOT NULL,
	"spies_detected" integer DEFAULT 0 NOT NULL,
	"detected_spies" jsonb DEFAULT '[]'::jsonb,
	"executed_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_defense_grids" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"grid_id" varchar(50) NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"is_active" smallint DEFAULT 0 NOT NULL,
	"activated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_intelligence_reports" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"report_id" varchar(50) NOT NULL,
	"classification" varchar(20) NOT NULL,
	"gathered_by" varchar(50) NOT NULL,
	"gathered_from" varchar(50) NOT NULL,
	"gathered_at" timestamp NOT NULL,
	"mission_id" varchar(50) NOT NULL,
	"target_id" varchar(20) NOT NULL,
	"target_username" varchar(50) NOT NULL,
	"target_level" integer DEFAULT 0 NOT NULL,
	"target_power" integer DEFAULT 0 NOT NULL,
	"target_clan_id" varchar(24),
	"target_clan_name" varchar(50),
	"wmd_capabilities" jsonb,
	"vulnerabilities" jsonb DEFAULT '[]'::jsonb,
	"threats" jsonb DEFAULT '[]'::jsonb,
	"recommendations" jsonb DEFAULT '[]'::jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_interceptions" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"interception_id" varchar(50) NOT NULL,
	"missile_id" varchar(50) NOT NULL,
	"defender_id" varchar(20) NOT NULL,
	"battery_id" varchar(50) NOT NULL,
	"result" varchar(20) NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_launch_authorizations" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"auth_id" varchar(50) NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"warhead_type" varchar(20),
	"target_id" varchar(20),
	"granted_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_resource_pools" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"pool_id" varchar(50) NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"resource_amount" integer DEFAULT 0 NOT NULL,
	"contributors_allowed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_retaliation_rights" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"player_clan_id" varchar(24) NOT NULL,
	"can_retaliate_against_clan" varchar(24) NOT NULL,
	"granted_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_sabotage_operations" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"sabotage_id" varchar(50) NOT NULL,
	"spy_id" varchar(50) NOT NULL,
	"spy_codename" varchar(50),
	"operator_id" varchar(20) NOT NULL,
	"operator_username" varchar(50) NOT NULL,
	"target_type" varchar(30) NOT NULL,
	"target_id" varchar(50) NOT NULL,
	"target_player_id" varchar(20) NOT NULL,
	"target_username" varchar(50),
	"success" smallint DEFAULT 0 NOT NULL,
	"detected" smallint DEFAULT 0 NOT NULL,
	"damage_dealt" jsonb,
	"executed_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_security_status" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"alert_level" varchar(10) DEFAULT '0' NOT NULL,
	"last_incident" timestamp,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_spies" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"spy_id" varchar(50) NOT NULL,
	"owner_id" varchar(20) NOT NULL,
	"owner_username" varchar(50) NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"codename" varchar(50) NOT NULL,
	"rank" varchar(20) NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"specialization" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"current_mission_id" varchar(50),
	"mission_history" jsonb DEFAULT '[]'::jsonb,
	"skills_stealth" smallint DEFAULT 0 NOT NULL,
	"skills_hacking" smallint DEFAULT 0 NOT NULL,
	"skills_sabotage" smallint DEFAULT 0 NOT NULL,
	"skills_intelligence" smallint DEFAULT 0 NOT NULL,
	"last_mission_at" timestamp,
	"recruited_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "created_at" SET DEFAULT '2026-09-03 18:08:59.035';--> statement-breakpoint
CREATE INDEX "admin_dash_notif_read_idx" ON "admin_dashboard_notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "admin_dash_notif_created_idx" ON "admin_dashboard_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clan_relations_pair_unique" ON "clan_relations" USING btree ("clan_id1","clan_id2");--> statement-breakpoint
CREATE INDEX "clan_relations_clan1_idx" ON "clan_relations" USING btree ("clan_id1");--> statement-breakpoint
CREATE INDEX "clan_relations_clan2_idx" ON "clan_relations" USING btree ("clan_id2");--> statement-breakpoint
CREATE INDEX "email_queue_status_idx" ON "email_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_queue_created_idx" ON "email_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "player_notifications_player_idx" ON "player_notifications" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "player_notifications_read_idx" ON "player_notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "player_notifications_created_idx" ON "player_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wmd_alerts_status_idx" ON "wmd_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wmd_alerts_severity_idx" ON "wmd_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "wmd_alerts_type_idx" ON "wmd_alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "wmd_alerts_clan_idx" ON "wmd_alerts" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "wmd_alerts_created_idx" ON "wmd_alerts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_consequence_event_id_unique" ON "wmd_consequence_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "wmd_consequence_launcher_idx" ON "wmd_consequence_events" USING btree ("launcher_clan_id");--> statement-breakpoint
CREATE INDEX "wmd_consequence_target_idx" ON "wmd_consequence_events" USING btree ("target_clan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_counter_intel_op_id_unique" ON "wmd_counter_intel_operations" USING btree ("operation_id");--> statement-breakpoint
CREATE INDEX "wmd_counter_intel_operator_idx" ON "wmd_counter_intel_operations" USING btree ("operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_defense_grid_grid_id_unique" ON "wmd_defense_grids" USING btree ("grid_id");--> statement-breakpoint
CREATE INDEX "wmd_defense_grid_clan_idx" ON "wmd_defense_grids" USING btree ("clan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_intel_report_id_unique" ON "wmd_intelligence_reports" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "wmd_intel_mission_idx" ON "wmd_intelligence_reports" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "wmd_intel_target_idx" ON "wmd_intelligence_reports" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_interceptions_interception_id_unique" ON "wmd_interceptions" USING btree ("interception_id");--> statement-breakpoint
CREATE INDEX "wmd_interceptions_missile_idx" ON "wmd_interceptions" USING btree ("missile_id");--> statement-breakpoint
CREATE INDEX "wmd_interceptions_defender_idx" ON "wmd_interceptions" USING btree ("defender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_launch_auth_auth_id_unique" ON "wmd_launch_authorizations" USING btree ("auth_id");--> statement-breakpoint
CREATE INDEX "wmd_launch_auth_player_idx" ON "wmd_launch_authorizations" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "wmd_launch_auth_expires_idx" ON "wmd_launch_authorizations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_resource_pool_pool_id_unique" ON "wmd_resource_pools" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "wmd_resource_pool_clan_idx" ON "wmd_resource_pools" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "wmd_retaliation_player_idx" ON "wmd_retaliation_rights" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "wmd_retaliation_target_idx" ON "wmd_retaliation_rights" USING btree ("can_retaliate_against_clan");--> statement-breakpoint
CREATE INDEX "wmd_retaliation_expires_idx" ON "wmd_retaliation_rights" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_sabotage_sabotage_id_unique" ON "wmd_sabotage_operations" USING btree ("sabotage_id");--> statement-breakpoint
CREATE INDEX "wmd_sabotage_target_player_idx" ON "wmd_sabotage_operations" USING btree ("target_player_id");--> statement-breakpoint
CREATE INDEX "wmd_sabotage_executed_idx" ON "wmd_sabotage_operations" USING btree ("executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_security_player_unique" ON "wmd_security_status" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_spies_spy_id_unique" ON "wmd_spies" USING btree ("spy_id");--> statement-breakpoint
CREATE INDEX "wmd_spies_owner_idx" ON "wmd_spies" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "wmd_spies_status_idx" ON "wmd_spies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wmd_spies_clan_idx" ON "wmd_spies" USING btree ("clan_id");