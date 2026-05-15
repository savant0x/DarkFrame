/**
 * @file game.types.ts
 * @created 2025-10-16
 * @updated 2026-05-11 — FID-20260511-FACTORY-UNIT-REDESIGN
 * @overview Core TypeScript type definitions for DarkFrame game domain model
 *
 * OVERVIEW:
 * Defines all core game entities including terrain types, tiles, players, positions,
 * movement directions, and resources. These types are used throughout the application
 * for type safety and data validation.
 *
 * FID-20260511-FACTORY-UNIT-REDESIGN CHANGES:
 * - Reduced UNIT_CONFIGS from 65 bloated types to 20 focused units (4 archetypes × 5 tiers)
 * - Added UnitArchetype type: STRIKER | BULWARK | ARTILLERY | SUPPORT
 * - Added archetype field to UnitConfig and PlayerUnit (replaced category 'STR'|'DEF')
 * - Orthogonal cost scaling: higher tiers = more slot-efficient, less resource-efficient
 * - Intransitive combat: Striker > Bulwark > Artillery > Support > Striker
 * - UnitType now derived from Database['public']['Enums']['unit_type'] for exact DB match
 */

import type { Database } from '@/types/database';


/**
 * Terrain types available in the game world
 * 
 * Distribution across 150×150 map (22,500 total tiles):
 * - Metal: 4,500 tiles (20%)
 * - Energy: 4,500 tiles (20%)
 * - Cave: 1,800 tiles (8%)
 * - Forest: 450 tiles (2%) - Better loot than caves
 * - Factory: 2,250 tiles (10%)
 * - Wasteland: 8,500 tiles (38%)
 * - Bank: 4 fixed locations (Phase 3+)
 * - Shrine: 1 fixed location at (1,1) (Phase 3+)
 * - AuctionHouse: 1 fixed location at (10,10) for trading
 * 
 * Note: Beer Bases are NOT terrain tiles - they are special bots with isSpecialBase flag
 */
export enum TerrainType {
  Metal = 'Metal',
  Energy = 'Energy',
  Cave = 'Cave',
  Forest = 'Forest',
  Factory = 'Factory',
  Wasteland = 'Wasteland',
  Bank = 'Bank',
  Shrine = 'Shrine',
  AuctionHouse = 'AuctionHouse'
}

/**
 * Position coordinates on the game map
 * 
 * @property x - Horizontal coordinate (1-150)
 * @property y - Vertical coordinate (1-150)
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Bank types for different bank locations
 */
export type BankType = 'metal' | 'energy' | 'exchange';

/**
 * Tile entity representing a single map location
 * 
 * @property x - Horizontal coordinate (1-150)
 * @property y - Vertical coordinate (1-150)
 * @property terrain - Type of terrain for this tile
 * @property occupiedByBase - Optional flag indicating if a player base is present
 * @property baseOwner - Username of the player who owns the base (if occupiedByBase is true)
 * @property lastHarvestedBy - Array tracking which players have harvested this tile in current reset period
 * @property bankType - Bank type if terrain is Bank (Phase 3+)
 * @property hasFlagBearer - Whether the Flag Bearer is currently on this tile
 * @property hasTrail - Whether this tile has Flag Bearer's particle trail (8-minute lingering effect)
 * @property trailTimestamp - When the trail was left on this tile (for fade calculations)
 * @property trailExpiresAt - When the trail will expire from this tile
 */
export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  occupiedByBase?: boolean;
  baseOwner?: string;
  baseGreeting?: string;
  lastHarvestedBy?: HarvestRecord[];
  bankType?: BankType;
  hasFlagBearer?: boolean;
  hasTrail?: boolean;
  trailTimestamp?: Date;
  trailExpiresAt?: Date;
  botAtLocation?: {
    username: string;
    isBeerBase: boolean;
    tier?: string;
    specialization?: string;
    strength?: number;
    defense?: number;
    resources?: { metal: number; energy: number };
  };
}

/**
 * Harvest record tracking per-player harvests with reset period
 * 
 * @property playerId - Player's unique username
 * @property timestamp - When the harvest occurred
 * @property resetPeriod - Reset period identifier (e.g., "2025-10-16-AM" or "2025-10-16-PM")
 */
export interface HarvestRecord {
  playerId: string;
  harvestedAt: string;
}

/**
 * Resource tracking for player inventory
 * 
 * @property metal - Amount of metal resource
 * @property energy - Amount of energy resource
 */
export interface Resources {
  metal: number;
  energy: number;
}

/**
 * Player entity with all player-related data
 * 
 * @property username - Unique player identifier
 * @property email - Player's email address for login
 * @property password - Hashed password (bcrypt)
 * @property base - Permanent base location (spawn point)
 * @property currentPosition - Current location on the map
 * @property resources - Resource inventory
 * @property bank - Banked resources (safe storage)
 * @property rank - Player rank/level (1-6+) for base visuals
 * @property inventory - Player's collected items from cave exploration
 * @property gatheringBonus - Permanent gathering boost from digger items
 * @property activeBoosts - Temporary boosts from trading items (DEPRECATED: use shrineBoosts)
 * @property shrineBoosts - Active shrine boosts for resource yield
 * @property units - Army units owned by player
 * @property totalStrength - Total offensive power (sum of all unit STR)
 * @property totalDefense - Total defensive power (sum of all unit DEF)
 * @property createdAt - Account creation timestamp
 */
/**
 * Army balance effects and penalties/bonuses
 * Calculated based on STR/DEF ratio to encourage balanced armies
 */
export type BalanceStatus = 'CRITICAL' | 'IMBALANCED' | 'BALANCED' | 'OPTIMAL';

export interface BalanceEffects {
  ratio: number;
  status: BalanceStatus;
  powerMultiplier: number;          // Applied to total power (0.5 to 1.1)
  damageTakenMultiplier: number;    // Multiplier for incoming damage (0.95 to 1.3)
  damageDealtMultiplier: number;    // Multiplier for outgoing damage (0.8 to 1.05)
  gatheringMultiplier: number;      // Applied to resource gathering (0.75 to 1.1)
  slotRegenMultiplier: number;      // Applied to slot regeneration (0.85 to 1.0)
  effectivePower: number;           // Final power after balance multiplier
  warnings: string[];               // Active penalty messages
  bonuses: string[];                // Active bonus messages
  recommendation?: string;          // How to improve balance
}

/**
 * Specialization doctrine types for player progression paths
 */
export enum SpecializationDoctrine {
  None = 'none',
  Offensive = 'offensive',
  Defensive = 'defensive',
  Tactical = 'tactical'
}

/**
 * Discovery category types for ancient technologies
 */
export enum DiscoveryCategory {
  Industrial = 'industrial',
  Combat = 'combat',
  Strategic = 'strategic'
}

/**
 * Ancient technology discovery
 * 
 * @property id - Unique discovery identifier (e.g., 'AUTO_HARVESTER')
 * @property name - Display name of the technology
 * @property category - Category classification
 * @property description - Detailed description of the technology
 * @property bonus - Human-readable bonus description
 * @property discoveredAt - When the technology was discovered
 * @property discoveredInCave - Cave location where it was found
 */
export interface Discovery {
  id: string;
  name: string;
  category: DiscoveryCategory;
  description: string;
  bonus: string;
  discoveredAt: Date;
  discoveredInCave: { x: number; y: number };
}

/**
 * Specialization data structure for player doctrine tracking
 * 
 * @property doctrine - Selected specialization path
 * @property selectedAt - When specialization was chosen
 * @property masteryLevel - Mastery progression (0-100%)
 * @property masteryXP - XP toward next mastery level
 * @property totalUnitsBuilt - Count of specialized units built
 * @property totalBattlesWon - Battles won with specialized units
 * @property respecHistory - History of respec changes
 * @property lastRespecAt - Last respec timestamp (for cooldown)
 */
