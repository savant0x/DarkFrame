CREATE TABLE "achievements" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"achievement_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(30) NOT NULL,
	"rarity" varchar(20) NOT NULL,
	"unlocked_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"seller_id" varchar(20) NOT NULL,
	"item_data" jsonb NOT NULL,
	"starting_price" integer NOT NULL,
	"current_bid" integer,
	"current_bidder" varchar(20),
	"buyout_price" integer,
	"expires_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bans" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"moderator_id" varchar(20) NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_logs" (
	"battle_id" varchar(50) PRIMARY KEY NOT NULL,
	"battle_type" varchar(20) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"attacker_username" varchar(20) NOT NULL,
	"attacker_units" jsonb NOT NULL,
	"attacker_total_str" integer NOT NULL,
	"attacker_total_def" integer NOT NULL,
	"attacker_initial_hp" integer NOT NULL,
	"attacker_final_hp" integer NOT NULL,
	"attacker_units_lost" integer NOT NULL,
	"attacker_units_captured" integer NOT NULL,
	"attacker_starting_hp" integer NOT NULL,
	"attacker_ending_hp" integer NOT NULL,
	"attacker_damage_dealt" integer NOT NULL,
	"attacker_xp_earned" integer NOT NULL,
	"defender_username" varchar(20) NOT NULL,
	"defender_units" jsonb NOT NULL,
	"defender_total_str" integer NOT NULL,
	"defender_total_def" integer NOT NULL,
	"defender_initial_hp" integer NOT NULL,
	"defender_final_hp" integer NOT NULL,
	"defender_units_lost" integer NOT NULL,
	"defender_units_captured" integer NOT NULL,
	"defender_starting_hp" integer NOT NULL,
	"defender_ending_hp" integer NOT NULL,
	"defender_damage_dealt" integer NOT NULL,
	"defender_xp_earned" integer NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"rounds" jsonb NOT NULL,
	"total_rounds" integer NOT NULL,
	"units_captured_attacker_captured" jsonb,
	"units_captured_defender_captured" jsonb,
	"attacker_xp" integer NOT NULL,
	"defender_xp" integer NOT NULL,
	"resources_stolen_resource_type" varchar(20),
	"resources_stolen_amount" integer,
	"location_x" smallint,
	"location_y" smallint
);
--> statement-breakpoint
CREATE TABLE "beer_base_defeat_events" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"t" timestamp NOT NULL,
	"tier" integer NOT NULL,
	"by" varchar(50) NOT NULL,
	"rewards_metal" integer DEFAULT 0 NOT NULL,
	"rewards_energy" integer DEFAULT 0 NOT NULL,
	"alive" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beer_base_spawn_events" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"t" timestamp NOT NULL,
	"tier" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"by" varchar(50) NOT NULL,
	"sid" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "bot_config" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"spawn_rate" integer NOT NULL,
	"total_bots" integer NOT NULL,
	"last_spawn" timestamp
);
--> statement-breakpoint
CREATE TABLE "bot_magnet_beacons" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"player_name" varchar(50) NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"deployed_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"cooldown_until" timestamp NOT NULL,
	"attraction_radius" integer DEFAULT 100 NOT NULL,
	"attraction_chance" integer DEFAULT 30 NOT NULL,
	"bots_attracted" integer DEFAULT 0 NOT NULL,
	"active" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"channel_id" varchar(30) NOT NULL,
	"clan_id" varchar(24),
	"sender_id" varchar(20) NOT NULL,
	"sender_username" varchar(20) NOT NULL,
	"sender_level" integer NOT NULL,
	"is_vip" smallint DEFAULT 0 NOT NULL,
	"is_newbie" smallint DEFAULT 0 NOT NULL,
	"message" varchar(1000) NOT NULL,
	"item_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timestamp" timestamp NOT NULL,
	"month_category" varchar(7) NOT NULL,
	"edited" smallint DEFAULT 0 NOT NULL,
	"edited_at" timestamp,
	"deleted" smallint DEFAULT 0 NOT NULL,
	"deleted_by" varchar(20),
	"deletion_reason" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "chat_read_status" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"channel_id" varchar(30) NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"last_read_message_id" varchar(24),
	"last_read_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"name" varchar(30) NOT NULL,
	"tag" varchar(6) NOT NULL,
	"description" text NOT NULL,
	"leader_id" varchar(20) NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_members" integer DEFAULT 20 NOT NULL,
	"level_current_level" integer DEFAULT 1 NOT NULL,
	"level_total_xp" integer DEFAULT 0 NOT NULL,
	"level_current_level_xp" integer DEFAULT 0 NOT NULL,
	"level_xp_to_next_level" integer DEFAULT 0 NOT NULL,
	"level_features_unlocked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"level_milestones_completed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"level_last_level_up" timestamp,
	"created_at" timestamp NOT NULL,
	"settings_message_of_the_day" varchar(500) DEFAULT '' NOT NULL,
	"settings_is_recruiting" smallint DEFAULT 1 NOT NULL,
	"settings_min_level_to_join" integer DEFAULT 1 NOT NULL,
	"settings_requires_approval" smallint DEFAULT 0 NOT NULL,
	"settings_allow_territory_control" smallint DEFAULT 0 NOT NULL,
	"settings_allow_war_declarations" smallint DEFAULT 0 NOT NULL,
	"stats_total_power" integer DEFAULT 0 NOT NULL,
	"stats_total_territories" integer DEFAULT 0 NOT NULL,
	"stats_total_monuments" integer DEFAULT 0 NOT NULL,
	"stats_wars_won" integer DEFAULT 0 NOT NULL,
	"stats_wars_lost" integer DEFAULT 0 NOT NULL,
	"stats_total_rp" integer DEFAULT 0 NOT NULL,
	"research_research_points" integer DEFAULT 0 NOT NULL,
	"research_unlocked_techs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research_active_research" varchar(50),
	"bank_treasury_metal" integer DEFAULT 0 NOT NULL,
	"bank_treasury_energy" integer DEFAULT 0 NOT NULL,
	"bank_treasury_research_points" integer DEFAULT 0 NOT NULL,
	"bank_tax_rates_metal" numeric(5, 2) DEFAULT '0' NOT NULL,
	"bank_tax_rates_energy" numeric(5, 2) DEFAULT '0' NOT NULL,
	"bank_tax_rates_research_points" numeric(5, 2) DEFAULT '0' NOT NULL,
	"bank_upgrade_level" integer DEFAULT 1 NOT NULL,
	"bank_capacity" integer DEFAULT 0 NOT NULL,
	"bank_transactions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_perks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"territories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monuments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"wars_active" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"wars_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"wmd_cooldown_until" timestamp,
	"last_wmd_launch" timestamp,
	"last_territory_income_collection" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"participants" jsonb NOT NULL,
	"participant_details" jsonb,
	"last_message_content" varchar(1000),
	"last_message_sender_id" varchar(20),
	"last_message_created_at" timestamp,
	"last_message_status" varchar(20),
	"unread_count" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_archived" jsonb,
	"is_pinned" jsonb,
	"metadata_total_messages" integer,
	"metadata_first_message_at" timestamp,
	"metadata_mute_until" jsonb
);
--> statement-breakpoint
CREATE TABLE "factories" (
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"owner" varchar(20),
	"defense" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"slots" integer DEFAULT 0 NOT NULL,
	"used_slots" integer DEFAULT 0 NOT NULL,
	"production_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"last_slot_regen" timestamp NOT NULL,
	"last_resource_generation" timestamp,
	"last_attacked_by" varchar(20),
	"last_attack_time" timestamp,
	CONSTRAINT "factories_pk" PRIMARY KEY("x","y")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"current_holder" varchar(24),
	"current_holder_username" varchar(20),
	"last_captured_at" timestamp,
	"last_captured_by" varchar(20),
	"total_captures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"from_user" varchar(20) NOT NULL,
	"to_user" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"message" varchar(200),
	"created_at" timestamp NOT NULL,
	"responded_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "friends" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"friend_id" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"initiated_by" varchar(20) NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"is_blocked" smallint,
	"blocked_by" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "game_config" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"type" varchar(30) NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(24) NOT NULL,
	"sender_id" varchar(20) NOT NULL,
	"recipient_id" varchar(20) NOT NULL,
	"content" varchar(1000) NOT NULL,
	"content_type" varchar(20) DEFAULT 'text' NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"created_at" timestamp NOT NULL,
	"read_at" timestamp,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"metadata_original_content" varchar(1000),
	"metadata_edit_history" jsonb,
	"metadata_system_type" varchar(20),
	"metadata_related_entity_id" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "missiles" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"missile_id" varchar(50) NOT NULL,
	"owner_id" varchar(20) NOT NULL,
	"owner_clan_id" varchar(24),
	"warhead_type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"components_warhead" integer,
	"components_propulsion" integer,
	"components_guidance" integer,
	"components_payload" integer,
	"components_stealth" integer,
	"target_id" varchar(20),
	"target_type" varchar(20),
	"secondary_targets" jsonb,
	"launched_at" timestamp,
	"launched_by" varchar(20),
	"impact_at" timestamp,
	"flight_time" integer,
	"intercept_attempts" integer DEFAULT 0,
	"intercepted_by" varchar(20),
	"intercepted_at" timestamp,
	"damage_dealt" jsonb,
	"created_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_log" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"moderator_id" varchar(20) NOT NULL,
	"action" varchar(50) NOT NULL,
	"target_id" varchar(20) NOT NULL,
	"reason" text,
	"details" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mutes" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"moderator_id" varchar(20) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_activity" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"action" varchar(50) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "player_flags" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"flag" varchar(50) NOT NULL,
	"details" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_research" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"player_username" varchar(20) NOT NULL,
	"clan_id" varchar(24),
	"completed_techs" jsonb DEFAULT '[]'::jsonb,
	"available_techs" jsonb DEFAULT '[]'::jsonb,
	"locked_techs" jsonb DEFAULT '[]'::jsonb,
	"current_research_tech_id" varchar(50),
	"current_research_started_at" timestamp,
	"current_research_rp_spent" integer,
	"current_research_rp_required" integer,
	"current_research_progress" numeric(5, 2),
	"missile_tier" integer DEFAULT 0,
	"defense_tier" integer DEFAULT 0,
	"intelligence_tier" integer DEFAULT 0,
	"total_rp_spent" integer DEFAULT 0,
	"total_techs_unlocked" integer DEFAULT 0,
	"clan_research_bonus" numeric(5, 2) DEFAULT '0',
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_sessions" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"username" varchar(20) PRIMARY KEY NOT NULL,
	"_id" varchar(24),
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"base_x" integer NOT NULL,
	"base_y" integer NOT NULL,
	"current_position_x" integer NOT NULL,
	"current_position_y" integer NOT NULL,
	"resources_metal" integer DEFAULT 0 NOT NULL,
	"resources_energy" integer DEFAULT 0 NOT NULL,
	"bank_metal" integer DEFAULT 0 NOT NULL,
	"bank_energy" integer DEFAULT 0 NOT NULL,
	"bank_last_deposit" timestamp,
	"rank" integer DEFAULT 1,
	"inventory_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inventory_capacity" integer DEFAULT 2000 NOT NULL,
	"inventory_metal_digger_count" integer DEFAULT 0 NOT NULL,
	"inventory_energy_digger_count" integer DEFAULT 0 NOT NULL,
	"gathering_bonus_metal_bonus" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gathering_bonus_energy_bonus" numeric(5, 2) DEFAULT '0' NOT NULL,
	"active_boosts_gathering_boost" numeric(5, 2),
	"active_boosts_expires_at" timestamp,
	"shrine_boosts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"units" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_strength" integer DEFAULT 0 NOT NULL,
	"total_defense" integer DEFAULT 0 NOT NULL,
	"balance_effects" jsonb,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"research_points" integer DEFAULT 0 NOT NULL,
	"unlocked_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unlocked_techs" jsonb,
	"concentration_zones" jsonb,
	"last_bot_summon" timestamp,
	"fast_travel_waypoints" jsonb,
	"last_fast_travel" timestamp,
	"daily_bounties" jsonb,
	"specialization" jsonb,
	"discoveries" jsonb,
	"achievements" jsonb,
	"stats" jsonb,
	"factory_count" integer DEFAULT 0,
	"last_xp_award" timestamp,
	"last_level_up" timestamp,
	"rp_history" jsonb,
	"base_greeting" varchar(500),
	"battle_stats" jsonb,
	"is_bot" smallint DEFAULT 0,
	"is_special_base" smallint DEFAULT 0,
	"bot_config" jsonb,
	"clan_id" varchar(24),
	"clan_name" varchar(30),
	"clan_role" varchar(20),
	"clan_level" integer,
	"is_admin" smallint DEFAULT 0,
	"vip" smallint DEFAULT 0,
	"vip_expiration" timestamp,
	"vip_tier" varchar(20),
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"vip_last_updated" timestamp,
	"last_login_date" timestamp,
	"login_streak" integer DEFAULT 0,
	"last_streak_reward" timestamp,
	"current_hp" integer DEFAULT 1000,
	"max_hp" integer DEFAULT 1000,
	"last_flag_attack" timestamp,
	"referral_code" varchar(20),
	"referral_link" varchar(255),
	"referred_by" varchar(20),
	"referred_by_username" varchar(20),
	"referral_validated" smallint,
	"referral_validated_at" timestamp,
	"total_referrals" integer DEFAULT 0,
	"pending_referrals" integer DEFAULT 0,
	"referral_rewards_metal" integer,
	"referral_rewards_energy" integer,
	"referral_rewards_rp" integer,
	"referral_rewards_xp" integer,
	"referral_rewards_vip_days" integer,
	"referral_titles" jsonb,
	"referral_badges" jsonb,
	"referral_multiplier" numeric(3, 1) DEFAULT '1.0',
	"last_referral_validated" timestamp,
	"referral_milestones_reached" jsonb,
	"signup_ip" varchar(45),
	"created_at" timestamp DEFAULT '2026-09-03 13:32:37.797'
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"referrer_code" varchar(20) NOT NULL,
	"referrer_username" varchar(20) NOT NULL,
	"referrer_player_id" varchar(24) NOT NULL,
	"new_player_username" varchar(20) NOT NULL,
	"new_player_email" varchar(255) NOT NULL,
	"new_player_ip" varchar(45) NOT NULL,
	"signup_date" timestamp NOT NULL,
	"validation_date" timestamp,
	"validated" smallint DEFAULT 0 NOT NULL,
	"login_count" integer DEFAULT 0 NOT NULL,
	"last_login" timestamp,
	"days_active" integer DEFAULT 0 NOT NULL,
	"rewards_claimed" smallint DEFAULT 0 NOT NULL,
	"rewards_data_metal" integer DEFAULT 0 NOT NULL,
	"rewards_data_energy" integer DEFAULT 0 NOT NULL,
	"rewards_data_rp" integer DEFAULT 0 NOT NULL,
	"rewards_data_xp" integer DEFAULT 0 NOT NULL,
	"rewards_data_vip_days" integer DEFAULT 0 NOT NULL,
	"rewards_data_special_reward" varchar(100),
	"rewards_data_milestone" integer,
	"welcome_package_given" smallint DEFAULT 0 NOT NULL,
	"flagged_for_abuse" smallint DEFAULT 0 NOT NULL,
	"flag_reason" varchar(255),
	"admin_notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shrine_blessings" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"tier" varchar(20) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"yield_bonus" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiles" (
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"terrain" varchar(20) NOT NULL,
	"occupied_by_base" smallint,
	"base_owner" varchar(20),
	"base_greeting" varchar(500),
	"last_harvested_by" jsonb,
	"bank_type" varchar(20),
	"has_flag_bearer" smallint,
	"has_trail" smallint,
	"trail_timestamp" timestamp,
	"trail_expires_at" timestamp,
	CONSTRAINT "tiles_pk" PRIMARY KEY("x","y")
);
--> statement-breakpoint
CREATE TABLE "tutorial_action_tracking" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"step_id" varchar(50) NOT NULL,
	"action_type" varchar(30) NOT NULL,
	"completed" smallint DEFAULT 0 NOT NULL,
	"last_updated" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutorial_progress" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"current_quest_id" varchar(50),
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"completed_quests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skipped_quests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claimed_rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tutorial_skipped" smallint DEFAULT 0 NOT NULL,
	"tutorial_declined" smallint,
	"tutorial_complete" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp NOT NULL,
	"current_step_started_at" timestamp,
	"completed_at" timestamp,
	"declined_at" timestamp,
	"last_updated" timestamp NOT NULL,
	"total_steps_completed" integer DEFAULT 0 NOT NULL,
	"total_time_spent" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "typing_indicators" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"channel_id" varchar(30) NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"user_id" varchar(20) NOT NULL,
	"last_seen" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warnings" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"moderator_id" varchar(20) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"expired" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_admin_alerts" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"type" varchar(30) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" varchar(500) NOT NULL,
	"details" jsonb,
	"created_at" timestamp NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wmd_clan_votes" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"vote_id" varchar(50) NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"proposer_id" varchar(20) NOT NULL,
	"proposer_username" varchar(50) NOT NULL,
	"vote_type" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"target_id" varchar(20),
	"target_username" varchar(50),
	"warhead_type" varchar(20),
	"votes_for" jsonb DEFAULT '[]'::jsonb,
	"votes_against" jsonb DEFAULT '[]'::jsonb,
	"required_votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wmd_config" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"key" varchar(50) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_defense_batteries" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"status" varchar(20) NOT NULL,
	"intercept_chance" numeric(5, 2) DEFAULT '0',
	"cooldown_duration" integer DEFAULT 0,
	"battery_id" varchar(50) NOT NULL,
	"built_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"repair_completes_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wmd_notifications" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"notification_id" varchar(50) NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"scope" varchar(20) NOT NULL,
	"source_id" varchar(20) NOT NULL,
	"source_name" varchar(50) NOT NULL,
	"target_id" varchar(20),
	"target_name" varchar(50),
	"title" varchar(200) NOT NULL,
	"message" varchar(500) NOT NULL,
	"details" jsonb,
	"view_count" integer DEFAULT 0,
	"viewed_by" jsonb,
	"broadcast_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_spy_missions" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"sender_clan_id" varchar(24) NOT NULL,
	"target_clan_id" varchar(24) NOT NULL,
	"spy_id" varchar(50),
	"spy_name" varchar(50),
	"target_name" varchar(50),
	"mission_type" varchar(30),
	"status" varchar(20) NOT NULL,
	"estimated_completion" timestamp,
	"actual_completion" timestamp,
	"final_success_chance" numeric(5, 2),
	"detection_risk" numeric(5, 2),
	"roll" numeric(5, 2),
	"successful" smallint DEFAULT 0,
	"detected" smallint DEFAULT 0,
	"intel_gathered" jsonb,
	"intelligence_gathered" jsonb,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_suspicious_activity" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"player_id" varchar(20) NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"activity_type" varchar(30) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"details" jsonb,
	"evidence" jsonb,
	"reported_by" varchar(20),
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmd_votes" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"clan_id" varchar(24) NOT NULL,
	"status" varchar(20) NOT NULL,
	"eligible_voters" integer DEFAULT 0 NOT NULL,
	"votes" jsonb,
	"final_approval_rate" numeric(5, 2),
	"required_approval_percentage" numeric(5, 2),
	"created_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "word_blacklist" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"word" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "achievements_player_id_idx" ON "achievements" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "auctions_seller_id_idx" ON "auctions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "auctions_status_idx" ON "auctions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auctions_expires_at_idx" ON "auctions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "bans_player_id_idx" ON "bans" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "battle_logs_attacker_timestamp_idx" ON "battle_logs" USING btree ("attacker_username","timestamp");--> statement-breakpoint
