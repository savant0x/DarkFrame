# DarkFrame MongoDB → MariaDB (Drizzle ORM) Schema Mapping

**Database**: `darkframe`  
**Target ORM**: Drizzle ORM for MariaDB  
**Date**: 2026-04-04

---

## Collection Index

| # | MongoDB Collection | Drizzle Table | Primary Key | Notes |
|---|---|---|---|---|
| 1 | `players` | `players` | `username` (VARCHAR) | Core user entity |
| 2 | `tiles` | `tiles` | Composite `(x, y)` | 150×150 game map |
| 3 | `factories` | `factories` | Composite `(x, y)` | Player-owned factories |
| 4 | `clans` | `clans` | `_id` → `id` (VARCHAR) | Clan/guild data |
| 5 | `clan_invitations` | `clan_invitations` | `_id` → `id` (VARCHAR) | Clan join invites |
| 6 | `clan_activities` | `clan_activities` | `_id` → `id` (VARCHAR) | Clan activity log |
| 7 | `clan_chat` | `clan_chat` | `_id` → `id` (VARCHAR) | Clan chat messages |
| 8 | `conversations` | `conversations` | `_id` → `id` (VARCHAR) | DM conversations |
| 9 | `messages` | `messages` | `_id` → `id` (VARCHAR) | DM messages |
| 10 | `chat_messages` | `chat_messages` | `_id` → `id` (VARCHAR) | Global chat messages |
| 11 | `chat_read_status` | `chat_read_status` | Composite | Chat read tracking |
| 12 | `word_blacklist` | `word_blacklist` | `_id` → `id` (VARCHAR) | Profanity blacklist |
| 13 | `friends` | `friends` | `_id` → `id` (VARCHAR) | Friendships + blocks |
| 14 | `friendRequests` | `friend_requests` | `_id` → `id` (VARCHAR) | Friend requests |
| 15 | `battleLogs` | `battle_logs` | `battleId` (VARCHAR) | PvP battle history |
| 16 | `referrals` | `referrals` | `_id` → `id` (VARCHAR) | Referral tracking |
| 17 | `tutorial_progress` | `tutorial_progress` | `_id` → `id` (VARCHAR) | Tutorial state |
| 18 | `tutorial_action_tracking` | `tutorial_action_tracking` | `_id` → `id` (VARCHAR) | Tutorial action tracking |
| 19 | `missiles` | `missiles` | `_id` → `id` (VARCHAR) | WMD missiles |
| 20 | `player_research` | `player_research` | `_id` → `id` (VARCHAR) | WMD research progress |
| 21 | `flags` | `flags` | `_id` → `id` (VARCHAR) | Flag bearer state |
| 22 | `items` | `items` | `_id` → `id` (VARCHAR) | Game items catalog |
| 23 | `playerSessions` | `player_sessions` | `_id` → `id` (VARCHAR) | Auth sessions |
| 24 | `playerActivity` | `player_activity` | `_id` → `id` (VARCHAR) | Anti-cheat activity |
| 25 | `playerFlags` | `player_flags` | `_id` → `id` (VARCHAR) | Anti-cheat flags |
| 26 | `migrations` | `migrations` | `_id` → `id` (VARCHAR) | DB migration tracking |
| 27 | `clan_messages` | `clan_messages` | `_id` → `id` (VARCHAR) | Clan websocket messages |

---

## 1. `players` Collection → `players` Table