export interface Specialization {
  doctrine: SpecializationDoctrine;
  selectedAt: Date;
  masteryLevel: number; // 0-100
  masteryXP: number;
  totalUnitsBuilt: number;
  totalBattlesWon: number;
  respecHistory: Array<{
    fromDoctrine: SpecializationDoctrine;
    toDoctrine: SpecializationDoctrine;
    timestamp: Date;
    rpSpent: number;
    resourcesSpent: { metal: number; energy: number };
  }>;
  lastRespecAt: Date | null;
}

/**
 * Achievement category types
 */
export enum AchievementCategory {
  Combat = 'combat',
  Economic = 'economic',
  Exploration = 'exploration',
  Progression = 'progression'
}

/**
 * Achievement rarity/difficulty
 */
export enum AchievementRarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary'
}

/**
 * Achievement unlock with prestige unit reward
 * 
 * @property id - Unique achievement identifier
 * @property name - Display name
 * @property description - Achievement requirement description
 * @property category - Achievement category
 * @property rarity - Difficulty tier
 * @property reward - Prestige unit unlocked and RP bonus
 * @property unlockedAt - When achievement was earned
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  requirement: {
    type: string;
    value: number;
  };
  reward: {
    unitUnlock: string;
    rpBonus?: number;
  };
  unlockedAt?: Date;
  progress?: number;
}

/**
 * Player statistics for achievement tracking
 * 
 * @property battlesWon - Total PvP battles won
 * @property totalUnitsBuilt - Total units built across all types
 * @property totalResourcesGathered - Lifetime resources collected
 * @property totalResourcesBanked - Lifetime resources stored in banks
 * @property shrineTradeCount - Number of shrine trades completed
 * @property cavesExplored - Total cave and forest explorations
 */
export interface PlayerStats {
  battlesWon: number;
  totalUnitsBuilt: number;
  totalResourcesGathered: number;
  totalResourcesBanked: number;
  shrineTradeCount: number;
  cavesExplored: number;
}

/**
 * Battle statistics for profile display
 * 
 * @property infantryAttacks - Infantry battle statistics (Player vs Player direct combat)
 * @property baseAttacks - Base attack statistics (future PvP system)
 * @property baseDefenses - Base defense statistics (future PvP system)
 */
export interface BattleStatistics {
  infantryAttacks: { initiated: number; won: number; lost: number };
  baseAttacks: { initiated: number; won: number; lost: number };
  baseDefenses: { total: number; won: number; lost: number };
}

/**
 * Bot specialization types - defines bot behavior and stats
 */
export enum BotSpecialization {
  Hoarder = 'hoarder',        // 25% - High resources, low defense, stationary
  Fortress = 'fortress',      // 20% - High defense, low resources, stationary
  Raider = 'raider',         // 25% - Aggressive, mobile, attacks frequently
  Ghost = 'ghost',           // 15% - Teleports randomly, high resources
  Balanced = 'balanced',     // 15% - Standard stats, moderate movement
  Boss = 'boss'              // 1% - Elite enemy: 200K+ defense, 4M+ resources (NEW: Phase 7)
}

/**
 * Bot reputation tiers based on defeats
 */
export enum BotReputation {
  Unknown = 'unknown',         // 0-5 defeats
  Notorious = 'notorious',     // 6-15 defeats
  Infamous = 'infamous',       // 16-30 defeats
  Legendary = 'legendary'      // 31+ defeats
}

/**
 * Bot configuration for AI-controlled players
 * Full Permanence Model: Bots stay on map, regenerate resources hourly
 * 
 * @property specialization - Bot behavior type (Hoarder/Fortress/Raider/Ghost/Balanced)
 * @property tier - Resource tier (1-3) determining max resources
 * @property lastGrowth - Last time bot's resources grew
 * @property lastResourceRegen - Last time resources regenerated after defeat
 * @property attackCooldown - When bot can attack again
 * @property revengeTarget - Username of player who last defeated this bot (60% chance retaliation)
 * @property isSpecialBase - Is this a Beer Base (3x resources, despawns when defeated)
 * @property lastDefeated - When bot was last defeated (for scanner display)
 * @property defeatedCount - Total times defeated (for reputation system)
 * @property reputation - Current reputation tier (Unknown/Notorious/Infamous/Legendary)
 * @property movement - Movement pattern (stationary/roam/teleport)
 * @property zone - Map zone assignment (0-8 for 9 zones)
 * @property nestAffinity - Which nest this bot is affiliated with (null if not near nest)
 * @property bountyValue - Current bounty reward if targeted
 * @property permanentBase - True (all bots have permanent bases)
 */
export interface BotConfig {
  specialization: BotSpecialization;
  tier: number; // 1-3
  lastGrowth: Date;
  lastResourceRegen?: Date;
  attackCooldown?: Date;
  revengeTarget?: string;
  isSpecialBase: boolean;
  lastDefeated?: Date;
  defeatedCount: number;
  reputation: BotReputation;
  movement: 'stationary' | 'roam' | 'teleport';
  zone: number; // 0-8
  nestAffinity: number | null; // 0-7 for 8 nests
  bountyValue: number;
  permanentBase: boolean;
  summonedBy?: string; // Player who summoned this bot (Bot Summoning Circle)
  summonedAt?: Date; // When this bot was summoned
}

export interface Player {
  username: string;
  email: string;
  password: string; // Hashed with bcrypt
  base: Position;
  currentPosition: Position;
  resources: Resources;
  bank: BankStorage;
  rank?: number; // Player rank for base progression (defaults to 1)
  inventory: PlayerInventory;
  gatheringBonus: GatheringBonus;
  activeBoosts: ActiveBoosts; // DEPRECATED: use shrineBoosts instead
  shrineBoosts: ShrineBoost[];
  units: PlayerUnit[]; // Player's army (simplified unit data)
  totalStrength: number; // Total STR from all units
  totalDefense: number; // Total DEF from all units
  balanceEffects?: BalanceEffects; // Army balance status and multipliers (calculated)
  xp: number; // Total experience points earned
  level: number; // Current level (calculated from XP)
  researchPoints: number; // Research points for unlocking features
  unlockedTiers: UnitTier[]; // Unit tiers unlocked via RP spending
  unlockedTechs?: string[]; // Tech tree unlocks (e.g., 'bot-hunter', 'bot-magnet', 'bot-concentration-zones')
  concentrationZones?: Array<{ centerX: number; centerY: number; size: number; name?: string }>; // Bot spawn zones (max 3, 30×30 each)
  lastBotSummon?: Date; // Last time bots were summoned via Bot Summoning Circle (7-day cooldown)
  fastTravelWaypoints?: Array<{ name: string; x: number; y: number; setAt: Date }>; // Fast travel waypoints (max 5)
  lastFastTravel?: Date; // Last time fast travel was used (12-hour cooldown)
  dailyBounties?: {
    bounties: Array<{
      id: string;
      difficulty: 'easy' | 'medium' | 'hard';
      specialization: 'Hoarder' | 'Fortress' | 'Raider' | 'Balanced' | 'Ghost';
      tier: number;
      defeatsRequired: number;
      currentDefeats: number;
      metalReward: number;
      energyReward: number;
      completed: boolean;
      claimed: boolean;
    }>;
    lastRefresh: Date;
    unclaimedRewards: number;
  }; // Daily bot defeat bounties (3 per day)
  specialization?: Specialization; // Player's specialization doctrine (Level 15+)
  discoveries?: Discovery[]; // Ancient technologies discovered (Phase 2+)
  achievements?: Achievement[]; // Unlocked achievements with prestige units (Phase 3+)
  stats?: PlayerStats; // Gameplay statistics for achievement tracking (Phase 3+)
  factoryCount?: number; // Number of factories owned
  lastXPAward?: Date; // Last time XP was awarded
  lastLevelUp?: Date; // Last time player leveled up
  rpHistory?: ResearchPointHistory[]; // History of RP spending
  baseGreeting?: string; // Custom base greeting message (max 500 chars)
  battleStats?: BattleStatistics; // Combat statistics for profile display
  isBot?: boolean; // Bot player flag (excluded from leaderboards)
  isSpecialBase?: boolean; // Beer Base flag (top-level for easy querying, also in botConfig)
  botConfig?: BotConfig; // Bot-specific configuration (only present if isBot=true)
  clanId?: string; // ID of clan player belongs to (Phase 5-8)
  clanName?: string; // Name of player's clan (denormalized for quick access)
  clanRole?: string; // Player's role in clan (LEADER, CO_LEADER, OFFICER, MEMBER, etc.)
  clanLevel?: number; // Clan's current level (denormalized for quick access)
  isAdmin?: boolean; // Admin access flag (grants access to /admin panel)
  vip?: boolean; // VIP subscription status (premium features: 2x auto-farm speed, etc.)
  is_vip?: boolean; // DB alias for vip status (snake_case for raw Supabase data)
  vipExpiration?: Date; // VIP subscription expiration date
  vip_expiration?: string | null; // DB alias for vip expiration (snake_case for raw Supabase data)
  vipTier?: string; // VIP tier (WEEKLY, MONTHLY, QUARTERLY, BIANNUAL, YEARLY)
  stripeCustomerId?: string; // Stripe customer ID for subscription management
  stripeSubscriptionId?: string; // Stripe subscription ID for tracking
  vipLastUpdated?: Date; // Last time VIP status was updated
  lastLoginDate?: Date; // Last time player logged in (for daily reward tracking)
  loginStreak?: number; // Consecutive days logged in (for streak bonuses)
  lastStreakReward?: Date; // Last time daily login reward was claimed
  currentHP?: number; // Current HP for flag bearer defense (defaults to maxHP)
  maxHP?: number; // Maximum HP for flag bearer defense (defaults to 1000)
  lastFlagAttack?: Date; // Last time player attacked flag bearer (60s cooldown)
  referralCode?: string; // Unique referral code (e.g., "DF-A7K9X2M5")
  referralLink?: string; // Full referral URL
  referredBy?: string | null; // Referral code of player who referred them
  referredByUsername?: string | null; // Username of referrer
  referralValidated?: boolean; // Whether this player's referral validated (if they were referred)
  referralValidatedAt?: Date | null; // When validation occurred
  totalReferrals?: number; // Count of validated referrals (people they referred)
  pendingReferrals?: number; // Count awaiting 7-day validation
  referralRewardsEarned?: {
    metal: number;
    energy: number;
    rp: number;
    xp: number;
    vipDays: number;
  };
  referralTitles?: string[]; // Earned titles from referrals
  referralBadges?: string[]; // Earned badges from referrals
  referralMultiplier?: number; // Admin bonus multiplier (default 1.0)
  lastReferralValidated?: Date | null; // Last time one of their referrals validated
  referralMilestonesReached?: number[]; // Milestones achieved (e.g., [5, 10, 25])
  signupIP?: string; // IP address used during signup (for abuse detection)
  createdAt?: Date;
}