CREATE INDEX "battle_logs_defender_timestamp_idx" ON "battle_logs" USING btree ("defender_username","timestamp");--> statement-breakpoint
CREATE INDEX "battle_logs_timestamp_idx" ON "battle_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "beer_defeat_t_idx" ON "beer_base_defeat_events" USING btree ("t");--> statement-breakpoint
CREATE INDEX "beer_spawn_t_idx" ON "beer_base_spawn_events" USING btree ("t");--> statement-breakpoint
CREATE INDEX "bot_beacons_player_idx" ON "bot_magnet_beacons" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "bot_beacons_active_idx" ON "bot_magnet_beacons" USING btree ("active");--> statement-breakpoint
CREATE INDEX "bot_beacons_expires_at_idx" ON "bot_magnet_beacons" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "chat_messages_channel_timestamp_idx" ON "chat_messages" USING btree ("channel_id","timestamp");--> statement-breakpoint
CREATE INDEX "chat_messages_month_category_idx" ON "chat_messages" USING btree ("month_category");--> statement-breakpoint
CREATE INDEX "chat_messages_sender_id_idx" ON "chat_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "chat_messages_clan_id_idx" ON "chat_messages" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "chat_read_status_user_channel_idx" ON "chat_read_status" USING btree ("user_id","channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clans_name_unique" ON "clans" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "clans_tag_unique" ON "clans" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "clans_level_power_idx" ON "clans" USING btree ("level_current_level","stats_total_power");--> statement-breakpoint
CREATE INDEX "clans_power_idx" ON "clans" USING btree ("stats_total_power");--> statement-breakpoint
CREATE INDEX "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "factories_owner_idx" ON "factories" USING btree ("owner");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_from_to_status_unique" ON "friend_requests" USING btree ("from_user","to_user","status");--> statement-breakpoint
CREATE INDEX "friend_requests_to_status_created_idx" ON "friend_requests" USING btree ("to_user","status","created_at");--> statement-breakpoint
CREATE INDEX "friend_requests_from_status_idx" ON "friend_requests" USING btree ("from_user","status");--> statement-breakpoint
CREATE INDEX "friend_requests_expires_at_idx" ON "friend_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friends_user_friend_status_unique" ON "friends" USING btree ("user_id","friend_id","status");--> statement-breakpoint
CREATE INDEX "friends_friend_user_status_idx" ON "friends" USING btree ("friend_id","user_id","status");--> statement-breakpoint
CREATE INDEX "friends_status_created_idx" ON "friends" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "game_config_type_idx" ON "game_config" USING btree ("type");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_recipient_status_idx" ON "messages" USING btree ("recipient_id","status");--> statement-breakpoint
CREATE INDEX "messages_deleted_at_idx" ON "messages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "missiles_owner_idx" ON "missiles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "missiles_status_idx" ON "missiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mod_log_moderator_created_idx" ON "mod_log" USING btree ("moderator_id","created_at");--> statement-breakpoint
CREATE INDEX "mod_log_target_id_idx" ON "mod_log" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "mutes_player_id_idx" ON "mutes" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "player_activity_player_timestamp_idx" ON "player_activity" USING btree ("player_id","timestamp");--> statement-breakpoint
CREATE INDEX "player_flags_player_id_idx" ON "player_flags" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_research_player_id_unique" ON "player_research" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "player_research_clan_id_idx" ON "player_research" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "player_sessions_user_id_idx" ON "player_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_sessions_token_idx" ON "player_sessions" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "email_unique" ON "players" USING btree ("email");--> statement-breakpoint
CREATE INDEX "clan_idx" ON "players" USING btree ("clan_id","clan_role");--> statement-breakpoint
CREATE INDEX "level_idx" ON "players" USING btree ("level");--> statement-breakpoint
CREATE INDEX "referrals_referrer_validated_idx" ON "referrals" USING btree ("referrer_username","validated");--> statement-breakpoint
CREATE INDEX "referrals_new_player_username_idx" ON "referrals" USING btree ("new_player_username");--> statement-breakpoint
CREATE INDEX "referrals_signup_date_idx" ON "referrals" USING btree ("signup_date");--> statement-breakpoint
CREATE INDEX "referrals_validated_validation_date_idx" ON "referrals" USING btree ("validated","validation_date");--> statement-breakpoint
CREATE INDEX "shrine_blessings_player_id_idx" ON "shrine_blessings" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "shrine_blessings_expires_at_idx" ON "shrine_blessings" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tutorial_action_player_step_unique" ON "tutorial_action_tracking" USING btree ("player_id","step_id");--> statement-breakpoint
CREATE INDEX "tutorial_action_last_updated_idx" ON "tutorial_action_tracking" USING btree ("last_updated");--> statement-breakpoint
CREATE UNIQUE INDEX "tutorial_progress_player_id_unique" ON "tutorial_progress" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "tutorial_progress_complete_idx" ON "tutorial_progress" USING btree ("tutorial_complete","completed_at");--> statement-breakpoint
CREATE INDEX "tutorial_progress_quest_skipped_idx" ON "tutorial_progress" USING btree ("current_quest_id","tutorial_skipped");--> statement-breakpoint
CREATE INDEX "typing_indicators_channel_user_idx" ON "typing_indicators" USING btree ("channel_id","user_id");--> statement-breakpoint
CREATE INDEX "typing_indicators_expires_at_idx" ON "typing_indicators" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_presence_user_id_unique" ON "user_presence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_presence_expires_at_idx" ON "user_presence" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "warnings_player_id_idx" ON "warnings" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "wmd_alert_status_idx" ON "wmd_admin_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wmd_alert_severity_idx" ON "wmd_admin_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "wmd_clan_votes_clan_idx" ON "wmd_clan_votes" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "wmd_clan_votes_status_idx" ON "wmd_clan_votes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wmd_clan_votes_expires_idx" ON "wmd_clan_votes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wmd_config_key_unique" ON "wmd_config" USING btree ("key");--> statement-breakpoint
CREATE INDEX "wmd_defense_clan_idx" ON "wmd_defense_batteries" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "wmd_defense_status_idx" ON "wmd_defense_batteries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wmd_notif_scope_idx" ON "wmd_notifications" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "wmd_notif_broadcast_idx" ON "wmd_notifications" USING btree ("broadcast_at");--> statement-breakpoint
CREATE INDEX "wmd_spy_sender_idx" ON "wmd_spy_missions" USING btree ("sender_clan_id");--> statement-breakpoint
CREATE INDEX "wmd_spy_target_idx" ON "wmd_spy_missions" USING btree ("target_clan_id");--> statement-breakpoint
CREATE INDEX "wmd_spy_status_idx" ON "wmd_spy_missions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wmd_activity_clan_idx" ON "wmd_suspicious_activity" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "wmd_activity_severity_idx" ON "wmd_suspicious_activity" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "wmd_votes_clan_idx" ON "wmd_votes" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "wmd_votes_status_idx" ON "wmd_votes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "word_blacklist_word_unique" ON "word_blacklist" USING btree ("word");