**Primary Key**: `username` (VARCHAR 20) — unique identifier  
**Foreign Keys**: `clanId` → `clans.id`

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `username` | VARCHAR(20) | NO | — | PK, unique |
| `email` | VARCHAR(255) | NO | — | Unique, login email |
| `password` | VARCHAR(255) | NO | — | Bcrypt hash |
| `base_x` | INT | NO | — | Base position X (1-150) |
| `base_y` | INT | NO | — | Base position Y (1-150) |
| `current_position_x` | INT | NO | — | Current map X |
| `current_position_y` | INT | NO | — | Current map Y |
| `resources_metal` | BIGINT | NO | 0 | Metal inventory |
| `resources_energy` | BIGINT | NO | 0 | Energy inventory |
| `bank_metal` | BIGINT | NO | 0 | Banked metal |
| `bank_energy` | BIGINT | NO | 0 | Banked energy |
| `bank_last_deposit` | DATETIME | YES | NULL | Audit timestamp |
| `rank` | INT | YES | 1 | Player rank (1-6+) |
| `inventory_capacity` | INT | NO | 2000 | Max inventory items |
| `metal_digger_count` | INT | NO | 0 | Digger count for diminishing returns |
| `energy_digger_count` | INT | NO | 0 | Digger count for diminishing returns |
| `gathering_bonus_metal` | DECIMAL(5,2) | NO | 0 | % bonus from diggers |
| `gathering_bonus_energy` | DECIMAL(5,2) | NO | 0 | % bonus from diggers |
| `active_boosts_gathering` | DECIMAL(5,2) | YES | NULL | DEPRECATED |
| `active_boosts_expires` | DATETIME | YES | NULL | DEPRECATED |
| `xp` | INT | NO | 0 | Total experience |
| `level` | INT | NO | 1 | Current level |
| `research_points` | INT | NO | 0 | RP for unlocks |
| `total_strength` | INT | NO | 0 | Sum of unit STR |
| `total_defense` | INT | NO | 0 | Sum of unit DEF |
| `factory_count` | INT | YES | 0 | Factories owned |
| `last_xp_award` | DATETIME | YES | NULL | Last XP timestamp |
| `last_level_up` | DATETIME | YES | NULL | Last level-up |
| `base_greeting` | VARCHAR(500) | YES | NULL | Custom base message |
| `is_bot` | TINYINT(1) | YES | 0 | Bot flag |
| `is_special_base` | TINYINT(1) | YES | 0 | Beer base flag |
| `clan_id` | VARCHAR(24) | YES | NULL | FK → clans.id |
| `clan_name` | VARCHAR(30) | YES | NULL | Denormalized clan name |
| `clan_role` | VARCHAR(20) | YES | NULL | Clan role enum |
| `clan_level` | INT | YES | NULL | Denormalized clan level |
| `is_admin` | TINYINT(1) | YES | 0 | Admin flag |
| `vip` | TINYINT(1) | YES | 0 | VIP subscription |
| `vip_expiration` | DATETIME | YES | NULL | VIP expiry |
| `vip_tier` | VARCHAR(20) | YES | NULL | WEEKLY/MONTHLY/etc |
| `stripe_customer_id` | VARCHAR(255) | YES | NULL | Stripe customer |
| `stripe_subscription_id` | VARCHAR(255) | YES | NULL | Stripe subscription |
| `vip_last_updated` | DATETIME | YES | NULL | VIP status timestamp |
| `last_login_date` | DATETIME | YES | NULL | Daily reward tracking |
| `login_streak` | INT | YES | 0 | Consecutive login days |
| `last_streak_reward` | DATETIME | YES | NULL | Last streak claim |
| `current_hp` | INT | YES | NULL | Flag bearer HP |
| `max_hp` | INT | YES | NULL | Flag bearer max HP (default 1000) |
| `last_flag_attack` | DATETIME | YES | NULL | Flag attack cooldown |
| `referral_code` | VARCHAR(20) | YES | NULL | Unique referral code |
| `referral_link` | VARCHAR(255) | YES | NULL | Full referral URL |
| `referred_by` | VARCHAR(20) | YES | NULL | Referrer code |
| `referred_by_username` | VARCHAR(20) | YES | NULL | Referrer username |
| `referral_validated` | TINYINT(1) | YES | 0 | Referral validated flag |
| `referral_validated_at` | DATETIME | YES | NULL | Validation timestamp |
| `total_referrals` | INT | YES | 0 | Validated referral count |
| `pending_referrals` | INT | YES | 0 | Pending referral count |
| `referral_metal` | BIGINT | YES | 0 | Referral metal earned |
| `referral_energy` | BIGINT | YES | 0 | Referral energy earned |
| `referral_rp` | INT | YES | 0 | Referral RP earned |
| `referral_xp` | INT | YES | 0 | Referral XP earned |
| `referral_vip_days` | INT | YES | 0 | Referral VIP days |
| `referral_titles` | JSON | YES | NULL | Earned titles array |
| `referral_badges` | JSON | YES | NULL | Earned badges array |
| `referral_multiplier` | DECIMAL(3,1) | YES | 1.0 | Admin bonus multiplier |
| `last_referral_validated` | DATETIME | YES | NULL | Last referral validation |
| `referral_milestones` | JSON | YES | NULL | Milestones achieved |
| `signup_ip` | VARCHAR(45) | YES | NULL | IP for abuse detection |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Account creation |
| `bot_specialization` | VARCHAR(20) | YES | NULL | BotSpecialization enum |
| `bot_tier` | INT | YES | NULL | 1-3 |
| `bot_last_growth` | DATETIME | YES | NULL | Resource growth |
| `bot_last_resource_regen` | DATETIME | YES | NULL | Regen after defeat |
| `bot_attack_cooldown` | DATETIME | YES | NULL | Next attack time |
| `bot_revenge_target` | VARCHAR(20) | YES | NULL | Retaliation target |
| `bot_last_defeated` | DATETIME | YES | NULL | Last defeat time |
| `bot_defeated_count` | INT | YES | 0 | Times defeated |
| `bot_reputation` | VARCHAR(20) | YES | NULL | BotReputation enum |
| `bot_movement` | VARCHAR(20) | YES | NULL | stationary/roam/teleport |
| `bot_zone` | INT | YES | 0 | Map zone 0-8 |
| `bot_nest_affinity` | INT | YES | NULL | Nest 0-7 |
| `bot_bounty_value` | INT | YES | 0 | Bounty reward |
| `bot_permanent_base` | TINYINT(1) | YES | 0 | Always true for bots |
| `bot_summoned_by` | VARCHAR(24) | YES | NULL | Summoner player ID |
| `bot_summoned_at` | DATETIME | YES | NULL | Summon timestamp |
| `last_bot_summon` | DATETIME | YES | NULL | 7-day cooldown |
| `concentration_zones` | JSON | YES | NULL | Max 3 zones, 30×30 each |
| `unlocked_techs` | JSON | YES | NULL | Tech tree unlocks |
| `last_fast_travel` | DATETIME | YES | NULL | 12-hour cooldown |
| `specialization_doctrine` | VARCHAR(20) | YES | NULL | None/offensive/defensive/tactical |
| `specialization_selected_at` | DATETIME | YES | NULL | When chosen |
| `specialization_mastery_level` | DECIMAL(5,2) | YES | 0 | 0-100 |
| `specialization_mastery_xp` | INT | YES | 0 | XP toward mastery |
| `specialization_units_built` | INT | YES | 0 | Specialized units |
| `specialization_battles_won` | INT | YES | 0 | Battles with spec units |
| `specialization_last_respec` | DATETIME | YES | NULL | Respec cooldown |
| `stats_battles_won` | INT | YES | 0 | PvP wins |
| `stats_units_built` | INT | YES | 0 | Total units built |
| `stats_resources_gathered` | BIGINT | YES | 0 | Lifetime resources |
| `stats_resources_banked` | BIGINT | YES | 0 | Lifetime banked |
| `stats_shrine_trades` | INT | YES | 0 | Shrine trade count |
| `stats_caves_explored` | INT | YES | 0 | Cave/forest explorations |
| `battle_infantry_initiated` | INT | YES | 0 | Infantry attacks started |
| `battle_infantry_won` | INT | YES | 0 | Infantry wins |
| `battle_infantry_lost` | INT | YES | 0 | Infantry losses |
| `battle_base_attacks_initiated` | INT | YES | 0 | Base attacks started |
| `battle_base_attacks_won` | INT | YES | 0 | Base attack wins |
| `battle_base_attacks_lost` | INT | YES | 0 | Base attack losses |
| `battle_base_defenses_total` | INT | YES | 0 | Base defenses |
| `battle_base_defenses_won` | INT | YES | 0 | Base defense wins |
| `battle_base_defenses_lost` | INT | YES | 0 | Base defense losses |

**Indexes**:
- UNIQUE `username`
- UNIQUE `email`
- UNIQUE `referral_code`
- INDEX `clan_id`
- INDEX `level`
- INDEX `is_bot`
- INDEX `vip`
- INDEX `username` (for search)

**Nested Objects Flattened**:
- `Position {x, y}` → `base_x/base_y`, `current_position_x/current_position_y`
- `Resources {metal, energy}` → `resources_metal/resources_energy`
- `BankStorage {metal, energy, lastDeposit}` → `bank_metal/bank_energy/bank_last_deposit`
- `GatheringBonus {metalBonus, energyBonus}` → `gathering_bonus_metal/energy`
- `ActiveBoosts {gatheringBoost, expiresAt}` → `active_boosts_gathering/expires`
- `BalanceEffects` → Computed at runtime (NOT stored in DB, calculated)
- `Specialization` → Flattened into `specialization_*` columns
- `PlayerStats` → Flattened into `stats_*` columns
- `BattleStatistics` → Flattened into `battle_*` columns
- `BotConfig` → Flattened into `bot_*` columns
- `ReferralRewards` → Flattened into `referral_*` columns

**JSON Columns (arrays stored as JSON)**:
- `unlocked_techs` — string[]
- `concentration_zones` — array of zone objects
- `referral_titles` — string[]
- `referral_badges` — string[]
- `referral_milestones` — number[]