/**
 * Research point spending history
 */
export interface ResearchPointHistory {
  amount: number; // Negative for spending, positive for earning
  reason: string; // What the RP was spent on or earned from
  timestamp: Date;
  balance: number; // RP balance after transaction
}

/**
 * Player inventory system
 * 
 * @property items - Array of collected items
 * @property capacity - Maximum number of items (default: 2000)
 * @property metalDiggerCount - Count of metal diggers collected (for diminishing returns)
 * @property energyDiggerCount - Count of energy diggers collected (for diminishing returns)
 */
export interface PlayerInventory {
  items: InventoryItem[];
  capacity: number;
  metalDiggerCount: number;
  energyDiggerCount: number;
}

/**
 * Permanent gathering bonus from digger items
 * 
 * @property metalBonus - Percentage boost to metal gathering (cumulative from diggers)
 * @property energyBonus - Percentage boost to energy gathering (cumulative from diggers)
 */
export interface GatheringBonus {
  metalBonus: number; // Percentage (e.g., 25 = +25%)
  energyBonus: number; // Percentage (e.g., 30 = +30%)
}

/**
 * Active temporary boosts from trading
 * @deprecated Use shrineBoosts instead for Phase 3+
 * 
 * @property gatheringBoost - Temporary % boost to all gathering
 * @property expiresAt - When the boost expires (null if no boost active)
 */
export interface ActiveBoosts {
  gatheringBoost: number | null; // Percentage (e.g., 50 = +50%)
  expiresAt: Date | null;
}

/**
 * Bank storage for safe resource keeping
 * 
 * @property metal - Banked metal amount
 * @property energy - Banked energy amount
 * @property lastDeposit - Timestamp of last deposit (for audit)
 */
export interface BankStorage {
  metal: number;
  energy: number;
  lastDeposit: Date | null;
}

/**
 * Shrine boost tier types
 */
export type ShrineBoostTier = 'spade' | 'heart' | 'diamond' | 'club';

/**
 * Active shrine boost for resource gathering yield
 * 
 * @property tier - Boost tier (spade/heart/diamond/club)
 * @property expiresAt - When the boost expires
 * @property yieldBonus - Resource yield bonus (0.25 = +25%)
 */
export interface ShrineBoost {
  tier: ShrineBoostTier;
  expiresAt: Date;
  yieldBonus: number; // Always 0.25 (+25% per boost)
}

/**
 * Item types for cave drops
 */
export enum ItemType {
  // Permanent digger items
  MetalDigger = 'METAL_DIGGER',
  EnergyDigger = 'ENERGY_DIGGER',
  UniversalDigger = 'UNIVERSAL_DIGGER',
  
  // Tradeable items for temporary boosts
  TradeableItem = 'TRADEABLE_ITEM'
}

/**
 * Item rarity tiers
 */
export enum ItemRarity {
  Common = 'COMMON',
  Uncommon = 'UNCOMMON',
  Rare = 'RARE',
  Epic = 'EPIC',
  Legendary = 'LEGENDARY'
}

/**
 * Inventory item from cave exploration
 * 
 * @property id - Unique item identifier
 * @property type - Item type (digger or tradeable)
 * @property name - Display name of the item
 * @property description - Item description
 * @property rarity - Rarity tier
 * @property bonusPercent - Permanent bonus percentage (0 for tradeable)
 * @property bonusValue - Display value for bonus
 * @property quantity - Stack quantity for tradeable items
 * @property foundAt - Location where item was found
 * @property foundDate - Timestamp when item was discovered
 */
export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  description?: string;
  rarity: ItemRarity;
  bonusPercent: number; // 0 for tradeable items, 0.1-2% for diggers
  bonusValue?: number; // Display value for UI
  quantity?: number; // For stackable tradeable items
  foundAt: Position;
  foundDate: Date;
}

/**
 * Movement direction enum for 9-directional navigation
  lastActive?: Date; // Timestamp for activity tracking (used for active player metrics)
 * 
 * Multiple keyboard control schemes supported:
 * 
 * QWEASDZXC Layout:
 * Q  W  E  =  [NW] [N]  [NE]
 * A  S  D  =  [W]  [⟳]  [E]
 * Z  X  C  =  [SW] [S]  [SE]
 * 
 * Numpad Layout:
 * 7  8  9  =  [NW] [N]  [NE]
 * 4  5  6  =  [W]  [⟳]  [E]
 * 1  2  3  =  [SW] [S]  [SE]
 * 
 * Arrow Keys (Cardinal directions only):
 * ↑ = North, ↓ = South, ← = West, → = East
 */
export enum MovementDirection {
  North = 'N',
  Northeast = 'NE',
  East = 'E',
  Southeast = 'SE',
  South = 'S',
  Southwest = 'SW',
  West = 'W',
  Northwest = 'NW',
  Refresh = 'REFRESH'
}

/**
 * Keyboard key to movement direction mapping
 * Supports three control schemes: QWEASDZXC, Numpad 1-9, and Arrow keys
 * 
 * @example
 * // All three map to North:
 * KeyToDirection['w'] === MovementDirection.North
 * KeyToDirection['8'] === MovementDirection.North
 * KeyToDirection['ArrowUp'] === MovementDirection.North
 */
