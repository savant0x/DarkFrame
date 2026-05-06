-- ============================================================================
-- DarkFrame Supabase Migration: Complete Database Schema
-- Phase 1: All Tables, Indexes, RLS Policies, and Seed Data
-- Created: 2026-05-03 | FID-20260503-SUPABASE
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Game enums
create type terrain_type as enum ('Metal', 'Energy', 'Cave', 'Forest', 'Factory', 'Wasteland', 'Bank', 'Shrine', 'AuctionHouse');
create type bank_type as enum ('metal', 'energy', 'exchange');
create type movement_direction as enum ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'REFRESH');
create type unit_tier as enum ('1', '2', '3', '4', '5');
create type unit_type as enum (
  'T1_RIFLEMAN','T1_SCOUT','T1_GRENADIER','T1_SNIPER','T1_BUNKER','T1_BARRIER','T1_TURRET','T1_SHIELD',
  'T2_COMMANDO','T2_RANGER','T2_ASSASSIN','T2_DEMOLISHER','T2_FORTRESS','T2_BARRICADE','T2_CANNON','T2_SENTINEL',
  'T3_STRIKER','T3_RAIDER','T3_ENFORCER','T3_WARLORD','T3_CITADEL','T3_BULWARK','T3_ARTILLERY','T3_GUARDIAN',
  'T4_TITAN','T4_JUGGERNAUT','T4_DESTROYER','T4_ANNIHILATOR','T4_STRONGHOLD','T4_RAMPART','T4_DREADNOUGHT','T4_COLOSSUS',
  'T5_OVERLORD','T5_CONQUEROR','T5_DEVASTATOR','T5_APOCALYPSE','T5_BASTION','T5_MONOLITH','T5_LEVIATHAN','T5_IMMORTAL',
  'SPEC_OFF_VANGUARD','SPEC_OFF_BERSERKER','SPEC_OFF_EXECUTIONER','SPEC_OFF_ANNIHILATOR','SPEC_OFF_WARMONGER',
  'SPEC_DEF_GUARDIAN','SPEC_DEF_FORTRESS','SPEC_DEF_CITADEL','SPEC_DEF_BULWARK','SPEC_DEF_INVINCIBLE',
  'SPEC_TAC_STRIKER','SPEC_TAC_VANGUARD','SPEC_TAC_ELITE','SPEC_TAC_COMMANDER','SPEC_TAC_SUPREME',
  'PRESTIGE_TITAN','PRESTIGE_FABRICATOR','PRESTIGE_OVERLORD','PRESTIGE_HARVESTER','PRESTIGE_VAULT_KEEPER',
  'PRESTIGE_MYSTIC','PRESTIGE_ANCIENT_SENTINEL','PRESTIGE_SPELUNKER','PRESTIGE_CHAMPION','PRESTIGE_APEX_PREDATOR'
);
create type item_type as enum ('METAL_DIGGER', 'ENERGY_DIGGER', 'UNIVERSAL_DIGGER', 'TRADEABLE_ITEM');
create type item_rarity as enum ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
create type shrine_boost_tier as enum ('spade', 'heart', 'diamond', 'club');
create type specialization_doctrine as enum ('none', 'offensive', 'defensive', 'tactical');
create type discovery_category as enum ('industrial', 'combat', 'strategic');
create type achievement_category as enum ('combat', 'economic', 'exploration', 'progression');
create type achievement_rarity as enum ('common', 'rare', 'epic', 'legendary');
create type balance_status as enum ('CRITICAL', 'IMBALANCED', 'BALANCED', 'OPTIMAL');
create type bot_specialization as enum ('hoarder', 'fortress', 'raider', 'ghost', 'balanced', 'boss');
create type bot_reputation as enum ('unknown', 'notorious', 'infamous', 'legendary');
create type bot_movement as enum ('stationary', 'roam', 'teleport');

-- Clan enums
create type clan_role as enum ('LEADER', 'CO_LEADER', 'OFFICER', 'ELITE', 'MEMBER', 'RECRUIT');
create type clan_activity_type as enum (
  'CLAN_CREATED','MEMBER_JOINED','MEMBER_LEFT','MEMBER_KICKED','MEMBER_PROMOTED','MEMBER_DEMOTED',
  'LEADERSHIP_TRANSFERRED','SETTINGS_CHANGED','LEVEL_UP','PERK_ACTIVATED','PERK_DEACTIVATED',
  'RESEARCH_UNLOCKED','RESEARCH_CONTRIBUTED','TERRITORY_CLAIMED','TERRITORY_LOST',
  'TERRITORY_INCOME_COLLECTED','WAR_DECLARED','WAR_ENDED','MONUMENT_CAPTURED','MONUMENT_LOST',
  'BANK_DEPOSIT','BANK_WITHDRAWAL','TAX_COLLECTED','TAX_RATE_CHANGED','BANK_UPGRADED',
  'FUND_DISTRIBUTION','ALLIANCE_PROPOSED','ALLIANCE_RECEIVED','ALLIANCE_ACCEPTED',
  'ALLIANCE_FORMED','ALLIANCE_BROKEN','CONTRACT_ADDED','CONTRACT_REMOVED'
);
create type clan_war_status as enum ('DECLARED', 'ACTIVE', 'ENDED', 'TRUCE');
create type monument_type as enum ('ANCIENT_FORGE', 'WAR_MEMORIAL', 'MARKET_PLAZA', 'RESEARCH_LAB', 'GRAND_TEMPLE');
create type alliance_type as enum ('NAP', 'TRADE', 'MILITARY', 'FEDERATION');
create type alliance_status as enum ('PROPOSED', 'ACTIVE', 'BROKEN', 'EXPIRED');
create type contract_type as enum ('RESOURCE_SHARING', 'DEFENSE_PACT', 'WAR_SUPPORT', 'JOINT_RESEARCH');
create type distribution_method as enum ('EQUAL_SPLIT', 'PERCENTAGE', 'MERIT', 'DIRECT_GRANT');
create type clan_bank_tx_type as enum ('DEPOSIT','WITHDRAWAL','TAX_COLLECTION','RESEARCH_SPENDING','PERK_ACTIVATION','BANK_UPGRADE');
create type clan_perk_tier as enum ('BRONZE','SILVER','GOLD','LEGENDARY');
create type clan_perk_category as enum ('COMBAT','ECONOMIC','SOCIAL','STRATEGIC');
create type clan_research_category as enum ('INDUSTRIAL','MILITARY','ECONOMIC','SOCIAL');