---

## 2. `tiles` Collection → `tiles` Table

**Primary Key**: Composite `(x, y)`  
**Note**: 22,500 rows (150×150 map), pre-seeded

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `x` | INT | NO | — | PK, 1-150 |
| `y` | INT | NO | — | PK, 1-150 |
| `terrain` | ENUM | NO | — | Metal/Energy/Cave/Forest/Factory/Wasteland/Bank/Shrine/AuctionHouse |
| `occupied_by_base` | TINYINT(1) | YES | 0 | Base present flag |
| `base_owner` | VARCHAR(20) | YES | NULL | Owner username |
| `base_greeting` | VARCHAR(500) | YES | NULL | Base greeting |
| `bank_type` | VARCHAR(20) | YES | NULL | metal/energy/exchange |
| `has_flag_bearer` | TINYINT(1) | YES | 0 | Flag bearer present |
| `has_trail` | TINYINT(1) | YES | 0 | Trail effect |
| `trail_timestamp` | DATETIME | YES | NULL | Trail time |
| `trail_expires_at` | DATETIME | YES | NULL | Trail expiry |

**Indexes**:
- PRIMARY `(x, y)`
- INDEX `terrain`
- INDEX `occupied_by_base`
- INDEX `has_flag_bearer`

**Nested Object — `lastHarvestedBy` → Separate Table**:

## 2a. `harvest_records` Table (extracted from tiles.lastHarvestedBy array)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `tile_x` | INT | NO | — | FK → tiles.x |
| `tile_y` | INT | NO | — | FK → tiles.y |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `timestamp` | DATETIME | NO | — | Harvest time |
| `reset_period` | VARCHAR(20) | NO | — | e.g. "2025-10-16-AM" |

**Indexes**:
- PRIMARY `id`
- INDEX `(tile_x, tile_y)`
- INDEX `player_id`
- INDEX `reset_period`
- UNIQUE `(tile_x, tile_y, player_id, reset_period)` — prevent double harvest

---

## 3. `factories` Collection → `factories` Table

**Primary Key**: Composite `(x, y)`

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `x` | INT | NO | — | PK, 1-150 |
| `y` | INT | NO | — | PK, 1-150 |
| `owner` | VARCHAR(20) | YES | NULL | FK → players.username |
| `defense` | INT | NO | 0 | Defense power |
| `level` | INT | NO | 1 | Upgrade level 1-10 |
| `slots` | INT | NO | — | Available slots |
| `used_slots` | INT | NO | 0 | Occupied slots |
| `production_rate` | DECIMAL(5,2) | NO | 0 | Units/hour |
| `last_slot_regen` | DATETIME | NO | — | Last regen check |
| `last_resource_generation` | DATETIME | YES | NULL | Passive income time |
| `last_attacked_by` | VARCHAR(20) | YES | NULL | Last attacker |
| `last_attack_time` | DATETIME | YES | NULL | Last attack time |

**Indexes**:
- PRIMARY `(x, y)`
- INDEX `owner`
- INDEX `level`

---

## 4. `clans` Collection → `clans` Table

**Primary Key**: `id` (VARCHAR 24, from MongoDB ObjectId hex)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `name` | VARCHAR(30) | NO | — | Unique |
| `tag` | VARCHAR(6) | NO | — | Unique, uppercase |
| `description` | TEXT | YES | '' | Clan description |
| `leader_id` | VARCHAR(20) | NO | — | FK → players.username |
| `max_members` | INT | NO | 20 | Member cap |
| `created_at` | DATETIME | NO | — | Creation time |

**Clan Level (embedded object) → Flattened**:

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `level_current` | INT | NO | 1 | 1-50 |
| `level_total_xp` | BIGINT | NO | 0 | Total XP |
| `level_current_xp` | INT | NO | 0 | Current level XP |
| `level_xp_to_next` | INT | NO | 1000 | XP needed |
| `level_last_up` | DATETIME | YES | NULL | Last level-up |
| `level_prestige_badge` | VARCHAR(50) | YES | NULL | Max level badge |

**Clan Settings (embedded) → Flattened**:

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `settings_motd` | VARCHAR(500) | YES | '' | Message of the day |
| `settings_recruiting` | TINYINT(1) | NO | 1 | Is recruiting |
| `settings_min_level` | INT | NO | 1 | Min level to join |
| `settings_requires_approval` | TINYINT(1) | NO | 0 | Approval required |
| `settings_territory_control` | TINYINT(1) | NO | 1 | Allow territories |
| `settings_war_declarations` | TINYINT(1) | NO | 1 | Allow wars |

**Clan Stats (embedded) → Flattened**:

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `stats_total_power` | INT | NO | 0 | Power rating |
| `stats_territories` | INT | NO | 0 | Territory count |
| `stats_monuments` | INT | NO | 0 | Monument count |
| `stats_wars_won` | INT | NO | 0 | Wars won |
| `stats_wars_lost` | INT | NO | 0 | Wars lost |
| `stats_total_rp` | INT | NO | 0 | Total RP contributed |

**Clan Research (embedded) → Flattened**:

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `research_points` | INT | NO | 0 | Shared RP pool |
| `active_research` | VARCHAR(50) | YES | NULL | Current tech ID |

**Clan Bank (embedded) → Flattened**:

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `bank_treasury_metal` | BIGINT | NO | 0 | Banked metal |
| `bank_treasury_energy` | BIGINT | NO | 0 | Banked energy |
| `bank_treasury_rp` | INT | NO | 0 | Banked RP |
| `bank_tax_metal` | INT | NO | 0 | Tax % 0-50 |
| `bank_tax_energy` | INT | NO | 0 | Tax % 0-50 |
| `bank_tax_rp` | INT | NO | 0 | Tax % 0-50 |
| `bank_upgrade_level` | INT | NO | 1 | 1-6 |
| `bank_capacity` | BIGINT | NO | 1000000 | Max per resource |

**JSON Columns**:
- `features_unlocked` — string[] (level features)
- `unlocked_techs` — string[] (research IDs)

**Indexes**:
- PRIMARY `id`
- UNIQUE `name`
- UNIQUE `tag`
- INDEX `leader_id`

---

## 4a. `clan_members` Table (extracted from clans.members array)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `username` | VARCHAR(20) | NO | — | Display name |
| `role` | ENUM | NO | — | LEADER/CO_LEADER/OFFICER/ELITE/MEMBER/RECRUIT |
| `joined_at` | DATETIME | NO | — | Join time |
| `last_active` | DATETIME | NO | — | Last activity |

**Indexes**:
- PRIMARY `id`
- UNIQUE `(clan_id, player_id)`
- INDEX `player_id`
- INDEX `role`

---