export const KeyToDirection: Record<string, MovementDirection> = {
  // QWEASDZXC Layout (original)
  'q': MovementDirection.Northwest,
  'Q': MovementDirection.Northwest,
  'w': MovementDirection.North,
  'W': MovementDirection.North,
  'e': MovementDirection.Northeast,
  'E': MovementDirection.Northeast,
  'a': MovementDirection.West,
  'A': MovementDirection.West,
  's': MovementDirection.Refresh,
  'S': MovementDirection.Refresh,
  'd': MovementDirection.East,
  'D': MovementDirection.East,
  'z': MovementDirection.Southwest,
  'Z': MovementDirection.Southwest,
  'x': MovementDirection.South,
  'X': MovementDirection.South,
  'c': MovementDirection.Southeast,
  'C': MovementDirection.Southeast,
  
  // Numpad 1-9 Layout (matches physical numpad grid)
  '7': MovementDirection.Northwest,
  '8': MovementDirection.North,
  '9': MovementDirection.Northeast,
  '4': MovementDirection.West,
  '5': MovementDirection.Refresh,
  '6': MovementDirection.East,
  '1': MovementDirection.Southwest,
  '2': MovementDirection.South,
  '3': MovementDirection.Southeast,
  
  // Arrow Keys (cardinal directions only)
  'ArrowUp': MovementDirection.North,
  'ArrowDown': MovementDirection.South,
  'ArrowLeft': MovementDirection.West,
  'ArrowRight': MovementDirection.East
};

/**
 * Movement delta for each direction
 * Maps direction to x,y coordinate changes
 */
export const DirectionDelta: Record<MovementDirection, Position> = {
  [MovementDirection.North]: { x: 0, y: -1 },
  [MovementDirection.Northeast]: { x: 1, y: -1 },
  [MovementDirection.East]: { x: 1, y: 0 },
  [MovementDirection.Southeast]: { x: 1, y: 1 },
  [MovementDirection.South]: { x: 0, y: 1 },
  [MovementDirection.Southwest]: { x: -1, y: 1 },
  [MovementDirection.West]: { x: -1, y: 0 },
  [MovementDirection.Northwest]: { x: -1, y: -1 },
  [MovementDirection.Refresh]: { x: 0, y: 0 }
};

/**
 * Game constants
 */
export const GAME_CONSTANTS = {
  /** Map dimensions */
  MAP_WIDTH: 150,
  MAP_HEIGHT: 150,
  
  /** Total tiles on the map */
  TOTAL_TILES: 22500,
  
  /** Terrain distribution counts */
  TERRAIN_COUNTS: {
    [TerrainType.Metal]: 4500,
    [TerrainType.Energy]: 4500,
    [TerrainType.Cave]: 1800,
    [TerrainType.Forest]: 450,
    [TerrainType.Factory]: 2250,
    [TerrainType.Wasteland]: 9000
  },
  
  /** Starting resources for new players */
  STARTING_RESOURCES: {
    metal: 0,
    energy: 0
  },
  
  /** Harvest system constants */
  HARVEST: {
    /** Base harvest range for metal/energy tiles */
    MIN_AMOUNT: 400,
    MAX_AMOUNT: 750,
    
    /** Cave item drop rate */
    CAVE_DROP_RATE: 0.025, // 2.5% chance (reduced from 30%)
    
    /** Cave item distribution */
    TRADEABLE_ITEM_RATE: 0.80, // 80% of drops are tradeable
    DIGGER_ITEM_RATE: 0.20, // 20% of drops are diggers (reduced from 65%)
    
    /** Reset times (server time) */
    RESET_TIMES: {
      TILES_1_75: '00:00', // Midnight
      TILES_76_150: '12:00' // Noon
    },
    
    /** Inventory limits */
    DEFAULT_INVENTORY_CAPACITY: 2000
  },
  
  /** Digger diminishing returns tiers */
  DIGGER_TIERS: [
    { min: 1, max: 10, bonusPercent: 2.0 },    // First 10: +2% each
    { min: 11, max: 30, bonusPercent: 1.0 },   // Next 20: +1% each
    { min: 31, max: 70, bonusPercent: 0.5 },   // Next 40: +0.5% each
    { min: 71, max: 150, bonusPercent: 0.25 }, // Next 80: +0.25% each
    { min: 151, max: Infinity, bonusPercent: 0.1 } // After 150: +0.1% each
  ]
} as const;

/**
 * API response types
 */

/**
 * Standard API success response
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Standard API error response
 */
export interface ApiError {
  success: false;
  error: string;
  details?: string;
}

/**
 * Player registration request
 */
export interface RegisterRequest {
  username: string;
}

/**
 * Player registration response
 */
export interface RegisterResponse {
  player: Player;
  currentTile: Tile;
}

/**
 * Movement request
 */
export interface MoveRequest {
  username: string;
  direction: MovementDirection;
}

/**
 * Movement response
 */
export interface MoveResponse {
  player: Player;
  currentTile: Tile;
}

/**
 * Get tile request query parameters
 */
export interface GetTileRequest {
  x: number;
  y: number;
}

/**
 * Get player request query parameters
 */
export interface GetPlayerRequest {
  username: string;
}

/**
 * Harvest result data for comprehensive harvest operations
 * Supports both resource gathering (Metal/Energy) and exploration (Cave/Forest)
 * 
 * @property success - Whether harvest was successful
 * @property message - Result message to display
 * @property metalGained - Amount of metal harvested (0 if none)
 * @property energyGained - Amount of energy harvested (0 if none)
 * @property item - Cave/Forest item discovered (null if none)
 * @property bonusApplied - Bonus percentage that was applied (from shrine boosts)
 * @property xpAwarded - XP gained from harvest (optional, for API responses)
 * @property levelUp - Whether player leveled up (optional, for API responses)
 * @property newLevel - New level if levelUp is true (optional, for API responses)
 * @property player - Updated player object (optional, for full API responses)
 * @property tile - Tile that was harvested (optional, for full API responses)
 * @property harvestStatus - Cooldown status (optional, for full API responses)
 */
export interface HarvestResult {
  success: boolean;
  message: string;
  metalGained?: number;
  energyGained?: number;
  item?: InventoryItem | null;
  bonusApplied?: number;
  xpAwarded?: number;
  levelUp?: boolean;
  newLevel?: number;
  player?: Player;
  tile?: Tile;
  harvestStatus?: {
    canHarvest: boolean;
    timeUntilReset: number;
    resetPeriod: string;
  };
}

/**
 * Factory entity with ownership and production data
 * 
 * @property x - Horizontal coordinate
 * @property y - Vertical coordinate
 * @property owner - Username of controlling player (null if unclaimed)
 * @property defense - Defense power for attack calculations
 * @property level - Factory upgrade level (1-10, affects slots and regen rate)
 * @property slots - Current available slots (regenerates based on level)
 * @property usedSlots - Number of slots currently occupied by units
 * @property productionRate - Units produced per hour (display only)
 * @property lastSlotRegen - Timestamp of last slot regeneration check
 * @property lastAttackedBy - Last player to attack (for cooldown)
 * @property lastAttackTime - Timestamp of last attack
 */
export interface Factory {
  x: number;
  y: number;
  owner: string | null;
  defense: number;
  level: number; // Factory upgrade level (1-10, default 1)
  slots: number; // Current available slots (regenerates based on level)
  usedSlots: number; // Slots consumed by built units
  productionRate: number; // Units per hour (display only)
  lastSlotRegen: Date; // Last time slots were regenerated
  lastResourceGeneration?: Date; // Last time passive income was collected (NEW: Phase 5)
  lastAttackedBy?: string | null;
  lastAttackTime?: Date | null;
}

/**
 * Unit tier system for progressive unlocks
 */
export enum UnitTier {
  Tier1 = 1,
  Tier2 = 2,
  Tier3 = 3,
  Tier4 = 4,
  Tier5 = 5
}