-- Auction enums
create type auction_item_type as enum ('unit', 'resource', 'tradeable_item');
create type auction_status as enum ('active', 'sold', 'cancelled', 'expired');
create type resource_type as enum ('metal', 'energy');

-- Stripe enums
create type vip_tier as enum ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUAL', 'YEARLY');
create type transaction_status as enum ('pending', 'completed', 'failed', 'refunded');

-- Tutorial enums
create type tutorial_quest_category as enum ('MOVEMENT','COMBAT','ECONOMY','SOCIAL','PROGRESSION','UI_NAVIGATION','ENDGAME');

-- WMD enums
create type wmd_mission_status as enum ('pending','in_progress','completed','failed','aborted');
create type wmd_warhead_type as enum ('high_explosive','chemical','biological','nuclear','emp');
create type wmd_launch_status as enum ('preparing','in_flight','impacted','intercepted','failed');
create type wmd_notification_type as enum (
  'missile_launched','missile_incoming','missile_impact','missile_intercepted',
  'spy_dispatched','spy_detected','spy_captured','spy_mission_complete',
  'sabotage_detected','sabotage_repelled','sabotage_successful',
  'defense_activated','defense_upgraded','defense_breached',
  'research_complete','tech_unlocked','vote_started','vote_complete','vote_tie'
);
create type wmd_vote_type as enum ('launch_authorization','research_priority','defense_allocation','spy_mission','retaliation');
create type wmd_vote_status as enum ('active','passed','failed','tied','expired');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Players table (core player data)
create table players (
  username text primary key,
  email text unique not null,
  password text not null, -- bcrypt hashed
  base_x integer not null default 75,
  base_y integer not null default 75,
  current_x integer not null default 75,
  current_y integer not null default 75,
  resources_metal numeric(15,2) not null default 0,
  resources_energy numeric(15,2) not null default 0,
  bank_metal numeric(15,2) not null default 0,
  bank_energy numeric(15,2) not null default 0,
  bank_last_deposit timestamptz,
  rank integer not null default 1,
  xp numeric(15,2) not null default 0,
  level integer not null default 1,
  research_points numeric(15,2) not null default 0,
  total_strength integer not null default 0,
  total_defense integer not null default 0,
  factory_count integer not null default 0,
  gathering_metal_bonus numeric(5,2) not null default 0,
  gathering_energy_bonus numeric(5,2) not null default 0,
  inventory_capacity integer not null default 2000,
  inventory_metal_digger_count integer not null default 0,
  inventory_energy_digger_count integer not null default 0,
  base_greeting text,
  last_login_date date,
  login_streak integer not null default 0,
  last_streak_reward timestamptz,
  last_xp_award timestamptz,
  last_level_up timestamptz,
  last_fast_travel timestamptz,
  last_bot_summon timestamptz,

  -- Clan denormalized
  clan_id uuid,
  clan_name text,
  clan_role clan_role,
  clan_level integer,

  -- Admin
  is_admin boolean not null default false,

  -- VIP / Stripe
  is_vip boolean not null default false,
  vip_expiration timestamptz,
  vip_tier vip_tier,
  stripe_customer_id text,
  stripe_subscription_id text,
  vip_last_updated timestamptz,

  -- Flag bearer
  current_hp integer not null default 1000,
  max_hp integer not null default 1000,
  last_flag_attack timestamptz,

  -- Referral
  referral_code text unique,
  referral_link text,
  referred_by text,
  referred_by_username text,
  referral_validated boolean not null default false,
  referral_validated_at timestamptz,
  total_referrals integer not null default 0,
  pending_referrals integer not null default 0,
  referral_rewards_metal numeric(15,2) not null default 0,
  referral_rewards_energy numeric(15,2) not null default 0,
  referral_rewards_rp numeric(15,2) not null default 0,
  referral_rewards_xp numeric(15,2) not null default 0,
  referral_rewards_vip_days integer not null default 0,
  referral_milestones integer[] not null default '{}',
  referral_milestones_reached integer[] not null default '{}',
  signup_ip text,

  -- Bot flag
  is_bot boolean not null default false,
  is_special_base boolean not null default false,

  -- Specialization
  spec_doctrine specialization_doctrine not null default 'none',
  spec_selected_at timestamptz,
  spec_mastery_level integer not null default 0,
  spec_mastery_xp numeric(15,2) not null default 0,
  spec_total_units_built integer not null default 0,
  spec_total_battles_won integer not null default 0,
  spec_last_respec_at timestamptz,

  -- Balance effects (computed)
  balance_ratio numeric(6,3),
  balance_status balance_status,
  balance_power_multiplier numeric(5,3),
  balance_damage_taken_multiplier numeric(5,3),
  balance_damage_dealt_multiplier numeric(5,3),
  balance_gathering_multiplier numeric(5,3),
  balance_slot_regen_multiplier numeric(5,3),
  balance_effective_power numeric(15,2),

  -- Player stats
  stat_battles_won integer not null default 0,
  stat_total_units_built integer not null default 0,
  stat_total_resources_gathered numeric(15,2) not null default 0,
  stat_total_resources_banked numeric(15,2) not null default 0,
  stat_shrine_trade_count integer not null default 0,
  stat_caves_explored integer not null default 0,

  -- Battle stats
  battle_infantry_initiated integer not null default 0,
  battle_infantry_won integer not null default 0,
  battle_infantry_lost integer not null default 0,
  battle_base_initiated integer not null default 0,
  battle_base_won integer not null default 0,
  battle_base_lost integer not null default 0,
  battle_base_defense_total integer not null default 0,
  battle_base_defense_won integer not null default 0,
  battle_base_defense_lost integer not null default 0,

  -- Unlocks
  unlocked_tiers unit_tier[] not null default '{1}',
  unlocked_techs text[] not null default '{}',

  -- Timestamps
  created_at timestamptz not null default now()
);

-- Player inventory items
create table player_inventory (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  item_id text not null,
  item_type item_type not null,
  name text not null,
  description text,
  rarity item_rarity not null,
  bonus_percent numeric(5,2) not null default 0,
  bonus_value numeric(15,2),
  quantity integer not null default 1,
  found_at_x integer,
  found_at_y integer,
  found_date timestamptz not null default now(),
  unique(player_username, item_id)
);