## 4b. `clan_perks` Table (extracted from clans.activePerks array)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `perk_id` | VARCHAR(50) | NO | — | Perk identifier |
| `perk_name` | VARCHAR(50) | NO | — | Display name |
| `perk_description` | TEXT | YES | — | Effect description |
| `perk_category` | VARCHAR(20) | NO | — | COMBAT/ECONOMIC/SOCIAL/STRATEGIC |
| `perk_tier` | VARCHAR(20) | NO | — | BRONZE/SILVER/GOLD/LEGENDARY |
| `bonus_type` | VARCHAR(30) | NO | — | attack/defense/resource_yield/etc |
| `bonus_value` | DECIMAL(5,2) | NO | 0 | Percentage or flat |
| `activated_at` | DATETIME | YES | NULL | Activation time |
| `activated_by` | VARCHAR(20) | YES | NULL | Player who activated |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `perk_id`

---

## 4c. `clan_territories` Table (extracted from clans.territories array)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `tile_x` | INT | NO | — | X coordinate |
| `tile_y` | INT | NO | — | Y coordinate |
| `claimed_at` | DATETIME | NO | — | Claim time |
| `claimed_by` | VARCHAR(20) | NO | — | Player who claimed |
| `defense_bonus` | DECIMAL(5,2) | NO | 0 | % bonus |
| `territory_type` | VARCHAR(20) | NO | 'STANDARD' | STANDARD/MONUMENT/STRONGHOLD |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `(tile_x, tile_y)`

---

## 4d. `clan_monuments` Table (extracted from clans.monuments array)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `monument_type` | ENUM | NO | — | ANCIENT_FORGE/WAR_MEMORIAL/MARKET_PLAZA/RESEARCH_LAB/GRAND_TEMPLE |
| `controlled_since` | DATETIME | YES | NULL | Control start |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `monument_type`

---

## 4e. `clan_bank_transactions` Table (extracted from clans.bank.transactions array)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `transaction_id` | VARCHAR(36) | NO | — | UUID |
| `type` | ENUM | NO | — | DEPOSIT/WITHDRAWAL/TAX_COLLECTION/etc |
| `player_id` | VARCHAR(20) | YES | NULL | FK → players.username |
| `username` | VARCHAR(20) | YES | NULL | Display name |
| `amount_metal` | BIGINT | YES | NULL | Metal amount |
| `amount_energy` | BIGINT | YES | NULL | Energy amount |
| `amount_rp` | INT | YES | NULL | RP amount |
| `timestamp` | DATETIME | NO | — | Transaction time |
| `description` | TEXT | NO | — | Description |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `timestamp`
- INDEX `type`

---

## 4f. `clan_wars` Table (extracted from clans.wars arrays)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `war_id` | VARCHAR(36) | NO | — | Unique war ID |
| `attacker_clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `defender_clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `status` | ENUM | NO | — | DECLARED/ACTIVE/ENDED/TRUCE |
| `declared_at` | DATETIME | NO | — | Declaration time |
| `started_at` | DATETIME | YES | NULL | Start time |
| `ended_at` | DATETIME | YES | NULL | End time |
| `cost_metal` | INT | NO | 2000 | Declaration cost |
| `cost_energy` | INT | NO | 2000 | Declaration cost |
| `attacker_territory_gained` | INT | NO | 0 | Territories gained |
| `defender_territory_gained` | INT | NO | 0 | Territories gained |
| `attacker_battles_won` | INT | NO | 0 | Battles won |
| `defender_battles_won` | INT | NO | 0 | Battles won |
| `winner_clan_id` | VARCHAR(24) | YES | NULL | Winning clan |

**Indexes**:
- PRIMARY `id`
- UNIQUE `war_id`
- INDEX `attacker_clan_id`
- INDEX `defender_clan_id`
- INDEX `status`

---

## 5. `clan_invitations` Collection → `clan_invitations` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `clan_name` | VARCHAR(30) | NO | — | Display name |
| `inviter_id` | VARCHAR(20) | NO | — | FK → players.username |
| `inviter_username` | VARCHAR(20) | NO | — | Display name |
| `invitee_id` | VARCHAR(20) | NO | — | FK → players.username |
| `invitee_username` | VARCHAR(20) | NO | — | Display name |
| `created_at` | DATETIME | NO | — | Invitation time |
| `expires_at` | DATETIME | NO | — | Expiry (7 days) |
| `status` | ENUM | NO | 'pending' | pending/accepted/declined/expired |
| `accepted_at` | DATETIME | YES | NULL | Acceptance time |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `invitee_id`
- INDEX `status`
- INDEX `expires_at` (TTL-like for cleanup)

---

## 6. `clan_activities` Collection → `clan_activities` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `activity_type` | ENUM | NO | — | ClanActivityType enum |
| `player_id` | VARCHAR(20) | YES | NULL | FK → players.username |
| `username` | VARCHAR(20) | YES | NULL | Display name |
| `details` | JSON | NO | '{}' | Activity-specific data |
| `timestamp` | DATETIME | NO | — | Activity time |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `timestamp`
- INDEX `activity_type`

---

## 7. `clan_chat` Collection → `clan_chat` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `sender_id` | VARCHAR(20) | NO | — | FK → players.username |
| `sender_role` | VARCHAR(20) | NO | — | Role at time of message |
| `message` | VARCHAR(500) | NO | — | Message content |
| `channel` | ENUM | NO | 'general' | general/officer/leader |
| `timestamp` | DATETIME | NO | — | Send time |
| `deleted` | TINYINT(1) | YES | 0 | Soft delete |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `timestamp`
- INDEX `channel`
- TTL-like: cleanup after 7 days (CHAT_RETENTION_DAYS)

---

## 8. `conversations` Collection → `conversations` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `participant_1` | VARCHAR(20) | NO | — | FK → players.username (sorted) |
| `participant_2` | VARCHAR(20) | NO | — | FK → players.username (sorted) |
| `last_message_content` | VARCHAR(1000) | YES | NULL | Last message text |
| `last_message_sender` | VARCHAR(20) | YES | NULL | Last sender |
| `last_message_at` | DATETIME | YES | NULL | Last message time |
| `last_message_status` | VARCHAR(20) | YES | NULL | MessageStatus |
| `unread_p1` | INT | NO | 0 | Unread for participant 1 |
| `unread_p2` | INT | NO | 0 | Unread for participant 2 |
| `created_at` | DATETIME | NO | — | Creation time |
| `updated_at` | DATETIME | NO | — | Last activity |
| `archived_p1` | TINYINT(1) | YES | 0 | Archive for p1 |
| `archived_p2` | TINYINT(1) | YES | 0 | Archive for p2 |
| `pinned_p1` | TINYINT(1) | YES | 0 | Pin for p1 |
| `pinned_p2` | TINYINT(1) | YES | 0 | Pin for p2 |
| `total_messages` | INT | YES | NULL | Message count |
| `first_message_at` | DATETIME | YES | NULL | First message time |
| `mute_until_p1` | DATETIME | YES | NULL | Mute for p1 |
| `mute_until_p2` | DATETIME | YES | NULL | Mute for p2 |