/**
 * Unit archetype — determines combat role and intransitive counter relationships.
 * Strikers > Bulwarks > Artillery > Support > Strikers (rock-paper-scissors).
 *
 * FID-20260511-FACTORY-UNIT-REDESIGN: Replaced mirrored STR/DEF pairs with
 * four distinct archetypes that create tactical depth in automated combat.
 */
export type UnitArchetype = 'STRIKER' | 'BULWARK' | 'ARTILLERY' | 'SUPPORT';

/**
 * Unit types available for building (20 total: 4 archetypes × 5 tiers)
 *
 * Naming convention: [ARCHETYPE]_[TIER]_[NAME]
 *
 * ORTHOGONAL COST SCALING:
 * - Higher tiers are MORE slot-efficient but LESS resource-efficient
 * - T1: Cheap metal/energy, massive slot consumption (good for early game)
 * - T5: Expensive metal/energy, minimal slot consumption (good for late game)
 * - This creates meaningful choice: resources vs slots
 *
 * INTRANSITIVE COMBAT:
 * - Strikers deal 130% damage to Bulwarks
 * - Bulwarks absorb 70% of incoming damage (frontline)
 * - Artillery strikes Support units first (disrupt multipliers)
 * - Support amplifies STR/DEF of Strikers and Bulwarks
 *
 * FID-20260511-FACTORY-UNIT-REDESIGN: Reduced from 65 bloated types to 20
 * focused units with distinct tactical roles.
 */
export const UnitType = {
  // ===== STRIKER ARCHETYPE (Offense Focus) =====
  S_T1_VanguardInfantry: 'T1_RIFLEMAN' as const,
  S_T2_AssaultArmor: 'T2_COMMANDO' as const,
  S_T3_PlasmaGunship: 'T3_STRIKER' as const,
  S_T4_OrbitalDestroyer: 'T4_TITAN' as const,
  S_T5_SingularityTitan: 'T5_OVERLORD' as const,
  // ===== BULWARK ARCHETYPE (Defense Focus) =====
  B_T1_AegisDrone: 'T1_BUNKER' as const,
  B_T2_PhalanxMech: 'T2_FORTRESS' as const,
  B_T3_ShieldCruiser: 'T3_CITADEL' as const,
  B_T4_VoidBastion: 'T4_STRONGHOLD' as const,
  B_T5_CitadelLeviathan: 'T5_BASTION' as const,
  // ===== ARTILLERY ARCHETYPE (Anti-Support Focus) =====
  A_T1_MortarSquad: 'T1_TURRET' as const,
  A_T2_RocketBattery: 'T2_CANNON' as const,
  A_T3_RailgunEmplacement: 'T3_ARTILLERY' as const,
  A_T4_OrbitalStrike: 'T4_DREADNOUGHT' as const,
  A_T5_AnnihilatorCannon: 'T5_LEVIATHAN' as const,
  // ===== SUPPORT ARCHETYPE (Multiplier/Buffer) =====
  U_T1_CommsRelay: 'T1_SHIELD' as const,
  U_T2_TacticalLink: 'T2_SENTINEL' as const,
  U_T3_CommandNetwork: 'T3_GUARDIAN' as const,
  U_T4_WarCouncil: 'T4_COLOSSUS' as const,
  U_T5_SupremeCommand: 'T5_IMMORTAL' as const,
} as const;

export type UnitType = typeof UnitType[keyof typeof UnitType];

/**
 * Reverse mapping: DB unit_type value → archetype category
 */
export const UNIT_TYPE_ARCHETTE: Record<UnitType, UnitArchetype> = {
  // Strikers
  'T1_RIFLEMAN': 'STRIKER',
  'T2_COMMANDO': 'STRIKER',
  'T3_STRIKER': 'STRIKER',
  'T4_TITAN': 'STRIKER',
  'T5_OVERLORD': 'STRIKER',
  // Bulwarks
  'T1_BUNKER': 'BULWARK',
  'T2_FORTRESS': 'BULWARK',
  'T3_CITADEL': 'BULWARK',
  'T4_STRONGHOLD': 'BULWARK',
  'T5_BASTION': 'BULWARK',
  // Artillery
  'T1_TURRET': 'ARTILLERY',
  'T2_CANNON': 'ARTILLERY',
  'T3_ARTILLERY': 'ARTILLERY',
  'T4_DREADNOUGHT': 'ARTILLERY',
  'T5_LEVIATHAN': 'ARTILLERY',
  // Support
  'T1_SHIELD': 'SUPPORT',
  'T2_SENTINEL': 'SUPPORT',
  'T3_GUARDIAN': 'SUPPORT',
  'T4_COLOSSUS': 'SUPPORT',
  'T5_IMMORTAL': 'SUPPORT',
};

/**
 * Unit configuration for building
 * 
 * @property type - Unit type identifier
 * @property name - Display name
 * @property archetype - Combat role (STRIKER/BULWARK/ARTILLERY/SUPPORT)
 * @property tier - Unit tier (1-5)
 * @property metalCost - Metal resource cost
 * @property energyCost - Energy resource cost
 * @property slotCost - Factory slots consumed
 * @property strength - Offensive power (STR)
 * @property defense - Defensive power (DEF)
 * @property levelRequired - Minimum player level to unlock
 * @property rpRequired - Research Points needed to unlock tier (one-time cost)
 *
 * FID-20260511-FACTORY-UNIT-REDESIGN: Added archetype field for intransitive combat.
 */
export interface UnitConfig {
  type: UnitType;
  name: string;
  description: string;
  archetype: UnitArchetype;
  tier: UnitTier;
  metalCost: number;
  energyCost: number;
  slotCost: number;
  strength: number; // STR contribution
  defense: number;  // DEF contribution
  levelRequired: number;
  rpRequired: number; // One-time RP cost to unlock entire tier
}

/**
 * Available unit configurations
 */
/**
 * Complete unit configurations for all 20 units (4 archetypes × 5 tiers)
 *
 * BALANCING PHILOSOPHY — ORTHOGONAL COST SCALING:
 * - Higher tiers are MORE slot-efficient but LESS resource-efficient
 * - T1: Cheap metal/energy, massive slot consumption (good for early game)
 * - T5: Expensive metal/energy, minimal slot consumption (good for late game)
 * - This creates meaningful choice: resources vs slots
 *
 * INTRANSITIVE COMBAT:
 * - Strikers deal 130% damage to Bulwarks
 * - Bulwarks absorb 70% of incoming damage (frontline)
 * - Artillery strikes Support units first (disrupt multipliers)
 * - Support amplifies STR/DEF of Strikers and Bulwarks (diminishing returns, max +60%)
 *
 * FID-20260511-FACTORY-UNIT-REDESIGN: Replaced 65 bloated mirrored STR/DEF pairs
 * with 20 focused units across 4 archetypes. Each unit has a distinct tactical role.
 */