-- Player units
create table player_units (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  unit_type unit_type not null,
  quantity integer not null default 1,
  unique(player_username, unit_type)
);

-- Player specializations respec history
create table player_respec_history (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  from_doctrine specialization_doctrine not null,
  to_doctrine specialization_doctrine not null,
  changed_at timestamptz not null default now(),
  rp_spent numeric(15,2) not null,
  resources_metal numeric(15,2) not null,
  resources_energy numeric(15,2) not null
);

-- Player discoveries
create table player_discoveries (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  discovery_id text not null,
  name text not null,
  category discovery_category not null,
  description text,
  bonus text,
  discovered_at timestamptz not null default now(),
  discovered_x integer,
  discovered_y integer,
  unique(player_username, discovery_id)
);

-- Player achievements
create table player_achievements (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  achievement_id text not null,
  name text not null,
  description text,
  category achievement_category not null,
  rarity achievement_rarity not null,
  req_type text,
  req_value integer,
  reward_unit_unlock text,
  reward_rp_bonus numeric(15,2),
  unlocked_at timestamptz not null default now(),
  progress integer not null default 0,
  unique(player_username, achievement_id)
);

-- Player shrine boosts
create table player_shrine_boosts (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  boost_tier shrine_boost_tier not null,
  expires_at timestamptz not null,
  yield_bonus numeric(5,2) not null default 0.25
);

-- Player RP history
create table player_rp_history (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  amount numeric(15,2) not null,
  reason text not null,
  created_at timestamptz not null default now(),
  balance numeric(15,2) not null
);

-- Player fast travel waypoints
create table player_fast_travel_waypoints (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  name text not null,
  x integer not null,
  y integer not null,
  set_at timestamptz not null default now(),
  unique(player_username, name)
);

-- Player concentration zones
create table player_concentration_zones (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  name text,
  center_x integer not null,
  center_y integer not null,
  size integer not null default 30
);

-- Player daily bounties
create table player_bounties (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  difficulty text not null,
  unit_specialization text not null,
  unit_tier integer not null,
  defeats_required integer not null,
  current_defeats integer not null default 0,
  metal_reward numeric(15,2) not null,
  energy_reward numeric(15,2) not null,
  completed boolean not null default false,
  claimed boolean not null default false,
  last_refresh timestamptz not null default now(),
  unclaimed_rewards integer not null default 0
);

-- Active boosts (deprecated, kept for migration compat)
create table player_active_boosts (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  gathering_boost numeric(5,2),
  expires_at timestamptz,
  unique(player_username)
);

-- ============================================================================
-- TILES TABLE
-- ============================================================================
create table tiles (
  x integer not null,
  y integer not null,
  terrain terrain_type not null,
  occupied_by_base boolean not null default false,
  base_owner text,
  base_greeting text,
  bank_type bank_type,
  has_flag_bearer boolean not null default false,
  has_trail boolean not null default false,
  trail_timestamp timestamptz,
  trail_expires_at timestamptz,
  primary key (x, y)
);

-- Tile harvest records
create table tile_harvest_records (
  id uuid primary key default gen_random_uuid(),
  tile_x integer not null,
  tile_y integer not null,
  player_id text not null,
  harvested_at timestamptz not null default now(),
  reset_period text not null,
  foreign key (tile_x, tile_y) references tiles(x, y) on delete cascade
);

-- ============================================================================
-- CLANS TABLE
-- ============================================================================

create table clans (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  tag text unique not null check (char_length(tag) between 2 and 6),
  description text not null default '',
  leader_id text not null,
  max_members integer not null default 20,

  -- Progression
  clan_level integer not null default 1,
  total_xp numeric(15,2) not null default 0,
  current_level_xp numeric(15,2) not null default 0,
  xp_to_next_level numeric(15,2) not null default 1000,
  last_level_up timestamptz,
  last_xp_gain timestamptz,
  prestige_badge text,

  -- Settings (JSONB for flexible clan settings)
  clan_settings jsonb not null default '{
    "messageOfTheDay": "",
    "isRecruiting": true,
    "minLevelToJoin": 1,
    "requiresApproval": false,
    "allowTerritoryControl": true,
    "allowWarDeclarations": true
  }',

  -- Stats
  total_power integer not null default 0,
  total_territories integer not null default 0,
  total_monuments integer not null default 0,
  wars_won integer not null default 0,
  wars_lost integer not null default 0,
  total_rp numeric(15,2) not null default 0,

  -- Research
  research_points numeric(15,2) not null default 0,
  unlocked_research text[] not null default '{}',
  active_research text,

  -- Bank
  bank_treasury_metal numeric(15,2) not null default 0,
  bank_treasury_energy numeric(15,2) not null default 0,
  bank_treasury_rp numeric(15,2) not null default 0,
  bank_tax_metal numeric(5,2) not null default 0 check (bank_tax_metal between 0 and 50),
  bank_tax_energy numeric(5,2) not null default 0 check (bank_tax_energy between 0 and 50),
  bank_tax_rp numeric(5,2) not null default 0 check (bank_tax_rp between 0 and 50),
  bank_upgrade_level integer not null default 1,
  bank_capacity numeric(15,2) not null default 1000000,

  created_at timestamptz not null default now()
);

-- Now fix players FK reference
alter table players add constraint players_clan_id_fkey foreign key (clan_id) references clans(id) on delete set null;

-- Clan members
create table clan_members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  player_id text not null references players(username) on delete cascade,
  username text not null,
  role clan_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  last_active timestamptz not null default now(),
  unique(clan_id, player_id)
);