**Indexes**:
- PRIMARY `id`
- UNIQUE `(participant_1, participant_2)`
- INDEX `participant_1`
- INDEX `participant_2`
- INDEX `updated_at`

---

## 9. `messages` Collection → `messages` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `conversation_id` | VARCHAR(24) | NO | — | FK → conversations.id |
| `sender_id` | VARCHAR(20) | NO | — | FK → players.username |
| `recipient_id` | VARCHAR(20) | NO | — | FK → players.username |
| `content` | VARCHAR(1000) | NO | — | Message text (filtered) |
| `content_type` | ENUM | NO | 'text' | text/system/notification |
| `status` | ENUM | NO | 'sent' | sending/sent/delivered/read/failed |
| `created_at` | DATETIME | NO | — | Creation time |
| `read_at` | DATETIME | YES | NULL | Read timestamp |
| `edited_at` | DATETIME | YES | NULL | Edit timestamp |
| `deleted_at` | DATETIME | YES | NULL | Soft delete |
| `original_content` | VARCHAR(1000) | YES | NULL | Before profanity filter |
| `system_type` | VARCHAR(20) | YES | NULL | achievement/battle/trade |
| `related_entity_id` | VARCHAR(50) | YES | NULL | Linked entity |

**Indexes**:
- PRIMARY `id`
- INDEX `conversation_id`
- INDEX `sender_id`
- INDEX `recipient_id`
- INDEX `created_at`
- INDEX `status`

---

## 10. `chat_messages` Collection → `chat_messages` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `channel_id` | VARCHAR(50) | NO | — | Channel identifier |
| `clan_id` | VARCHAR(24) | YES | NULL | FK → clans.id (if clan channel) |
| `sender_id` | VARCHAR(20) | NO | — | FK → players.username |
| `sender_username` | VARCHAR(20) | NO | — | Display name |
| `sender_level` | INT | NO | 0 | Level at send time |
| `is_vip` | TINYINT(1) | NO | 0 | VIP flag |
| `is_newbie` | TINYINT(1) | NO | 0 | Level 1-5 flag |
| `message` | VARCHAR(1000) | NO | — | Message content |
| `item_links` | JSON | YES | '[]' | [ItemName] references |
| `mentions` | JSON | YES | '[]' | @username references |
| `timestamp` | DATETIME | NO | — | Send time |
| `month_category` | VARCHAR(7) | NO | — | "YYYY-MM" for cleanup |
| `edited` | TINYINT(1) | NO | 0 | Edited flag |
| `edited_at` | DATETIME | YES | NULL | Edit time |
| `deleted` | TINYINT(1) | NO | 0 | Soft delete |
| `deleted_by` | VARCHAR(20) | YES | NULL | Admin who deleted |
| `deletion_reason` | TEXT | YES | NULL | Reason |

**Indexes**:
- PRIMARY `id`
- INDEX `(channel_id, timestamp)` — composite
- INDEX `month_category` — for cleanup
- INDEX `sender_id`
- INDEX `clan_id` (sparse)
- TTL-like: purge after 365 days (RETENTION_DAYS)

---

## 11. `chat_read_status` Collection → `chat_read_status` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `channel_id` | VARCHAR(50) | NO | — | Channel |
| `last_read_at` | DATETIME | NO | — | Last read timestamp |

**Indexes**:
- PRIMARY `id`
- UNIQUE `(player_id, channel_id)`

---

## 12. `word_blacklist` Collection → `word_blacklist` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `word` | VARCHAR(100) | NO | — | Blacklisted word |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Added time |
| `added_by` | VARCHAR(20) | YES | NULL | Admin who added |

**Indexes**:
- PRIMARY `id`
- UNIQUE `word`

---

## 13. `friends` Collection → `friends` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `user_id` | VARCHAR(20) | NO | — | FK → players.username |
| `friend_id` | VARCHAR(20) | NO | — | FK → players.username |
| `status` | ENUM | NO | — | ACCEPTED/BLOCKED |
| `initiated_by` | VARCHAR(20) | NO | — | Who started |
| `is_blocked` | TINYINT(1) | YES | 0 | Block flag |
| `blocked_by` | VARCHAR(20) | YES | NULL | Who blocked |
| `created_at` | DATETIME | NO | — | Relationship start |
| `updated_at` | DATETIME | NO | — | Last update |

**Indexes**:
- PRIMARY `id`
- UNIQUE `(user_id, friend_id, status)`
- INDEX `(friend_id, user_id, status)` — bidirectional query
- INDEX `(status, created_at)`

---

## 14. `friendRequests` Collection → `friend_requests` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `from_user` | VARCHAR(20) | NO | — | FK → players.username |
| `to_user` | VARCHAR(20) | NO | — | FK → players.username |
| `status` | ENUM | NO | 'pending' | pending/accepted/declined/cancelled |
| `message` | VARCHAR(200) | YES | NULL | Intro message |
| `created_at` | DATETIME | NO | — | Request time |
| `responded_at` | DATETIME | YES | NULL | Response time |
| `expires_at` | DATETIME | NO | — | Expiry (30 days) |

**Indexes**:
- PRIMARY `id`
- UNIQUE `(from_user, to_user, status)` — for pending
- INDEX `(to_user, status, created_at)`
- INDEX `expires_at` (TTL cleanup)

---

## 15. `battleLogs` Collection → `battle_logs` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `battle_id` | VARCHAR(50) | NO | — | PK |
| `battle_type` | ENUM | NO | — | Infantry/Base/Factory |
| `timestamp` | DATETIME | NO | — | Battle time |
| `attacker_username` | VARCHAR(20) | NO | — | FK → players.username |
| `attacker_str` | INT | NO | 0 | Attacker STR |
| `attacker_def` | INT | NO | 0 | Attacker DEF |
| `attacker_initial_hp` | INT | NO | 0 | Starting HP |
| `attacker_final_hp` | INT | NO | 0 | Ending HP |
| `attacker_units_lost` | INT | NO | 0 | Casualties |
| `attacker_units_captured` | INT | NO | 0 | Units captured |
| `attacker_damage_dealt` | INT | NO | 0 | Total damage |
| `attacker_xp` | INT | NO | 0 | XP earned |
| `defender_username` | VARCHAR(20) | NO | — | FK → players.username |
| `defender_str` | INT | NO | 0 | Defender STR |
| `defender_def` | INT | NO | 0 | Defender DEF |
| `defender_initial_hp` | INT | NO | 0 | Starting HP |
| `defender_final_hp` | INT | NO | 0 | Ending HP |
| `defender_units_lost` | INT | NO | 0 | Casualties |
| `defender_units_captured` | INT | NO | 0 | Units captured |
| `defender_damage_dealt` | INT | NO | 0 | Total damage |
| `defender_xp` | INT | NO | 0 | XP earned |
| `outcome` | ENUM | NO | — | AttackerWin/DefenderWin/Draw |
| `total_rounds` | INT | NO | 0 | Battle rounds |
| `location_x` | INT | YES | NULL | Battle location |
| `location_y` | INT | YES | NULL | Battle location |
| `stolen_resource_type` | VARCHAR(20) | YES | NULL | metal/energy |
| `stolen_resource_amount` | BIGINT | YES | NULL | Amount stolen |
| `rounds_data` | JSON | YES | NULL | CombatRound[] array |
| `attacker_units_data` | JSON | YES | NULL | Unit[] array (snapshot) |
| `defender_units_data` | JSON | YES | NULL | Unit[] array (snapshot) |
| `attacker_captured_units` | JSON | YES | NULL | Captured Unit[] |
| `defender_captured_units` | JSON | YES | NULL | Captured Unit[] |