export const UNIT_CONFIGS: Record<string, UnitConfig> = {
  // ==================== STRIKER ARCHETYPE (Offense Focus) ====================
  // High STR, negligible DEF. The spear. Deals 130% damage to Bulwarks.
  'T1_RIFLEMAN': {
    type: 'T1_RIFLEMAN',
    description: 'Basic infantry. Deals 130% damage to Bulwarks in combat.',
    name: 'Vanguard Infantry',
    archetype: 'STRIKER',
    tier: UnitTier.Tier1,
    metalCost: 300,
    energyCost: 150,
    slotCost: 100,
    strength: 10,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0
  },
  'T2_COMMANDO': {
    type: 'T2_COMMANDO',
    description: 'Elite assault armor. High STR damage, counters defensive lines.',
    name: 'Assault Armor',
    archetype: 'STRIKER',
    tier: UnitTier.Tier2,
    metalCost: 1400,
    energyCost: 700,
    slotCost: 250,
    strength: 35,
    defense: 0,
    levelRequired: 10,
    rpRequired: 50
  },
  'T3_STRIKER': {
    type: 'T3_STRIKER',
    description: 'Plasma-armed gunship. Devastating offensive power.',
    name: 'Plasma Gunship',
    archetype: 'STRIKER',
    tier: UnitTier.Tier3,
    metalCost: 4500,
    energyCost: 2250,
    slotCost: 450,
    strength: 90,
    defense: 0,
    levelRequired: 20,
    rpRequired: 150
  },
  'T4_TITAN': {
    type: 'T4_TITAN',
    description: 'Orbital destroyer. Massive STR output against hardened targets.',
    name: 'Orbital Destroyer',
    archetype: 'STRIKER',
    tier: UnitTier.Tier4,
    metalCost: 13000,
    energyCost: 6500,
    slotCost: 700,
    strength: 200,
    defense: 0,
    levelRequired: 35,
    rpRequired: 350
  },
  'T5_OVERLORD': {
    type: 'T5_OVERLORD',
    description: 'Singularity-powered titan. Absolute offensive supremacy.',
    name: 'Singularity Titan',
    archetype: 'STRIKER',
    tier: UnitTier.Tier5,
    metalCost: 34000,
    energyCost: 17000,
    slotCost: 1000,
    strength: 400,
    defense: 0,
    levelRequired: 50,
    rpRequired: 750
  },

  // ==================== BULWARK ARCHETYPE (Defense Focus) ====================
  // High DEF, negligible STR. The shield. Absorbs 70% of incoming damage.
  'T1_BUNKER': {
    type: 'T1_BUNKER',
    description: 'Frontline bunker. High DEF absorbs incoming damage for allies.',
    name: 'Aegis Drone',
    archetype: 'BULWARK',
    tier: UnitTier.Tier1,
    metalCost: 250,
    energyCost: 150,
    slotCost: 100,
    strength: 0,
    defense: 10,
    levelRequired: 1,
    rpRequired: 0
  },
  'T2_FORTRESS': {
    type: 'T2_FORTRESS',
    description: 'Phalanx mech. Reinforced defense for holding the line.',
    name: 'Phalanx Mech',
    archetype: 'BULWARK',
    tier: UnitTier.Tier2,
    metalCost: 1200,
    energyCost: 600,
    slotCost: 250,
    strength: 0,
    defense: 35,
    levelRequired: 10,
    rpRequired: 50
  },
  'T3_CITADEL': {
    type: 'T3_CITADEL',
    description: 'Shield cruiser. Mobile fortress with exceptional durability.',
    name: 'Shield Cruiser',
    archetype: 'BULWARK',
    tier: UnitTier.Tier3,
    metalCost: 3800,
    energyCost: 1900,
    slotCost: 450,
    strength: 0,
    defense: 90,
    levelRequired: 20,
    rpRequired: 150
  },
  'T4_STRONGHOLD': {
    type: 'T4_STRONGHOLD',
    description: 'Void bastion. Nearly impenetrable defensive position.',
    name: 'Void Bastion',
    archetype: 'BULWARK',
    tier: UnitTier.Tier4,
    metalCost: 11000,
    energyCost: 5500,
    slotCost: 700,
    strength: 0,
    defense: 200,
    levelRequired: 35,
    rpRequired: 350
  },
  'T5_BASTION': {
    type: 'T5_BASTION',
    description: 'Citadel leviathan. Ultimate defensive bulwark.',
    name: 'Citadel Leviathan',
    archetype: 'BULWARK',
    tier: UnitTier.Tier5,
    metalCost: 28000,
    energyCost: 14000,
    slotCost: 1000,
    strength: 0,
    defense: 400,
    levelRequired: 50,
    rpRequired: 750
  },

  // ==================== ARTILLERY ARCHETYPE (Anti-Support Focus) ====================
  // Moderate STR, targets Support first. The hammer. Disrupts enemy multipliers.
  'T1_TURRET': {
    type: 'T1_TURRET',
    description: 'Auto-turret. Strikes enemy Support units first in combat.',
    name: 'Mortar Squad',
    archetype: 'ARTILLERY',
    tier: UnitTier.Tier1,
    metalCost: 350,
    energyCost: 200,
    slotCost: 120,
    strength: 15,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0
  },
  'T2_CANNON': {
    type: 'T2_CANNON',
    description: 'Rocket battery. Suppresses support lines with barrages.',
    name: 'Rocket Battery',
    archetype: 'ARTILLERY',
    tier: UnitTier.Tier2,
    metalCost: 1600,
    energyCost: 800,
    slotCost: 280,
    strength: 45,
    defense: 0,
    levelRequired: 10,
    rpRequired: 50
  },
  'T3_ARTILLERY': {
    type: 'T3_ARTILLERY',
    description: 'Railgun emplacement. Precision anti-support strikes.',
    name: 'Railgun Emplacement',
    archetype: 'ARTILLERY',
    tier: UnitTier.Tier3,
    metalCost: 5000,
    energyCost: 2500,
    slotCost: 500,
    strength: 110,
    defense: 0,
    levelRequired: 20,
    rpRequired: 150
  },
  'T4_DREADNOUGHT': {
    type: 'T4_DREADNOUGHT',
    description: 'Orbital strike platform. Devastates support formations.',
    name: 'Orbital Strike',
    archetype: 'ARTILLERY',
    tier: UnitTier.Tier4,
    metalCost: 14000,
    energyCost: 7000,
    slotCost: 750,
    strength: 230,
    defense: 0,
    levelRequired: 35,
    rpRequired: 350
  },
  'T5_LEVIATHAN': {
    type: 'T5_LEVIATHAN',
    description: 'Annihilator cannon. Erases entire support networks.',
    name: 'Annihilator Cannon',
    archetype: 'ARTILLERY',
    tier: UnitTier.Tier5,
    metalCost: 36000,
    energyCost: 18000,
    slotCost: 1100,
    strength: 450,
    defense: 0,
    levelRequired: 50,
    rpRequired: 750
  },

  // ==================== SUPPORT ARCHETYPE (Multiplier/Buffer) ====================
  // Zero combat stats. The multiplier. Amplifies STR/DEF of Strikers and Bulwarks.
  // Vulnerable to Artillery. Uses diminishing returns curve (max +60% buff).
  'T1_SHIELD': {
    type: 'T1_SHIELD',
    description: 'Comms relay. Amplifies allied STR/DEF in combat (up to +60%).',
    name: 'Comms Relay',
    archetype: 'SUPPORT',
    tier: UnitTier.Tier1,
    metalCost: 200,
    energyCost: 100,
    slotCost: 80,
    strength: 0,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0
  },
  'T2_SENTINEL': {
    type: 'T2_SENTINEL',
    description: 'Tactical link. Enhances unit coordination and effectiveness.',
    name: 'Tactical Link',
    archetype: 'SUPPORT',
    tier: UnitTier.Tier2,
    metalCost: 1000,
    energyCost: 500,
    slotCost: 180,
    strength: 0,
    defense: 0,
    levelRequired: 10,
    rpRequired: 50
  },
  'T3_GUARDIAN': {
    type: 'T3_GUARDIAN',
    description: 'Command network. Directs battlefield with advanced tactics.',
    name: 'Command Network',
    archetype: 'SUPPORT',
    tier: UnitTier.Tier3,
    metalCost: 3200,
    energyCost: 1600,
    slotCost: 350,
    strength: 0,
    defense: 0,
    levelRequired: 20,
    rpRequired: 150
  },
  'T4_COLOSSUS': {
    type: 'T4_COLOSSUS',
    description: 'War council. Orchestrates large-scale combat operations.',
    name: 'War Council',
    archetype: 'SUPPORT',
    tier: UnitTier.Tier4,
    metalCost: 9000,
    energyCost: 4500,
    slotCost: 550,
    strength: 0,
    defense: 0,
    levelRequired: 35,
    rpRequired: 350
  },
  'T5_IMMORTAL': {
    type: 'T5_IMMORTAL',
    description: 'Supreme command. Transcendent battlefield coordination.',
    name: 'Supreme Command',
    archetype: 'SUPPORT',
    tier: UnitTier.Tier5,
    metalCost: 24000,
    energyCost: 12000,
    slotCost: 800,
    strength: 0,
    defense: 0,
    levelRequired: 50,
    rpRequired: 750
  },
};