-- Clan bank transactions
create table clan_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  transaction_type clan_bank_tx_type not null,
  player_id text,
  username text,
  amount_metal numeric(15,2) not null default 0,
  amount_energy numeric(15,2) not null default 0,
  amount_rp numeric(15,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

-- Clan milestones
create table clan_milestones (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  level integer not null,
  completed_at timestamptz not null default now(),
  reward_metal numeric(15,2) not null,
  reward_energy numeric(15,2) not null,
  reward_rp numeric(15,2) not null,
  unique(clan_id, level)
);

-- Clan active perks
create table clan_perks (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  perk_id text not null,
  name text not null,
  description text,
  category clan_perk_category not null,
  tier clan_perk_tier not null,
  required_level integer not null,
  cost_metal numeric(15,2) not null,
  cost_energy numeric(15,2) not null,
  cost_rp numeric(15,2) not null,
  bonus_type text not null,
  bonus_value numeric(5,2) not null,
  activated_at timestamptz not null default now(),
  activated_by text
);

-- Clan territories
create table clan_territories (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  tile_x integer not null,
  tile_y integer not null,
  claimed_at timestamptz not null default now(),
  claimed_by text not null,
  defense_bonus numeric(5,2) not null default 0,
  territory_type text not null default 'STANDARD',
  foreign key (tile_x, tile_y) references tiles(x, y) on delete cascade
);

-- Clan wars
create table clan_wars (
  id uuid primary key default gen_random_uuid(),
  war_id text unique not null,
  attacker_clan_id uuid not null references clans(id) on delete cascade,
  defender_clan_id uuid not null references clans(id) on delete cascade,
  status clan_war_status not null default 'DECLARED',
  declared_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  cost_metal numeric(15,2) not null default 2000,
  cost_energy numeric(15,2) not null default 2000,
  attacker_territory_gained integer not null default 0,
  defender_territory_gained integer not null default 0,
  attacker_battles_won integer not null default 0,
  defender_battles_won integer not null default 0,
  winner_clan_id uuid references clans(id)
);

-- Clan chat messages
create table clan_chat_messages (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  sender_id text not null,
  sender_role clan_role not null,
  message text not null check (char_length(message) <= 500),
  channel text not null default 'general' check (channel in ('general', 'officer', 'leader')),
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Clan activity log
create table clan_activity (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  activity_type clan_activity_type not null,
  player_id text,
  username text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Clan invitations
create table clan_invitations (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  clan_name text not null,
  invited_by text not null,
  invited_player text not null,
  invited_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired'))
);

-- Clan alliances
create table clan_alliances (
  id uuid primary key default gen_random_uuid(),
  clan_a_id uuid not null references clans(id) on delete cascade,
  clan_b_id uuid not null references clans(id) on delete cascade,
  alliance_type alliance_type not null,
  status alliance_status not null default 'PROPOSED',
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz,
  broken_at timestamptz,
  contracts jsonb not null default '[]',
  unique(clan_a_id, clan_b_id)
);

-- ============================================================================
-- FACTORIES
-- ============================================================================
create table factories (
  id uuid primary key default gen_random_uuid(),
  x integer not null,
  y integer not null,
  owner text references players(username) on delete set null,
  defense numeric(15,2) not null default 100,
  level integer not null default 1 check (level between 1 and 10),
  slots integer not null default 5000,
  used_slots integer not null default 0,
  production_rate numeric(15,2) not null default 0,
  last_slot_regen timestamptz not null default now(),
  last_resource_generation timestamptz,
  last_attacked_by text,
  last_attack_time timestamptz,
  unique(x, y)
);

-- ============================================================================
-- FLAGS
-- ============================================================================
create table flags (
  id uuid primary key default gen_random_uuid(),
  bearer_id text references players(username) on delete set null,
  bearer_username text,
  position_x integer not null,
  position_y integer not null,
  claimed_at timestamptz,
  current_hp integer not null default 1000,
  max_hp integer not null default 1000,
  is_bot boolean not null default false,
  bot_config jsonb
);

-- ============================================================================
-- UNITS (global unit definitions)
-- ============================================================================
create table unit_definitions (
  unit_type unit_type primary key,
  name text not null,
  tier unit_tier not null,
  metal_cost integer not null,
  energy_cost integer not null,
  slot_cost integer not null,
  strength integer not null,
  defense integer not null,
  level_required integer not null,
  rp_required integer not null
);

-- ============================================================================
-- REFERRALS
-- ============================================================================
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_code text not null,
  referrer_username text not null references players(username) on delete cascade,
  new_player_username text not null,
  new_player_email text,
  new_player_ip text,
  signup_date timestamptz not null default now(),
  validation_date timestamptz,
  validated boolean not null default false,
  login_count integer not null default 0,
  last_login timestamptz,
  days_active integer not null default 0,
  rewards_claimed boolean not null default false,
  reward_metal numeric(15,2) not null default 0,
  reward_energy numeric(15,2) not null default 0,
  reward_rp numeric(15,2) not null default 0,
  reward_xp numeric(15,2) not null default 0,
  reward_vip_days integer not null default 0,
  welcome_package_given boolean not null default false,
  flagged_for_abuse boolean not null default false,
  flag_reason text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- BATTLE LOGS
-- ============================================================================
create table battle_logs (
  id uuid primary key default gen_random_uuid(),
  attacker_username text not null,
  defender_username text not null,
  attacker_strength integer not null,
  defender_defense integer not null,
  outcome text not null check (outcome in ('attacker_win', 'defender_win')),
  damage_dealt integer not null,
  resources_stolen jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- AUCTIONS
-- ============================================================================
create table auction_listings (
  id uuid primary key default gen_random_uuid(),
  auction_id text unique not null,
  seller_username text not null references players(username) on delete cascade,
  seller_clan text,
  item_type auction_item_type not null,
  unit_type unit_type,
  unit_id text,
  unit_strength integer,
  unit_defense integer,
  resource_type resource_type,
  resource_amount numeric(15,2),
  tradeable_item_quantity integer,
  starting_bid numeric(15,2) not null,
  current_bid numeric(15,2) not null,
  buyout_price numeric(15,2),
  reserve_price numeric(15,2),
  highest_bidder text,
  status auction_status not null default 'active',
  duration_hours integer not null check (duration_hours in (12, 24, 48)),
  listing_fee numeric(15,2) not null,
  sale_fee numeric(15,2) not null default 0,
  clan_only boolean not null default false,
  settled boolean not null default false,
  settled_at timestamptz,
  final_price numeric(15,2),
  winner_username text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references auction_listings(id) on delete cascade,
  bid_auction_id text not null,
  bidder_username text not null,
  bid_amount numeric(15,2) not null,
  bid_time timestamptz not null default now(),
  is_winning boolean not null default false
);

create table auction_notifications (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  auction_id text not null,
  notification_type text not null check (notification_type in ('outbid','won','sold','expired','cancelled')),
  message text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

-- ============================================================================
-- TUTORIAL
-- ============================================================================
create table tutorial_progress (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  current_quest_id text,
  current_step_index integer not null default 0,
  completed_quests text[] not null default '{}',
  completed_steps text[] not null default '{}',
  skipped_quests text[] not null default '{}',
  claimed_rewards text[] not null default '{}',
  tutorial_skipped boolean not null default false,
  tutorial_declined boolean not null default false,
  tutorial_complete boolean not null default false,
  started_at timestamptz not null default now(),
  current_step_started_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  last_updated timestamptz not null default now(),
  total_steps_completed integer not null default 0,
  total_time_spent integer not null default 0,
  unique(player_username)
);

create table tutorial_analytics (
  id uuid primary key default gen_random_uuid(),
  player_username text not null,
  event_type text not null check (event_type in ('STARTED','STEP_COMPLETED','QUEST_COMPLETED','SKIPPED','ABANDONED','COMPLETED')),
  quest_id text,
  step_id text,
  time_spent integer,
  skip_reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ADMIN & LOGGING
-- ============================================================================
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_username text not null,
  action text not null,
  target text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table player_flags (
  id uuid primary key default gen_random_uuid(),
  player_username text not null references players(username) on delete cascade,
  flagged_by text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

-- ============================================================================
-- BOTS
-- ============================================================================
create table bots (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  current_x integer not null,
  current_y integer not null,
  base_x integer not null,
  base_y integer not null,
  resources_metal numeric(15,2) not null default 0,
  resources_energy numeric(15,2) not null default 0,
  specialization bot_specialization not null default 'balanced',
  tier integer not null default 1 check (tier between 1 and 3),
  last_growth timestamptz not null default now(),
  last_resource_regen timestamptz,
  attack_cooldown timestamptz,
  revenge_target text,
  is_special_base boolean not null default false,
  last_defeated timestamptz,
  defeated_count integer not null default 0,
  reputation bot_reputation not null default 'unknown',
  movement bot_movement not null default 'stationary',
  zone integer not null default 0 check (zone between 0 and 8),
  nest_affinity integer,
  bounty_value numeric(15,2) not null default 0,
  permanent_base boolean not null default true,
  summoned_by text references players(username) on delete set null,
  summoned_at timestamptz,
  total_strength integer not null default 0,
  total_defense integer not null default 0,
  is_bot boolean not null default true,
  created_at timestamptz not null default now()
);

create table bot_config (
  id uuid primary key default gen_random_uuid(),
  config_key text unique not null,
  config_value jsonb not null
);

-- ============================================================================
-- STRIPE PAYMENTS
-- ============================================================================
create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references players(username) on delete cascade,
  username text not null,
  stripe_customer_id text,
  stripe_session_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  tier vip_tier not null,
  amount integer not null,
  status transaction_status not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb
);

-- ============================================================================
-- WMD: WEAPONS OF MASS DESTRUCTION
-- ============================================================================

-- WMD Player Research
create table wmd_player_research (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players(username) on delete cascade,
  player_username text not null,
  clan_id uuid references clans(id) on delete set null,
  completed_techs text[] not null default '{}',
  available_techs text[] not null default '{}',
  locked_techs text[] not null default '{}',
  total_rp_spent numeric(15,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id)
);

-- WMD Missiles
create table wmd_missiles (
  id uuid primary key default gen_random_uuid(),
  missile_id text unique not null,
  owner_id text not null references players(username) on delete cascade,
  owner_username text not null,
  name text,
  status wmd_launch_status not null default 'preparing',
  target_x integer,
  target_y integer,
  assembly_started timestamptz,
  assembled_at timestamptz,
  launched_at timestamptz,
  eta_seconds integer,
  damage_radius integer not null default 1,
  created_at timestamptz not null default now()
);

-- WMD Missile Warheads
create table wmd_missile_warheads (
  id uuid primary key default gen_random_uuid(),
  missile_id uuid not null references wmd_missiles(id) on delete cascade,
  warhead_type wmd_warhead_type not null,
  damage integer not null,
  created_at timestamptz not null default now()
);

-- WMD Missile Components
create table wmd_missile_components (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players(username) on delete cascade,
  component_type text not null,
  quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, component_type)
);

-- WMD Defense Batteries
create table wmd_defense_batteries (
  id uuid primary key default gen_random_uuid(),
  battery_id text unique not null,
  owner_id text not null references players(username) on delete cascade,
  owner_username text not null,
  name text,
  tier integer not null default 1 check (tier between 1 and 5),
  status text not null default 'active' check (status in ('active','recharging','offline','destroyed')),
  position_x integer not null,
  position_y integer not null,
  interception_range integer not null default 3,
  recharges_at timestamptz,
  created_at timestamptz not null default now()
);

-- WMD Clan Defense Grid
create table wmd_clan_defense_grid (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  pooled_batteries jsonb not null default '[]',
  grid_radius integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clan_id)
);

-- WMD Spies
create table wmd_spies (
  id uuid primary key default gen_random_uuid(),
  spy_id text unique not null,
  owner_id text not null references players(username) on delete cascade,
  owner_username text not null,
  name text,
  experience integer not null default 0,
  status text not null default 'idle' check (status in ('idle','on_mission','captured','killed','training')),
  position_x integer not null,
  position_y integer not null,
  created_at timestamptz not null default now()
);

-- WMD Spy Missions
create table wmd_spy_missions (
  id uuid primary key default gen_random_uuid(),
  mission_id text unique not null,
  spy_id uuid not null references wmd_spies(id) on delete cascade,
  owner_id text not null,
  target_player_id text,
  mission_type text not null,
  status wmd_mission_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);

-- WMD Launch History
create table wmd_launch_history (
  id uuid primary key default gen_random_uuid(),
  launch_id text unique not null,
  missile_id text not null,
  owner_id text not null references players(username) on delete cascade,
  owner_username text not null,
  target_x integer not null,
  target_y integer not null,
  status wmd_launch_status not null,
  damage_dealt integer not null default 0,
  intercepted_by text,
  launched_at timestamptz not null default now(),
  result jsonb
);

-- WMD Interception Attempts
create table wmd_interception_attempts (
  id uuid primary key default gen_random_uuid(),
  launch_id text not null,
  defender_id text not null references players(username) on delete cascade,
  defender_username text not null,
  battery_id text,
  success boolean not null default false,
  attempted_at timestamptz not null default now()
);

-- WMD Sabotage Events
create table wmd_sabotage_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  spy_mission_id text,
  saboteur_id text not null,
  target_player_id text not null,
  sabotage_type text not null,
  severity integer not null default 1 check (severity between 1 and 5),
  damage_description text,
  successful boolean not null default false,
  detected boolean not null default false,
  created_at timestamptz not null default now()
);

-- WMD Notifications
create table wmd_notifications (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players(username) on delete cascade,
  notification_type wmd_notification_type not null,
  title text not null,
  message text not null,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- WMD Clan Votes
create table wmd_clan_votes (
  id uuid primary key default gen_random_uuid(),
  vote_id text unique not null,
  clan_id uuid not null references clans(id) on delete cascade,
  vote_type wmd_vote_type not null,
  proposed_by text not null,
  title text not null,
  description text,
  status wmd_vote_status not null default 'active',
  expires_at timestamptz not null,
  votes_for integer not null default 0,
  votes_against integer not null default 0,
  votes_abstain integer not null default 0,
  total_eligible integer not null default 0,
  result jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- WMD Vote ballots
create table wmd_vote_ballots (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references wmd_clan_votes(id) on delete cascade,
  voter_id text not null,
  choice text not null check (choice in ('for','against','abstain')),
  voted_at timestamptz not null default now(),
  unique(vote_id, voter_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Players indexes
create index idx_players_email on players(email);
create index idx_players_clan_id on players(clan_id);
create index idx_players_referral_code on players(referral_code);
create index idx_players_stripe_customer on players(stripe_customer_id);
create index idx_players_position on players(current_x, current_y);
create index idx_players_is_bot on players(is_bot);
create index idx_players_is_admin on players(is_admin);

-- Tiles indexes
create index idx_tiles_terrain on tiles(terrain);
create index idx_tiles_base_owner on tiles(base_owner);
create index idx_tiles_has_flag on tiles(has_flag_bearer);

-- Tile harvest records
create index idx_tile_harvest_tile on tile_harvest_records(tile_x, tile_y);
create index idx_tile_harvest_player on tile_harvest_records(player_id);
create index idx_tile_harvest_period on tile_harvest_records(reset_period);

-- Clan indexes
create index idx_clan_members_clan on clan_members(clan_id);
create index idx_clan_members_player on clan_members(player_id);
create index idx_clan_territories_clan on clan_territories(clan_id);
create index idx_clan_territories_tile on clan_territories(tile_x, tile_y);
create index idx_clan_wars_attacker on clan_wars(attacker_clan_id);
create index idx_clan_wars_defender on clan_wars(defender_clan_id);
create index idx_clan_wars_status on clan_wars(status);
create index idx_clan_chat_clan on clan_chat_messages(clan_id, created_at desc);
create index idx_clan_activity_clan on clan_activity(clan_id, created_at desc);
create index idx_clan_invitations_player on clan_invitations(invited_player);
create index idx_clan_invitations_status on clan_invitations(status);
create index idx_clan_alliances_a on clan_alliances(clan_a_id);
create index idx_clan_alliances_b on clan_alliances(clan_b_id);
create index idx_clan_bank_tx_clan on clan_bank_transactions(clan_id, created_at desc);
create index idx_clan_perks_clan on clan_perks(clan_id);

-- Factory indexes
create index idx_factories_owner on factories(owner);
create index idx_factories_position on factories(x, y);

-- Referral indexes
create index idx_referrals_referrer on referrals(referrer_username);
create index idx_referrals_new_player on referrals(new_player_username);
create index idx_referrals_validated on referrals(validated);

-- Battle log indexes
create index idx_battle_logs_attacker on battle_logs(attacker_username);
create index idx_battle_logs_defender on battle_logs(defender_username);
create index idx_battle_logs_created on battle_logs(created_at desc);

-- Auction indexes
create index idx_auctions_seller on auction_listings(seller_username);
create index idx_auctions_status on auction_listings(status);
create index idx_auctions_expires on auction_listings(expires_at);
create index idx_auctions_item_type on auction_listings(item_type);
create index idx_auction_bids_auction on auction_bids(auction_id);
create index idx_auction_bids_bidder on auction_bids(bidder_username);

-- Inventory indexes
create index idx_player_inventory_player on player_inventory(player_username);

-- Player units
create index idx_player_units_player on player_units(player_username);

-- Tutorial indexes
create index idx_tutorial_progress_player on tutorial_progress(player_username);

-- Bot indexes
create index idx_bots_position on bots(current_x, current_y);
create index idx_bots_specialization on bots(specialization);
create index idx_bots_zone on bots(zone);

-- Payment indexes
create index idx_payments_user on payment_transactions(user_id);
create index idx_payments_stripe on payment_transactions(stripe_session_id);

-- WMD indexes
create index idx_wmd_research_player on wmd_player_research(player_id);
create index idx_wmd_missiles_owner on wmd_missiles(owner_id);
create index idx_wmd_missiles_status on wmd_missiles(status);
create index idx_wmd_defense_owner on wmd_defense_batteries(owner_id);
create index idx_wmd_defense_position on wmd_defense_batteries(position_x, position_y);
create index idx_wmd_spies_owner on wmd_spies(owner_id);
create index idx_wmd_spies_status on wmd_spies(status);
create index idx_wmd_spy_missions_spy on wmd_spy_missions(spy_id);
create index idx_wmd_launch_history_owner on wmd_launch_history(owner_id);
create index idx_wmd_interceptions_defender on wmd_interception_attempts(defender_id);
create index idx_wmd_notifications_player on wmd_notifications(player_id, created_at desc);
create index idx_wmd_notifications_unread on wmd_notifications(player_id, is_read) where is_read = false;
create index idx_wmd_votes_clan on wmd_clan_votes(clan_id);
create index idx_wmd_votes_status on wmd_clan_votes(status);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
alter table players enable row level security;
alter table player_inventory enable row level security;
alter table player_units enable row level security;
alter table player_discoveries enable row level security;
alter table player_achievements enable row level security;
alter table player_shrine_boosts enable row level security;
alter table player_rp_history enable row level security;
alter table player_respec_history enable row level security;
alter table player_fast_travel_waypoints enable row level security;
alter table player_concentration_zones enable row level security;
alter table player_bounties enable row level security;
alter table player_active_boosts enable row level security;
alter table tiles enable row level security;
alter table tile_harvest_records enable row level security;
alter table clans enable row level security;
alter table clan_members enable row level security;
alter table clan_bank_transactions enable row level security;
alter table clan_milestones enable row level security;
alter table clan_perks enable row level security;
alter table clan_territories enable row level security;
alter table clan_wars enable row level security;
alter table clan_chat_messages enable row level security;
alter table clan_activity enable row level security;
alter table clan_invitations enable row level security;
alter table clan_alliances enable row level security;
alter table factories enable row level security;
alter table flags enable row level security;
alter table unit_definitions enable row level security;
alter table referrals enable row level security;
alter table battle_logs enable row level security;
alter table auction_listings enable row level security;
alter table auction_bids enable row level security;
alter table auction_notifications enable row level security;
alter table tutorial_progress enable row level security;
alter table tutorial_analytics enable row level security;
alter table admin_logs enable row level security;
alter table player_flags enable row level security;
alter table bots enable row level security;
alter table bot_config enable row level security;
alter table payment_transactions enable row level security;
alter table wmd_player_research enable row level security;
alter table wmd_missiles enable row level security;
alter table wmd_missile_warheads enable row level security;
alter table wmd_missile_components enable row level security;
alter table wmd_defense_batteries enable row level security;
alter table wmd_clan_defense_grid enable row level security;
alter table wmd_spies enable row level security;
alter table wmd_spy_missions enable row level security;
alter table wmd_launch_history enable row level security;
alter table wmd_interception_attempts enable row level security;
alter table wmd_sabotage_events enable row level security;
alter table wmd_notifications enable row level security;
alter table wmd_clan_votes enable row level security;
alter table wmd_vote_ballots enable row level security;

-- Player RLS: Players can read/write their own data
create policy "Players can read own profile" on players for select using (username = auth.jwt() ->> 'email');
create policy "Players can read other players" on players for select using (true);
create policy "Players can update own profile" on players for update using (username = auth.jwt() ->> 'email');

-- Player inventory: Only owner can CRUD
create policy "Owner can manage inventory" on player_inventory for all using (player_username = auth.jwt() ->> 'email');

-- Tiles: Public read
create policy "Anyone can read tiles" on tiles for select using (true);

-- Clans: Public read, members can update
create policy "Anyone can read clans" on clans for select using (true);
create policy "Clan members can update" on clans for update using (
  exists (select 1 from clan_members where clan_id = clans.id and player_id = auth.jwt() ->> 'email')
);

-- Clan chat: Clan members can read/write
create policy "Clan members can read chat" on clan_chat_messages for select using (
  exists (select 1 from clan_members where clan_id = clan_chat_messages.clan_id and player_id = auth.jwt() ->> 'email')
);
create policy "Clan members can send chat" on clan_chat_messages for insert with check (
  exists (select 1 from clan_members where clan_id = clan_chat_messages.clan_id and player_id = auth.jwt() ->> 'email')
);

-- Factories: Public read
create policy "Anyone can read factories" on factories for select using (true);

-- Flags: Public read
create policy "Anyone can read flags" on flags for select using (true);

-- Battle logs: Public read
create policy "Anyone can read battle logs" on battle_logs for select using (true);

-- Auctions: Public read
create policy "Anyone can read auctions" on auction_listings for select using (true);

-- Service role bypass for admin operations (server-side API routes use service_role key)
create policy "Service role can manage all" on players for all using (auth.role() = 'service_role');
create policy "Service role can manage inventory" on player_inventory for all using (auth.role() = 'service_role');
create policy "Service role can manage units" on player_units for all using (auth.role() = 'service_role');
create policy "Service role can manage tiles" on tiles for all using (auth.role() = 'service_role');
create policy "Service role can manage clans" on clans for all using (auth.role() = 'service_role');
create policy "Service role can manage factories" on factories for all using (auth.role() = 'service_role');
create policy "Service role can manage flags" on flags for all using (auth.role() = 'service_role');
create policy "Service role can manage battles" on battle_logs for all using (auth.role() = 'service_role');
create policy "Service role can manage auctions" on auction_listings for all using (auth.role() = 'service_role');
create policy "Service role can manage all tables" on bot_config for all using (auth.role() = 'service_role');
create policy "Service role can manage payments" on payment_transactions for all using (auth.role() = 'service_role');
create policy "Service role can manage wmd" on wmd_player_research for all using (auth.role() = 'service_role');

-- ============================================================================
-- SEED DATA: Unit Definitions
-- ============================================================================
insert into unit_definitions (unit_type, name, tier, metal_cost, energy_cost, slot_cost, strength, defense, level_required, rp_required) values
-- Tier 1
('T1_RIFLEMAN', 'Rifleman', '1', 200, 100, 1, 5, 0, 1, 0),
('T1_SCOUT', 'Scout', '1', 300, 150, 1, 8, 0, 1, 0),
('T1_GRENADIER', 'Grenadier', '1', 400, 200, 1, 12, 0, 1, 0),
('T1_SNIPER', 'Sniper', '1', 500, 250, 1, 15, 0, 1, 0),
('T1_BUNKER', 'Bunker', '1', 200, 100, 1, 0, 5, 1, 0),
('T1_BARRIER', 'Barrier', '1', 300, 150, 1, 0, 8, 1, 0),
('T1_TURRET', 'Turret', '1', 400, 200, 1, 0, 12, 1, 0),
('T1_SHIELD', 'Shield Generator', '1', 500, 250, 1, 0, 15, 1, 0),
-- Tier 2
('T2_COMMANDO', 'Commando', '2', 1200, 600, 3, 30, 0, 5, 5),
('T2_RANGER', 'Ranger', '2', 1600, 800, 3, 40, 0, 5, 5),
('T2_ASSASSIN', 'Assassin', '2', 2000, 1000, 3, 50, 0, 5, 5),
('T2_DEMOLISHER', 'Demolisher', '2', 2400, 1200, 3, 60, 0, 5, 5),
('T2_FORTRESS', 'Fortress', '2', 1200, 600, 3, 0, 30, 5, 5),
('T2_BARRICADE', 'Barricade', '2', 1600, 800, 3, 0, 40, 5, 5),
('T2_CANNON', 'Cannon', '2', 2000, 1000, 3, 0, 50, 5, 5),
('T2_SENTINEL', 'Sentinel', '2', 2400, 1200, 3, 0, 60, 5, 5),
-- Tier 3
('T3_STRIKER', 'Striker', '3', 3600, 1800, 7, 90, 0, 10, 15),
('T3_RAIDER', 'Raider', '3', 4200, 2100, 7, 105, 0, 10, 15),
('T3_ENFORCER', 'Enforcer', '3', 4800, 2400, 7, 120, 0, 10, 15),
('T3_WARLORD', 'Warlord', '3', 5400, 2700, 7, 135, 0, 10, 15),
('T3_CITADEL', 'Citadel', '3', 3600, 1800, 7, 0, 90, 10, 15),
('T3_BULWARK', 'Bulwark', '3', 4200, 2100, 7, 0, 105, 10, 15),
('T3_ARTILLERY', 'Artillery', '3', 4800, 2400, 7, 0, 120, 10, 15),
('T3_GUARDIAN', 'Guardian', '3', 5400, 2700, 7, 0, 135, 10, 15),
-- Tier 4
('T4_TITAN', 'Titan', '4', 7200, 3600, 15, 180, 0, 20, 30),
('T4_JUGGERNAUT', 'Juggernaut', '4', 8400, 4200, 15, 210, 0, 20, 30),
('T4_DESTROYER', 'Destroyer', '4', 9600, 4800, 15, 240, 0, 20, 30),
('T4_ANNIHILATOR', 'Annihilator', '4', 10800, 5400, 15, 270, 0, 20, 30),
('T4_STRONGHOLD', 'Stronghold', '4', 7200, 3600, 15, 0, 180, 20, 30),
('T4_RAMPART', 'Rampart', '4', 8400, 4200, 15, 0, 210, 20, 30),
('T4_DREADNOUGHT', 'Dreadnought', '4', 9600, 4800, 15, 0, 240, 20, 30),
('T4_COLOSSUS', 'Colossus', '4', 10800, 5400, 15, 0, 270, 20, 30),
-- Tier 5
('T5_OVERLORD', 'Overlord', '5', 14400, 7200, 30, 360, 0, 30, 50),
('T5_CONQUEROR', 'Conqueror', '5', 16800, 8400, 30, 420, 0, 30, 50),
('T5_DEVASTATOR', 'Devastator', '5', 19200, 9600, 30, 480, 0, 30, 50),
('T5_APOCALYPSE', 'Apocalypse', '5', 21600, 10800, 30, 540, 0, 30, 50),
('T5_BASTION', 'Bastion', '5', 14400, 7200, 30, 0, 360, 30, 50),
('T5_MONOLITH', 'Monolith', '5', 16800, 8400, 30, 0, 420, 30, 50),
('T5_LEVIATHAN', 'Leviathan', '5', 19200, 9600, 30, 0, 480, 30, 50),
('T5_IMMORTAL', 'Immortal', '5', 21600, 10800, 30, 0, 540, 30, 50),
-- Specialized Offensive
('SPEC_OFF_VANGUARD', 'Vanguard', '2', 4000, 2000, 2, 200, 0, 15, 25),
('SPEC_OFF_BERSERKER', 'Berserker', '3', 6500, 3250, 3, 280, 0, 15, 25),
('SPEC_OFF_EXECUTIONER', 'Executioner', '3', 9000, 4500, 3, 360, 0, 15, 25),
('SPEC_OFF_ANNIHILATOR', 'Annihilator', '4', 12000, 6000, 4, 480, 0, 15, 25),
('SPEC_OFF_WARMONGER', 'Warmonger', '5', 16000, 8000, 5, 620, 0, 15, 25),
-- Specialized Defensive
('SPEC_DEF_GUARDIAN', 'Guardian', '2', 4000, 2000, 2, 0, 200, 15, 25),
('SPEC_DEF_FORTRESS', 'Fortress', '3', 6500, 3250, 3, 0, 280, 15, 25),
('SPEC_DEF_CITADEL', 'Citadel', '3', 9000, 4500, 3, 0, 360, 15, 25),
('SPEC_DEF_BULWARK', 'Bulwark', '4', 12000, 6000, 4, 0, 480, 15, 25),
('SPEC_DEF_INVINCIBLE', 'Invincible', '5', 16000, 8000, 5, 0, 620, 15, 25),
-- Specialized Tactical
('SPEC_TAC_STRIKER', 'Striker', '2', 4500, 2250, 2, 120, 120, 15, 25),
('SPEC_TAC_VANGUARD', 'Tactical Vanguard', '3', 7000, 3500, 3, 160, 160, 15, 25),
('SPEC_TAC_ELITE', 'Elite Operative', '3', 10000, 5000, 3, 210, 210, 15, 25),
('SPEC_TAC_COMMANDER', 'Commander', '4', 13000, 6500, 4, 280, 280, 15, 25),
('SPEC_TAC_SUPREME', 'Supreme Commander', '5', 17000, 8500, 5, 360, 360, 15, 25),
-- Prestige Units
('PRESTIGE_TITAN', 'Prestige Titan', '5', 25000, 15000, 10, 700, 0, 30, 0),
('PRESTIGE_FABRICATOR', 'Fabricator', '5', 20000, 20000, 10, 400, 400, 30, 0),
('PRESTIGE_OVERLORD', 'Overlord', '5', 30000, 18000, 15, 1000, 0, 30, 0),
('PRESTIGE_HARVESTER', 'Harvester', '5', 20000, 20000, 10, 450, 450, 30, 0),
('PRESTIGE_VAULT_KEEPER', 'Vault Keeper', '5', 25000, 15000, 15, 0, 800, 30, 0),
('PRESTIGE_MYSTIC', 'Mystic', '5', 22000, 22000, 12, 500, 500, 30, 0),
('PRESTIGE_ANCIENT_SENTINEL', 'Ancient Sentinel', '5', 23000, 23000, 12, 550, 550, 30, 0),
('PRESTIGE_SPELUNKER', 'Spelunker', '5', 18000, 24000, 10, 400, 400, 30, 0),
('PRESTIGE_CHAMPION', 'Champion', '5', 25000, 25000, 15, 600, 600, 30, 0),
('PRESTIGE_APEX_PREDATOR', 'Apex Predator', '5', 28000, 18000, 15, 900, 0, 30, 0);