**Indexes**:
- PRIMARY `battle_id`
- INDEX `attacker_username`
- INDEX `defender_username`
- INDEX `timestamp`
- INDEX `battle_type`
- INDEX `outcome`

---

## 16. `referrals` Collection → `referrals` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `referrer_code` | VARCHAR(20) | NO | — | Code used |
| `referrer_username` | VARCHAR(20) | NO | — | FK → players.username |
| `referrer_player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `new_player_username` | VARCHAR(20) | NO | — | New player |
| `new_player_email` | VARCHAR(255) | NO | — | For duplicate check |
| `new_player_ip` | VARCHAR(45) | NO | — | Abuse detection |
| `signup_date` | DATETIME | NO | — | Registration time |
| `validation_date` | DATETIME | YES | NULL | 7-day validation |
| `validated` | TINYINT(1) | NO | 0 | Validated flag |
| `login_count` | INT | NO | 0 | Login count |
| `last_login` | DATETIME | YES | NULL | Last login |
| `days_active` | INT | NO | 0 | Days since signup |
| `rewards_claimed` | TINYINT(1) | NO | 0 | Rewards claimed |
| `reward_metal` | BIGINT | NO | 0 | Metal reward |
| `reward_energy` | BIGINT | NO | 0 | Energy reward |
| `reward_rp` | INT | NO | 0 | RP reward |
| `reward_xp` | INT | NO | 0 | XP reward |
| `reward_vip_days` | INT | NO | 0 | VIP days |
| `reward_special` | VARCHAR(100) | YES | NULL | Special reward |
| `reward_milestone` | INT | YES | NULL | Milestone number |
| `welcome_given` | TINYINT(1) | NO | 0 | Welcome package given |
| `flagged_for_abuse` | TINYINT(1) | NO | 0 | Abuse flag |
| `flag_reason` | TEXT | YES | NULL | Flag reason |
| `admin_notes` | TEXT | YES | NULL | Admin notes |
| `created_at` | DATETIME | NO | — | Record creation |
| `updated_at` | DATETIME | NO | — | Last update |

**Indexes**:
- PRIMARY `id`
- INDEX `referrer_code`
- INDEX `referrer_username`
- INDEX `new_player_username`
- INDEX `validated`
- INDEX `signup_date`

---

## 17. `tutorial_progress` Collection → `tutorial_progress` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `current_quest_id` | VARCHAR(50) | YES | NULL | Active quest |
| `current_step_index` | INT | NO | 0 | Current step (0-indexed) |
| `completed_quests` | JSON | YES | '[]' | Completed quest IDs |
| `completed_steps` | JSON | YES | '[]' | Completed step IDs |
| `skipped_quests` | JSON | YES | '[]' | Skipped quest IDs |
| `claimed_rewards` | JSON | YES | '[]' | Claimed reward IDs |
| `tutorial_skipped` | TINYINT(1) | NO | 0 | Skipped entire tutorial |
| `tutorial_declined` | TINYINT(1) | YES | 0 | Permanently declined |
| `tutorial_complete` | TINYINT(1) | NO | 0 | All mandatory done |
| `started_at` | DATETIME | NO | — | Tutorial start |
| `current_step_started_at` | DATETIME | YES | NULL | Current step start |
| `completed_at` | DATETIME | YES | NULL | Completion time |
| `declined_at` | DATETIME | YES | NULL | Decline time |
| `last_updated` | DATETIME | NO | — | Last update |
| `total_steps_completed` | INT | NO | 0 | Progress metric |
| `total_time_spent` | INT | NO | 0 | Seconds spent |

**Indexes**:
- PRIMARY `id`
- UNIQUE `player_id`
- INDEX `tutorial_complete`
- INDEX `tutorial_skipped`

---

## 18. `tutorial_action_tracking` Collection → `tutorial_action_tracking` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `action_type` | VARCHAR(50) | NO | — | MOVE/HARVEST/ATTACK/etc |
| `action_data` | JSON | YES | NULL | Action-specific data |
| `timestamp` | DATETIME | NO | — | Action time |

**Indexes**:
- PRIMARY `id`
- INDEX `player_id`
- INDEX `action_type`
- INDEX `timestamp`

---

## 19. `missiles` Collection → `missiles` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `owner_id` | VARCHAR(20) | NO | — | FK → players.username |
| `owner_clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `warhead_type` | ENUM | NO | — | TACTICAL/STRATEGIC/NEUTRON/CLUSTER/CLAN_BUSTER |
| `status` | ENUM | NO | — | ASSEMBLING/READY/LAUNCHED/INTERCEPTED/DETONATED/DISMANTLED |
| `component_warhead` | TINYINT(1) | NO | 0 | Component acquired |
| `component_propulsion` | TINYINT(1) | NO | 0 | Component acquired |
| `component_guidance` | TINYINT(1) | NO | 0 | Component acquired |
| `component_payload` | TINYINT(1) | NO | 0 | Component acquired |
| `component_stealth` | TINYINT(1) | NO | 0 | Component acquired |
| `target_id` | VARCHAR(50) | YES | NULL | Primary target |
| `target_type` | VARCHAR(10) | YES | NULL | player/clan |
| `secondary_targets` | JSON | YES | NULL | Additional targets |
| `launched_at` | DATETIME | YES | NULL | Launch time |
| `launched_by` | VARCHAR(20) | YES | NULL | Who launched |
| `impact_at` | DATETIME | YES | NULL | Calculated impact |
| `flight_time` | BIGINT | YES | NULL | Milliseconds |
| `intercept_attempts` | INT | YES | 0 | Intercept attempts |
| `intercepted_by` | VARCHAR(50) | YES | NULL | Who intercepted |
| `intercepted_at` | DATETIME | YES | NULL | Intercept time |
| `damage_dealt_data` | JSON | YES | NULL | DamageDistribution |
| `created_at` | DATETIME | NO | — | Creation time |
| `completed_at` | DATETIME | YES | NULL | Assembly complete |
| `updated_at` | DATETIME | NO | — | Last update |