/**
 * Tier unlock requirements
 * Maps tier number to level and RP requirements
 */
export const TIER_UNLOCK_REQUIREMENTS = {
  [UnitTier.Tier1]: { level: 1, rp: 0, metal: 0 },
  [UnitTier.Tier2]: { level: 10, rp: 50, metal: 100000 },
  [UnitTier.Tier3]: { level: 20, rp: 150, metal: 500000 },
  [UnitTier.Tier4]: { level: 35, rp: 350, metal: 2500000 },
  [UnitTier.Tier5]: { level: 50, rp: 750, metal: 10000000 },
};

/**
 * Helper function: Check if player has unlocked a specific tier
 */
export function isTierUnlocked(tier: UnitTier, playerLevel: number, unlockedTiers: UnitTier[]): boolean {
  const requirements = TIER_UNLOCK_REQUIREMENTS[tier];
  return playerLevel >= requirements.level && unlockedTiers.includes(tier);
}

/**
 * Helper function: Get units available for a specific tier
 */
export function getUnitsForTier(tier: UnitTier): UnitConfig[] {
  return Object.values(UNIT_CONFIGS).filter(config => config.tier === tier);
}

/**
 * Helper function: Get all unlocked units for player
 */
export function getAvailableUnits(playerLevel: number, unlockedTiers: UnitTier[]): UnitConfig[] {
  return Object.values(UNIT_CONFIGS).filter(config => 
    isTierUnlocked(config.tier, playerLevel, unlockedTiers)
  );
}

/**
 * Unit instance in player's army (simplified)
 * Used for player inventory and army management
 * 
 * @property id - Unique identifier (alias for unitId for battle system compatibility)
 * @property unitId - Unit blueprint ID from UNIT_BLUEPRINTS
 * @property unitType - Unit type for combat and display
 * @property name - Unit name
 * @property archetype - Combat archetype (STRIKER/BULWARK/ARTILLERY/SUPPORT)
 * @property rarity - Rarity tier
 * @property strength - STR contribution
 * @property defense - DEF contribution
 * @property quantity - Number of units of this type owned
 * @property createdAt - When unit was built
 *
 * FID-20260511-FACTORY-UNIT-REDESIGN: Changed category ('STR'|'DEF') to archetype (UnitArchetype).
 */
export interface PlayerUnit {
  id: string; // Alias for unitId - battle system compatibility
  unitId: string;
  unitType: UnitType; // Added for combat modal and army management compatibility
  name: string;
  archetype: UnitArchetype;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  strength: number;
  defense: number;
  quantity: number; // Added for tracking owned units of each type
  createdAt: Date;
}

/**
 * Unit produced by factories (full combat data)
 * Used in combat scenarios and factory production
 * 
 * @property id - Unique unit identifier
 * @property type - Unit type (40 types across 5 tiers)
 * @property strength - Offensive power (STR)
 * @property defense - Defensive power (DEF)
 * @property producedAt - Factory location where unit was produced
 * @property producedDate - When unit finished production
 * @property owner - Player who owns this unit
 */
export interface Unit {
  id: string;
  type: UnitType;
  strength: number; // STR contribution
  defense: number;  // DEF contribution
  producedAt: Position;
  producedDate: Date;
  owner: string; // Player username
}

/**
 * Attack result data
 * 
 * @property success - Whether attack succeeded
 * @property message - Result message
 * @property playerPower - Player's calculated power
 * @property factoryDefense - Factory's defense value
 * @property captured - Whether factory was captured
 * @property damageDealt - Damage dealt to factory (future PvP)
 * @property xpAwarded - XP awarded for the action
 * @property levelUp - Whether player leveled up
 * @property newLevel - New player level (if levelUp is true)
 */
export interface AttackResult {
  success: boolean;
  message: string;
  playerPower: number;
  factoryDefense: number;
  captured: boolean;
  damageDealt?: number;
  xpAwarded?: number;
  levelUp?: boolean;
  newLevel?: number;
}

/**
 * Bank transaction types
 */
export type BankTransactionType = 'deposit' | 'withdrawal' | 'exchange';

/**
 * Bank transaction record for audit trail
 * 
 * @property playerId - Player's username
 * @property type - Transaction type
 * @property resourceType - 'metal' or 'energy'
 * @property amount - Amount of resource involved
 * @property fee - Fee charged (if any)
 * @property timestamp - When transaction occurred
 * @property fromResource - For exchanges: what was given
 * @property toResource - For exchanges: what was received
 */
export interface BankTransaction {
  playerId: string;
  type: BankTransactionType;
  resourceType: 'metal' | 'energy';
  amount: number;
  fee: number;
  timestamp: Date;
  fromResource?: { type: 'metal' | 'energy'; amount: number };
  toResource?: { type: 'metal' | 'energy'; amount: number };
}

/**
 * Battle types for PVP combat system
 */
export enum BattleType {
  Infantry = 'INFANTRY',   // Player vs Player direct combat
  Base = 'BASE',           // Attack enemy home base
  Factory = 'FACTORY'      // Factory ownership battle
}

/**
 * Battle outcome for combat resolution
 */
export enum BattleOutcome {
  AttackerWin = 'ATTACKER_WIN',
  DefenderWin = 'DEFENDER_WIN',
  Draw = 'DRAW'
}

/**
 * Battle participant information
 */
export interface BattleParticipant {
  username: string;
  units: Unit[];         // Units brought to battle
  totalSTR: number;      // Total strength in battle
  totalDEF: number;      // Total defense in battle
  initialHP: number;     // Starting HP (based on units)
  finalHP: number;       // HP after battle
  unitsLost: number;     // Count of units killed
  unitsCaptured: number; // Count of enemy units captured
  
  // Aliases for convenience (match component expectations)
  startingHP: number;    // Alias for initialHP
  endingHP: number;      // Alias for finalHP
  damageDealt: number;   // Total damage dealt to opponent
  xpEarned: number;      // XP earned from battle
}

/**
 * Combat round details for battle log
 */
export interface CombatRound {
  roundNumber: number;
  attackerDamage: number;
  defenderDamage: number;
  attackerHP: number;    // HP after this round
  defenderHP: number;    // HP after this round
  attackerUnitsLost: number;
  defenderUnitsLost: number;
}

/**
 * Battle log for storing combat history
 */
export interface BattleLog {
  _id?: string;
  battleId: string;        // Unique battle identifier
  battleType: BattleType;
  timestamp: Date;
  
  // Participants
  attacker: BattleParticipant;
  defender: BattleParticipant;
  
  // Battle details
  outcome: BattleOutcome;
  rounds: CombatRound[];
  totalRounds: number;
  
  // Loot and captures
  resourcesStolen?: {
    resourceType: 'metal' | 'energy';
    amount: number;
  };
  unitsCaptured?: {
    attackerCaptured: Unit[];  // Units attacker captured from defender
    defenderCaptured: Unit[];  // Units defender captured from attacker
  };
  
  // XP awards
  attackerXP: number;
  defenderXP: number;
  
  // Location (if applicable)
  location?: Position;
  
  // Battle notes/message
  message?: string;
  notes?: string;

  // Internal tracking (not serialized to DB)
  _attackerCasualties?: Unit[];
  _defenderCasualties?: Unit[];
  _attackerSurvivors?: Unit[];
  _defenderSurvivors?: Unit[];
}

/**
 * Battle result returned from combat resolution
 */
export interface BattleResult {
  success: boolean;
  message: string;
  battleLog: BattleLog;
  
  // Flattened properties for convenience
  outcome: BattleOutcome;
  rounds: number;
  battleType: BattleType;
  attacker: BattleParticipant;
  defender: BattleParticipant;
  resourcesStolen?: {
    resourceType: 'metal' | 'energy';
    amount: number;
  };
  
  // Level up info
  attackerLevelUp?: boolean;
  defenderLevelUp?: boolean;
  attackerNewLevel?: number;
  defenderNewLevel?: number;
}

/**
 * Infantry battle request (Player vs Player direct combat)
 */
export interface InfantryAttackRequest {
  targetUsername: string;
  unitIds: string[];  // Units to bring to battle
}

/**
 * Base attack request (Attack home base)
 */
export interface BaseAttackRequest {
  targetUsername: string;
  unitIds: string[];  // Units to bring to battle
  resourceToSteal: 'metal' | 'energy'; // Which resource to steal if victorious
}

/**
 * Factory attack already exists (using factoryService)
 * But we'll enhance it to include unit battles if both players have units at factory
 */

/**
 * Harvest status response for cooldown checks
 * 
 * @property canHarvest - Whether player can harvest this tile
 * @property timeUntilReset - Milliseconds until next reset
 * @property resetPeriod - Current reset period identifier
 */
export interface HarvestStatus {
  canHarvest: boolean;
  timeUntilReset: number;
  resetPeriod: string;
}

/**
 * Factory statistics at a given level
 * 
 * @property level - Factory level (1-10)
 * @property maxSlots - Maximum unit slots
 * @property regenRate - Slot regeneration rate (hours)
 * @property strengthBonus - Strength bonus percentage
 * @property defenseBonus - Defense bonus percentage
 */
export interface FactoryStats {
  level: number;
  maxSlots: number;
  regenRate: number;
  strengthBonus: number;
  defenseBonus: number;
}

/**
 * Enhanced factory data with upgrade information
 * Extends base Factory interface with computed fields
 * 
 * @property stats - Current level statistics
 * @property timeUntilNext - Milliseconds until next slot regeneration
 * @property upgradeCost - Cost to upgrade (null if max level)
 * @property canUpgrade - Whether player can afford upgrade
 * @property totalInvested - Total resources invested in upgrades
 */
export interface EnhancedFactory extends Factory {
  stats: FactoryStats;
  timeUntilNext: number;
  upgradeCost: { metal: number; energy: number } | null;
  canUpgrade: boolean;
  totalInvested?: { metal: number; energy: number };
}

/**
 * Sort options for inventory filtering
 */
export type InventorySortOption = 'rarity' | 'type' | 'date' | 'bonus';

// ============================================================
// ADMIN TRACKING & ANTI-CHEAT SYSTEM (Phase 1)
// ============================================================

/**
 * Player action types for activity tracking
 * Captures all significant player actions for analytics and anti-cheat
 */
export type PlayerActionType = 
  | 'harvest'           // Resource gathering from tiles
  | 'attack'            // Combat against other players
  | 'build_factory'     // Factory construction
  | 'upgrade_factory'   // Factory level upgrades
  | 'trade'             // Auction house transactions
  | 'move'              // Map movement
  | 'tech_unlock'       // Tech tree research
  | 'bank_deposit'      // Banking resources
  | 'bank_withdraw'     // Withdrawing resources
  | 'shrine_boost'      // Shrine boost activation
  | 'cave_explore'      // Cave exploration
  | 'login'             // Player login event
  | 'logout';           // Player logout event

/**
 * Player activity record for comprehensive tracking
 * Used for analytics, anti-cheat detection, and admin monitoring
 * 
 * @property userId - Player's unique username
 * @property action - Type of action performed
 * @property timestamp - When the action occurred
 * @property sessionId - Session identifier for grouping actions
 * @property metadata - Action-specific data for analysis
 */
export interface PlayerActivity {
  userId: string;
  username: string;
  action: PlayerActionType;
  timestamp: Date;
  sessionId: string;
  metadata?: {
    resourcesGained?: { metal?: number; energy?: number; };
    resourcesSpent?: { metal?: number; energy?: number; };
    target?: string;              // For attacks/trades
    location?: { x: number; y: number; };
    duration?: number;            // For harvests (seconds)
    result?: 'success' | 'failure' | 'partial';
    itemsGained?: string[];       // For caves/trades
    techUnlocked?: string;        // For tech unlocks
    factoryLevel?: number;        // For factory actions
  };
}

/**
 * Player session tracking for login/logout analytics
 * Enables session time tracking and activity pattern analysis
 * 
 * @property userId - Player's unique username
 * @property sessionId - Unique session identifier
 * @property startTime - Session start timestamp
 * @property endTime - Session end timestamp (null if active)
 * @property duration - Session length in seconds
 * @property actionsCount - Number of actions in this session
 * @property resourcesGained - Total resources gained during session
 * @property ipAddress - Client IP for multi-account detection (optional)
 */
export interface PlayerSession {
  userId: string;
  username: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;              // Seconds
  actionsCount: number;
  resourcesGained: { metal: number; energy: number; };
  ipAddress?: string;
}

/**
 * Anti-cheat flag types for different violation categories
 */
export type FlagType = 
  | 'speed_hack'          // Impossible movement speeds
  | 'resource_hack'       // Impossible resource gains
  | 'cooldown_violation'  // Actions before cooldown expires
  | 'bot_behavior'        // Automated/scripted patterns
  | 'session_abuse'       // Unrealistic session durations
  | 'theoretical_max'     // Gains exceed game mechanics limits
  | 'multi_account';      // Multiple accounts from same IP

/**
 * Flag severity levels for prioritization
 */
export type FlagSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Player flag for anti-cheat system
 * Automatically generated when suspicious activity detected
 * 
 * @property userId - Flagged player's username
 * @property flagType - Type of violation detected
 * @property severity - How severe the violation is
 * @property timestamp - When the flag was created
 * @property evidence - Supporting data for the flag
 * @property resolved - Whether admin reviewed/cleared the flag
 * @property adminNotes - Admin comments on resolution
 * @property autoGenerated - Whether flag was automatic or manual
 */
export interface PlayerFlag {
  userId: string;
  username: string;
  flagType: FlagType;
  severity: FlagSeverity;
  timestamp: Date;
  evidence: {
    description: string;
    data: any;                    // Specific data that triggered flag
    actionId?: string;            // Reference to PlayerActivity record
  };
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;            // Admin username
  adminNotes?: string;
  autoGenerated: boolean;
}

/**
 * Aggregated player analytics for admin dashboard
 * Pre-computed metrics to reduce query load
 * 
 * @property userId - Player's username
 * @property period - Time period ('24h' | '7d' | '30d')
 * @property totalActions - Total actions in period
 * @property sessionCount - Number of sessions in period
 * @property totalSessionTime - Total time played (seconds)
 * @property resourcesGained - Total resources farmed
 * @property attacksLaunched - Attacks initiated
 * @property attacksReceived - Attacks defended
 * @property factoriesBuilt - Factories constructed
 * @property techsUnlocked - Technologies researched
 * @property flagCount - Number of anti-cheat flags
 * @property lastActive - Most recent activity timestamp
 */
export interface PlayerAnalytics {
  userId: string;
  username: string;
  period: '24h' | '7d' | '30d';
  totalActions: number;
  sessionCount: number;
  totalSessionTime: number;       // Seconds
  resourcesGained: { metal: number; energy: number; };
  attacksLaunched: number;
  attacksReceived: number;
  factoriesBuilt: number;
  techsUnlocked: number;
  flagCount: number;
  lastActive: Date;
  computedAt: Date;               // When these stats were calculated
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - All coordinates use 1-based indexing (1-150, not 0-149)
// - TerrainType enum provides type safety for terrain values
// - Movement directions support both keyboard input and programmatic use
// - API response types ensure consistent error handling
// - GAME_CONSTANTS centralize all magic numbers
// - HarvestResult used for below-image display (not overlay)
// - Factory system supports ownership, slots, and unit production
// - Attack system uses player power calculation for success rate
// - PlayerActivity tracks ALL player actions for analytics
// - PlayerSession enables session time and pattern analysis
// - PlayerFlag system automatically detects suspicious behavior
// - PlayerAnalytics pre-computes metrics for admin dashboard
// ============================================================
// END OF FILE
// ============================================================