**Indexes**:
- PRIMARY `id`
- INDEX `owner_id`
- INDEX `owner_clan_id`
- INDEX `status`
- INDEX `warhead_type`
- INDEX `target_id`

---

## 20. `player_research` Collection → `player_research` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `player_username` | VARCHAR(20) | NO | — | Display name |
| `clan_id` | VARCHAR(24) | YES | NULL | FK → clans.id |
| `missile_tier` | INT | NO | 0 | 0-10 |
| `defense_tier` | INT | NO | 0 | 0-10 |
| `intelligence_tier` | INT | NO | 0 | 0-10 |
| `total_rp_spent` | INT | NO | 0 | Total RP invested |
| `total_techs_unlocked` | INT | NO | 0 | Tech count |
| `clan_research_bonus` | DECIMAL(5,2) | NO | 0 | % bonus from clan |
| `current_research_tech` | VARCHAR(50) | YES | NULL | Active tech |
| `current_research_started` | DATETIME | YES | NULL | Start time |
| `current_research_rp_spent` | INT | YES | 0 | RP spent on current |
| `current_research_rp_required` | INT | YES | 0 | RP needed |
| `current_research_progress` | DECIMAL(5,2) | YES | 0 | 0-100% |
| `updated_at` | DATETIME | NO | — | Last update |

**Indexes**:
- PRIMARY `id`
- UNIQUE `player_id`
- INDEX `clan_id`

---

## 20a. `player_research_techs` Table (extracted from completedTechs/availableTechs/lockedTechs arrays)

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | BIGINT AUTO_INCREMENT | NO | — | PK |
| `player_research_id` | VARCHAR(24) | NO | — | FK → player_research.id |
| `tech_id` | VARCHAR(50) | NO | — | Tech identifier |
| `status` | ENUM | NO | — | completed/available/locked |

**Indexes**:
- PRIMARY `id`
- UNIQUE `(player_research_id, tech_id)`
- INDEX `tech_id`
- INDEX `status`

---

## 21. `flags` Collection → `flags` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK (singleton, only 1 row) |
| `current_holder_id` | VARCHAR(20) | YES | NULL | FK → players.username |
| `current_holder_username` | VARCHAR(20) | YES | NULL | Display name |
| `captured_at` | DATETIME | YES | NULL | Capture time |
| `location_x` | INT | YES | NULL | Current tile X |
| `location_y` | INT | YES | NULL | Current tile Y |

**Indexes**:
- PRIMARY `id`
- INDEX `current_holder_id`

---

## 22. `items` Collection → `items` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `name` | VARCHAR(100) | NO | — | Item name (unique) |
| `type` | ENUM | NO | — | METAL_DIGGER/ENERGY_DIGGER/UNIVERSAL_DIGGER/TRADEABLE_ITEM |
| `description` | TEXT | YES | NULL | Item description |
| `rarity` | ENUM | NO | — | COMMON/UNCOMMON/RARE/EPIC/LEGENDARY |
| `bonus_percent` | DECIMAL(5,2) | NO | 0 | Permanent bonus % |
| `bonus_value` | INT | YES | NULL | Display value |
| `tradeable` | TINYINT(1) | NO | 0 | Can be traded |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Creation time |

**Indexes**:
- PRIMARY `id`
- UNIQUE `name`
- INDEX `type`
- INDEX `rarity`

---

## 23. `playerSessions` Collection → `player_sessions` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `token` | VARCHAR(500) | NO | — | JWT or session token |
| `ip_address` | VARCHAR(45) | YES | NULL | Session IP |
| `user_agent` | VARCHAR(500) | YES | NULL | Browser info |
| `created_at` | DATETIME | NO | — | Session start |
| `expires_at` | DATETIME | NO | — | Session expiry |
| `last_active` | DATETIME | NO | — | Last activity |

**Indexes**:
- PRIMARY `id`
- INDEX `player_id`
- INDEX `expires_at` (TTL cleanup)
- INDEX `token` (unique if applicable)

---

## 24. `playerActivity` Collection → `player_activity` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `action` | VARCHAR(50) | NO | — | Action type |
| `action_data` | JSON | YES | NULL | Action details |
| `ip_address` | VARCHAR(45) | YES | NULL | Action IP |
| `timestamp` | DATETIME | NO | — | Action time |

**Indexes**:
- PRIMARY `id`
- INDEX `player_id`
- INDEX `action`
- INDEX `timestamp`

---

## 25. `playerFlags` Collection → `player_flags` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `player_id` | VARCHAR(20) | NO | — | FK → players.username |
| `flag_type` | VARCHAR(50) | NO | — | Flag type |
| `flag_value` | VARCHAR(255) | YES | NULL | Flag value |
| `created_at` | DATETIME | NO | — | Flag creation |
| `expires_at` | DATETIME | YES | NULL | Flag expiry |

**Indexes**:
- PRIMARY `id`
- INDEX `player_id`
- INDEX `flag_type`

---

## 26. `migrations` Collection → `migrations` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `name` | VARCHAR(255) | NO | — | Migration name |
| `executed_at` | DATETIME | NO | — | Execution time |
| `status` | VARCHAR(20) | NO | 'completed' | Status |

**Indexes**:
- PRIMARY `id`
- UNIQUE `name`

---

## 27. `clan_messages` Collection → `clan_messages` Table

| Column | MariaDB Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | VARCHAR(24) | NO | — | PK |
| `clan_id` | VARCHAR(24) | NO | — | FK → clans.id |
| `sender_id` | VARCHAR(20) | NO | — | FK → players.username |
| `message` | TEXT | NO | — | Message content |
| `timestamp` | DATETIME | NO | — | Send time |

**Indexes**:
- PRIMARY `id`
- INDEX `clan_id`
- INDEX `timestamp`

---

## Relationships Diagram

```
players (username) PK
  ├── 1:N → harvest_records (player_id)
  ├── 1:N → friends (user_id, friend_id)
  ├── 1:N → friend_requests (from_user, to_user)
  ├── 1:N → battle_logs (attacker/defender username)
  ├── 1:N → clan_members (player_id)
  ├── 1:N → referrals (referrer_player_id, new_player_username)
  ├── 1:1 → tutorial_progress (player_id)
  ├── 1:1 → player_research (player_id)
  ├── 1:N → missiles (owner_id)
  ├── 1:N → clan_invitations (inviter_id, invitee_id)
  ├── 1:N → clan_activities (player_id)
  ├── 1:N → clan_chat (sender_id)
  ├── 1:N → chat_messages (sender_id)
  ├── 1:N → messages (sender_id, recipient_id)
  ├── 1:N → player_sessions (player_id)
  ├── 1:N → player_activity (player_id)
  ├── 1:N → player_flags (player_id)
  ├── N:1 → clans (clan_id) FK
  └── N:1 → flags (current_holder_id) FK

clans (id) PK
  ├── 1:N → clan_members (clan_id)
  ├── 1:N → clan_perks (clan_id)
  ├── 1:N → clan_territories (clan_id)
  ├── 1:N → clan_monuments (clan_id)
  ├── 1:N → clan_bank_transactions (clan_id)
  ├── 1:N → clan_wars (attacker/defender clan_id)
  ├── 1:N → clan_invitations (clan_id)
  ├── 1:N → clan_activities (clan_id)
  ├── 1:N → clan_chat (clan_id)
  ├── 1:N → clan_messages (clan_id)
  └── 1:N → player_research (clan_id)

tiles (x, y) PK
  ├── 1:N → harvest_records (tile_x, tile_y)
  └── 1:N → clan_territories (tile_x, tile_y)

factories (x, y) PK
  └── N:1 → players (owner) FK

conversations (id) PK
  ├── N:2 → players (participant_1, participant_2)
  └── 1:N → messages (conversation_id)
```

---

## Special Patterns

### TTL Indexes (MongoDB → MariaDB Events)
| Collection | MongoDB TTL Field | MariaDB Approach |
|---|---|---|
| `friendRequests` | `expiresAt` (30 days) | Event: DELETE WHERE expires_at < NOW() |
| `chat_messages` | `timestamp` (365 days) | Event: DELETE WHERE timestamp < NOW() - INTERVAL 365 DAY |
| `clan_chat` | `timestamp` (7 days) | Event: DELETE WHERE timestamp < NOW() - INTERVAL 7 DAY |
| `playerSessions` | `expires_at` | Event: DELETE WHERE expires_at < NOW() |
| `clan_invitations` | `expiresAt` (7 days) | Event: DELETE WHERE expires_at < NOW() |

### Compound Indexes
| Table | Columns | Purpose |
|---|---|---|
| `chat_messages` | `(channel_id, timestamp DESC)` | Message history queries |
| `friends` | `(user_id, friend_id, status)` | Bidirectional friend lookups |
| `friend_requests` | `(from_user, to_user, status)` | Duplicate request prevention |
| `friend_requests` | `(to_user, status, created_at DESC)` | Pending requests for user |
| `battle_logs` | `(attacker_username, timestamp DESC)` | Player combat history |
| `battle_logs` | `(defender_username, timestamp DESC)` | Player combat history |

### ENUM Types to Create in MariaDB

```sql
CREATE TYPE terrain_type AS ENUM ('Metal','Energy','Cave','Forest','Factory','Wasteland','Bank','Shrine','AuctionHouse');
CREATE TYPE clan_role AS ENUM ('LEADER','CO_LEADER','OFFICER','ELITE','MEMBER','RECRUIT');
CREATE TYPE friend_status AS ENUM ('ACCEPTED','BLOCKED');
CREATE TYPE friend_request_status AS ENUM ('pending','accepted','declined','cancelled');
CREATE TYPE message_status AS ENUM ('sending','sent','delivered','read','failed');
CREATE TYPE message_content_type AS ENUM ('text','system','notification');
CREATE TYPE chat_channel AS ENUM ('general','officer','leader');
CREATE TYPE battle_type AS ENUM ('Infantry','Base','Factory');
CREATE TYPE battle_outcome AS ENUM ('AttackerWin','DefenderWin','Draw');
CREATE TYPE war_status AS ENUM ('DECLARED','ACTIVE','ENDED','TRUCE');
CREATE TYPE missile_status AS ENUM ('ASSEMBLING','READY','LAUNCHED','INTERCEPTED','DETONATED','DISMANTLED');
CREATE TYPE warhead_type AS ENUM ('TACTICAL','STRATEGIC','NEUTRON','CLUSTER','CLAN_BUSTER');
CREATE TYPE item_type AS ENUM ('METAL_DIGGER','ENERGY_DIGGER','UNIVERSAL_DIGGER','TRADEABLE_ITEM');
CREATE TYPE item_rarity AS ENUM ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY');
CREATE TYPE monument_type AS ENUM ('ANCIENT_FORGE','WAR_MEMORIAL','MARKET_PLAZA','RESEARCH_LAB','GRAND_TEMPLE');
CREATE TYPE bank_transaction_type AS ENUM ('DEPOSIT','WITHDRAWAL','TAX_COLLECTION','RESEARCH_SPENDING','PERK_ACTIVATION','BANK_UPGRADE');
CREATE TYPE clan_activity_type AS ENUM (...); -- all ClanActivityType values
CREATE TYPE perk_category AS ENUM ('COMBAT','ECONOMIC','SOCIAL','STRATEGIC');
CREATE TYPE perk_tier AS ENUM ('BRONZE','SILVER','GOLD','LEGENDARY');
CREATE TYPE territory_type AS ENUM ('STANDARD','MONUMENT','STRONGHOLD');
```

---

## Migration Notes

1. **ObjectId → VARCHAR(24)**: All MongoDB `_id` ObjectId fields become 24-character hex strings in MariaDB.

2. **Embedded Arrays → Child Tables**: MongoDB embedded arrays (members, territories, perks, transactions, wars, harvest records) are extracted into separate relational tables with foreign keys.

3. **Embedded Objects → Flattened Columns**: Nested objects like `Position {x, y}`, `Resources {metal, energy}`, `BankStorage`, `BotConfig`, `Specialization`, `PlayerStats`, `BattleStatistics` are flattened into prefixed column names.

4. **JSON Columns**: Arrays that are frequently read as a whole but rarely queried individually (e.g., `unlocked_techs`, `concentration_zones`, `referral_titles`, `referral_badges`, `rounds_data`, `item_links`, `mentions`) are stored as JSON columns.

5. **Denormalized Fields**: `clanName`, `clanRole`, `clanLevel` on players table are kept as denormalized fields for quick access (matching MongoDB pattern).

6. **Battle Log Unit Data**: The `battleLogs` collection stores full unit snapshots as JSON since battle logs are append-only historical records that need full unit state preservation.

7. **Primary Key Strategy**: Where MongoDB used `username` as the natural key (players), it remains the PK. Where ObjectId was used, it's converted to VARCHAR(24). Composite keys (tiles, factories) remain composite.

8. **Auto-increment IDs**: For child tables extracted from arrays, MariaDB `BIGINT AUTO_INCREMENT` is used for surrogate keys since the original MongoDB `_id` was generated at insert time.
