/**
 * @file game.types.ts
 * @created 2025-10-16
 * @overview Core TypeScript type definitions for DarkFrame game domain model
 * 
 * OVERVIEW:
 * Defines all core game entities including terrain types, tiles, players, positions,
 * movement directions, and resources. These types are used throughout the application
 * for type safety and data validation.
 */


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
  vipExpiration?: Date; // VIP subscription expiration date
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
    MIN_AMOUNT: 800,
    MAX_AMOUNT: 1500,
    
    /** Cave item drop rate */
    CAVE_DROP_RATE: 0.30, // 30% chance
    
    /** Cave item distribution */
    TRADEABLE_ITEM_RATE: 0.80, // 80% of drops are tradeable
    DIGGER_ITEM_RATE: 0.20, // 20% of drops are diggers
    
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
 * Unit types available for building (40 total: 5 tiers × 8 units per tier)
 * Naming convention: Tier + Role + Variant
 * Each tier has 4 STR units and 4 DEF units
 */
export enum UnitType {
  // ===== TIER 1 (Level 1+, 0 RP) =====
  // STR Units
  T1_Rifleman = 'T1_RIFLEMAN',           // STR: 5
  T1_Scout = 'T1_SCOUT',                 // STR: 8
  T1_Grenadier = 'T1_GRENADIER',         // STR: 12
  T1_Sniper = 'T1_SNIPER',               // STR: 15
  // DEF Units
  T1_Bunker = 'T1_BUNKER',               // DEF: 5
  T1_Barrier = 'T1_BARRIER',             // DEF: 8
  T1_Turret = 'T1_TURRET',               // DEF: 12
  T1_Shield = 'T1_SHIELD',               // DEF: 15

  // ===== TIER 2 (Level 5+, 5 RP) =====
  // STR Units
  T2_Commando = 'T2_COMMANDO',           // STR: 30
  T2_Ranger = 'T2_RANGER',               // STR: 40
  T2_Assassin = 'T2_ASSASSIN',           // STR: 50
  T2_Demolisher = 'T2_DEMOLISHER',       // STR: 60
  // DEF Units
  T2_Fortress = 'T2_FORTRESS',           // DEF: 30
  T2_Barricade = 'T2_BARRICADE',         // DEF: 40
  T2_Cannon = 'T2_CANNON',               // DEF: 50
  T2_Sentinel = 'T2_SENTINEL',           // DEF: 60

  // ===== TIER 3 (Level 10+, 15 RP) =====
  // STR Units
  T3_Striker = 'T3_STRIKER',             // STR: 90
  T3_Raider = 'T3_RAIDER',               // STR: 105
  T3_Enforcer = 'T3_ENFORCER',           // STR: 120
  T3_Warlord = 'T3_WARLORD',             // STR: 135
  // DEF Units
  T3_Citadel = 'T3_CITADEL',             // DEF: 90
  T3_Bulwark = 'T3_BULWARK',             // DEF: 105
  T3_Artillery = 'T3_ARTILLERY',         // DEF: 120
  T3_Guardian = 'T3_GUARDIAN',           // DEF: 135

  // ===== TIER 4 (Level 20+, 30 RP) =====
  // STR Units
  T4_Titan = 'T4_TITAN',                 // STR: 180
  T4_Juggernaut = 'T4_JUGGERNAUT',       // STR: 210
  T4_Destroyer = 'T4_DESTROYER',         // STR: 240
  T4_Annihilator = 'T4_ANNIHILATOR',     // STR: 270
  // DEF Units
  T4_Stronghold = 'T4_STRONGHOLD',       // DEF: 180
  T4_Rampart = 'T4_RAMPART',             // DEF: 210
  T4_Dreadnought = 'T4_DREADNOUGHT',     // DEF: 240
  T4_Colossus = 'T4_COLOSSUS',           // DEF: 270

  // ===== TIER 5 (Level 30+, 50 RP) =====
  // STR Units
  T5_Overlord = 'T5_OVERLORD',           // STR: 360
  T5_Conqueror = 'T5_CONQUEROR',         // STR: 420
  T5_Devastator = 'T5_DEVASTATOR',       // STR: 480
  T5_Apocalypse = 'T5_APOCALYPSE',       // STR: 540
  // DEF Units
  T5_Bastion = 'T5_BASTION',             // DEF: 360
  T5_Monolith = 'T5_MONOLITH',           // DEF: 420
  T5_Leviathan = 'T5_LEVIATHAN',         // DEF: 480
  T5_Immortal = 'T5_IMMORTAL',           // DEF: 540

  // ===== SPECIALIZED UNITS (Offensive Doctrine, Level 15+, 25 RP) =====
  SPEC_OFF_Vanguard = 'SPEC_OFF_VANGUARD',               // STR: 200, Mastery 0%+
  SPEC_OFF_Berserker = 'SPEC_OFF_BERSERKER',             // STR: 280, Mastery 0%+
  SPEC_OFF_Executioner = 'SPEC_OFF_EXECUTIONER',         // STR: 360, Mastery 25%+
  SPEC_OFF_Annihilator = 'SPEC_OFF_ANNIHILATOR',         // STR: 480, Mastery 75%+
  SPEC_OFF_Warmonger = 'SPEC_OFF_WARMONGER',             // STR: 620, Mastery 100%

  // ===== SPECIALIZED UNITS (Defensive Doctrine, Level 15+, 25 RP) =====
  SPEC_DEF_Guardian = 'SPEC_DEF_GUARDIAN',               // DEF: 200, Mastery 0%+
  SPEC_DEF_Fortress = 'SPEC_DEF_FORTRESS',               // DEF: 280, Mastery 0%+
  SPEC_DEF_Citadel = 'SPEC_DEF_CITADEL',                 // DEF: 360, Mastery 25%+
  SPEC_DEF_Bulwark = 'SPEC_DEF_BULWARK',                 // DEF: 480, Mastery 75%+
  SPEC_DEF_Invincible = 'SPEC_DEF_INVINCIBLE',           // DEF: 620, Mastery 100%

  // ===== SPECIALIZED UNITS (Tactical Doctrine, Level 15+, 25 RP) =====
  SPEC_TAC_Striker = 'SPEC_TAC_STRIKER',                 // Balanced: 120/120, Mastery 0%+
  SPEC_TAC_Vanguard = 'SPEC_TAC_VANGUARD',               // Balanced: 160/160, Mastery 0%+
  SPEC_TAC_Elite = 'SPEC_TAC_ELITE',                     // Balanced: 210/210, Mastery 25%+
  SPEC_TAC_Commander = 'SPEC_TAC_COMMANDER',             // Balanced: 280/280, Mastery 75%+
  SPEC_TAC_Supreme = 'SPEC_TAC_SUPREME',                 // Balanced: 360/360, Mastery 100%

  // ===== PRESTIGE UNITS (Achievement Unlocks) =====
  PRESTIGE_TITAN = 'PRESTIGE_TITAN',                     // STR: 700, Achievement: Warlord
  PRESTIGE_FABRICATOR = 'PRESTIGE_FABRICATOR',           // Balanced: 400/400, Achievement: Master Builder
  PRESTIGE_OVERLORD = 'PRESTIGE_OVERLORD',               // STR: 1000, Achievement: Army Supreme
  PRESTIGE_HARVESTER = 'PRESTIGE_HARVESTER',             // Balanced: 450/450, Achievement: Resource Magnate
  PRESTIGE_VAULT_KEEPER = 'PRESTIGE_VAULT_KEEPER',       // DEF: 800, Achievement: The Banker
  PRESTIGE_MYSTIC = 'PRESTIGE_MYSTIC',                   // Balanced: 500/500, Achievement: Shrine Devotee
  PRESTIGE_ANCIENT_SENTINEL = 'PRESTIGE_ANCIENT_SENTINEL', // Balanced: 550/550, Achievement: Archaeologist
  PRESTIGE_SPELUNKER = 'PRESTIGE_SPELUNKER',             // Balanced: 400/400, Achievement: Cave Explorer
  PRESTIGE_CHAMPION = 'PRESTIGE_CHAMPION',               // Balanced: 600/600, Achievement: Legend
  PRESTIGE_APEX_PREDATOR = 'PRESTIGE_APEX_PREDATOR',     // STR: 900, Achievement: Master Specialist
}

/**
 * Unit configuration for building
 * 
 * @property type - Unit type identifier
 * @property name - Display name
 * @property tier - Unit tier (1-5)
 * @property metalCost - Metal resource cost
 * @property energyCost - Energy resource cost
 * @property slotCost - Factory slots consumed
 * @property strength - Offensive power (STR)
 * @property defense - Defensive power (DEF)
 * @property levelRequired - Minimum player level to unlock
 * @property rpRequired - Research Points needed to unlock tier (one-time cost)
 */
export interface UnitConfig {
  type: UnitType;
  name: string;
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
 * Complete unit configurations for all 40 units (5 tiers × 8 units)
 * 
 * BALANCING PHILOSOPHY:
 * - Tier 1: Entry-level units (Level 1+, 0 RP)
 * - Tier 2: Mid-game units (Level 5+, 5 RP to unlock tier)
 * - Tier 3: Advanced units (Level 10+, 15 RP to unlock tier)
 * - Tier 4: Elite units (Level 20+, 30 RP to unlock tier)
 * - Tier 5: Legendary units (Level 30+, 50 RP to unlock tier)
 * 
 * COST SCALING:
 * - Metal/Energy costs scale exponentially per tier
 * - Higher tiers require more factory slots
 * - STR/DEF values scale progressively within each tier
 */
export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  // ==================== TIER 1: Basic Units ====================
  // STR Units
  [UnitType.T1_Rifleman]: {
    type: UnitType.T1_Rifleman,
    name: 'Rifleman',
    tier: UnitTier.Tier1,
    metalCost: 200,
    energyCost: 100,
    slotCost: 100,
    strength: 5,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0
  },
  [UnitType.T1_Scout]: {
    type: UnitType.T1_Scout,
    name: 'Scout',
    tier: UnitTier.Tier1,
    metalCost: 300,
    energyCost: 150,
    slotCost: 100,
    strength: 8,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0
  },
  [UnitType.T1_Grenadier]: {
    type: UnitType.T1_Grenadier,
    name: 'Grenadier',
    tier: UnitTier.Tier1,
    metalCost: 400,
    energyCost: 200,
    slotCost: 100,
    strength: 12,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0
  },
  [UnitType.T1_Sniper]: {
    type: UnitType.T1_Sniper,
    name: 'Sniper',
    tier: UnitTier.Tier1,
    metalCost: 500,
    energyCost: 250,
    slotCost: 100,
    strength: 15,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0
  },
  
  // DEF Units
  [UnitType.T1_Bunker]: {
    type: UnitType.T1_Bunker,
    name: 'Bunker',
    tier: UnitTier.Tier1,
    metalCost: 200,
    energyCost: 100,
    slotCost: 100,
    strength: 0,
    defense: 5,
    levelRequired: 1,
    rpRequired: 0
  },
  [UnitType.T1_Barrier]: {
    type: UnitType.T1_Barrier,
    name: 'Barrier',
    tier: UnitTier.Tier1,
    metalCost: 300,
    energyCost: 150,
    slotCost: 100,
    strength: 0,
    defense: 8,
    levelRequired: 1,
    rpRequired: 0
  },
  [UnitType.T1_Turret]: {
    type: UnitType.T1_Turret,
    name: 'Turret',
    tier: UnitTier.Tier1,
    metalCost: 400,
    energyCost: 200,
    slotCost: 100,
    strength: 0,
    defense: 12,
    levelRequired: 1,
    rpRequired: 0
  },
  [UnitType.T1_Shield]: {
    type: UnitType.T1_Shield,
    name: 'Shield Generator',
    tier: UnitTier.Tier1,
    metalCost: 500,
    energyCost: 250,
    slotCost: 100,
    strength: 0,
    defense: 15,
    levelRequired: 1,
    rpRequired: 0
  },

  // ==================== TIER 2: Improved Units ====================
  // STR Units
  [UnitType.T2_Commando]: {
    type: UnitType.T2_Commando,
    name: 'Commando',
    tier: UnitTier.Tier2,
    metalCost: 1200,
    energyCost: 600,
    slotCost: 300,
    strength: 30,
    defense: 0,
    levelRequired: 5,
    rpRequired: 5
  },
  [UnitType.T2_Ranger]: {
    type: UnitType.T2_Ranger,
    name: 'Ranger',
    tier: UnitTier.Tier2,
    metalCost: 1600,
    energyCost: 800,
    slotCost: 300,
    strength: 40,
    defense: 0,
    levelRequired: 5,
    rpRequired: 5
  },
  [UnitType.T2_Assassin]: {
    type: UnitType.T2_Assassin,
    name: 'Assassin',
    tier: UnitTier.Tier2,
    metalCost: 2000,
    energyCost: 1000,
    slotCost: 300,
    strength: 50,
    defense: 0,
    levelRequired: 5,
    rpRequired: 5
  },
  [UnitType.T2_Demolisher]: {
    type: UnitType.T2_Demolisher,
    name: 'Demolisher',
    tier: UnitTier.Tier2,
    metalCost: 2400,
    energyCost: 1200,
    slotCost: 300,
    strength: 60,
    defense: 0,
    levelRequired: 5,
    rpRequired: 5
  },
  
  // DEF Units
  [UnitType.T2_Fortress]: {
    type: UnitType.T2_Fortress,
    name: 'Fortress',
    tier: UnitTier.Tier2,
    metalCost: 1200,
    energyCost: 600,
    slotCost: 300,
    strength: 0,
    defense: 30,
    levelRequired: 5,
    rpRequired: 5
  },
  [UnitType.T2_Barricade]: {
    type: UnitType.T2_Barricade,
    name: 'Barricade',
    tier: UnitTier.Tier2,
    metalCost: 1600,
    energyCost: 800,
    slotCost: 300,
    strength: 0,
    defense: 40,
    levelRequired: 5,
    rpRequired: 5
  },
  [UnitType.T2_Cannon]: {
    type: UnitType.T2_Cannon,
    name: 'Cannon',
    tier: UnitTier.Tier2,
    metalCost: 2000,
    energyCost: 1000,
    slotCost: 300,
    strength: 0,
    defense: 50,
    levelRequired: 5,
    rpRequired: 5
  },
  [UnitType.T2_Sentinel]: {
    type: UnitType.T2_Sentinel,
    name: 'Sentinel',
    tier: UnitTier.Tier2,
    metalCost: 2400,
    energyCost: 1200,
    slotCost: 300,
    strength: 0,
    defense: 60,
    levelRequired: 5,
    rpRequired: 5
  },

  // ==================== TIER 3: Advanced Units ====================
  // STR Units
  [UnitType.T3_Striker]: {
    type: UnitType.T3_Striker,
    name: 'Striker',
    tier: UnitTier.Tier3,
    metalCost: 3600,
    energyCost: 1800,
    slotCost: 700,
    strength: 90,
    defense: 0,
    levelRequired: 10,
    rpRequired: 15
  },
  [UnitType.T3_Raider]: {
    type: UnitType.T3_Raider,
    name: 'Raider',
    tier: UnitTier.Tier3,
    metalCost: 4200,
    energyCost: 2100,
    slotCost: 700,
    strength: 105,
    defense: 0,
    levelRequired: 10,
    rpRequired: 15
  },
  [UnitType.T3_Enforcer]: {
    type: UnitType.T3_Enforcer,
    name: 'Enforcer',
    tier: UnitTier.Tier3,
    metalCost: 4800,
    energyCost: 2400,
    slotCost: 700,
    strength: 120,
    defense: 0,
    levelRequired: 10,
    rpRequired: 15
  },
  [UnitType.T3_Warlord]: {
    type: UnitType.T3_Warlord,
    name: 'Warlord',
    tier: UnitTier.Tier3,
    metalCost: 5400,
    energyCost: 2700,
    slotCost: 700,
    strength: 135,
    defense: 0,
    levelRequired: 10,
    rpRequired: 15
  },
  
  // DEF Units
  [UnitType.T3_Citadel]: {
    type: UnitType.T3_Citadel,
    name: 'Citadel',
    tier: UnitTier.Tier3,
    metalCost: 3600,
    energyCost: 1800,
    slotCost: 700,
    strength: 0,
    defense: 90,
    levelRequired: 10,
    rpRequired: 15
  },
  [UnitType.T3_Bulwark]: {
    type: UnitType.T3_Bulwark,
    name: 'Bulwark',
    tier: UnitTier.Tier3,
    metalCost: 4200,
    energyCost: 2100,
    slotCost: 700,
    strength: 0,
    defense: 105,
    levelRequired: 10,
    rpRequired: 15
  },
  [UnitType.T3_Artillery]: {
    type: UnitType.T3_Artillery,
    name: 'Artillery',
    tier: UnitTier.Tier3,
    metalCost: 4800,
    energyCost: 2400,
    slotCost: 700,
    strength: 0,
    defense: 120,
    levelRequired: 10,
    rpRequired: 15
  },
  [UnitType.T3_Guardian]: {
    type: UnitType.T3_Guardian,
    name: 'Guardian',
    tier: UnitTier.Tier3,
    metalCost: 5400,
    energyCost: 2700,
    slotCost: 700,
    strength: 0,
    defense: 135,
    levelRequired: 10,
    rpRequired: 15
  },

  // ==================== TIER 4: Elite Units ====================
  // STR Units
  [UnitType.T4_Titan]: {
    type: UnitType.T4_Titan,
    name: 'Titan',
    tier: UnitTier.Tier4,
    metalCost: 7200,
    energyCost: 3600,
    slotCost: 1500,
    strength: 180,
    defense: 0,
    levelRequired: 20,
    rpRequired: 30
  },
  [UnitType.T4_Juggernaut]: {
    type: UnitType.T4_Juggernaut,
    name: 'Juggernaut',
    tier: UnitTier.Tier4,
    metalCost: 8400,
    energyCost: 4200,
    slotCost: 1500,
    strength: 210,
    defense: 0,
    levelRequired: 20,
    rpRequired: 30
  },
  [UnitType.T4_Destroyer]: {
    type: UnitType.T4_Destroyer,
    name: 'Destroyer',
    tier: UnitTier.Tier4,
    metalCost: 9600,
    energyCost: 4800,
    slotCost: 1500,
    strength: 240,
    defense: 0,
    levelRequired: 20,
    rpRequired: 30
  },
  [UnitType.T4_Annihilator]: {
    type: UnitType.T4_Annihilator,
    name: 'Annihilator',
    tier: UnitTier.Tier4,
    metalCost: 10800,
    energyCost: 5400,
    slotCost: 1500,
    strength: 270,
    defense: 0,
    levelRequired: 20,
    rpRequired: 30
  },
  
  // DEF Units
  [UnitType.T4_Stronghold]: {
    type: UnitType.T4_Stronghold,
    name: 'Stronghold',
    tier: UnitTier.Tier4,
    metalCost: 7200,
    energyCost: 3600,
    slotCost: 1500,
    strength: 0,
    defense: 180,
    levelRequired: 20,
    rpRequired: 30
  },
  [UnitType.T4_Rampart]: {
    type: UnitType.T4_Rampart,
    name: 'Rampart',
    tier: UnitTier.Tier4,
    metalCost: 8400,
    energyCost: 4200,
    slotCost: 1500,
    strength: 0,
    defense: 210,
    levelRequired: 20,
    rpRequired: 30
  },
  [UnitType.T4_Dreadnought]: {
    type: UnitType.T4_Dreadnought,
    name: 'Dreadnought',
    tier: UnitTier.Tier4,
    metalCost: 9600,
    energyCost: 4800,
    slotCost: 1500,
    strength: 0,
    defense: 240,
    levelRequired: 20,
    rpRequired: 30
  },
  [UnitType.T4_Colossus]: {
    type: UnitType.T4_Colossus,
    name: 'Colossus',
    tier: UnitTier.Tier4,
    metalCost: 10800,
    energyCost: 5400,
    slotCost: 1500,
    strength: 0,
    defense: 270,
    levelRequired: 20,
    rpRequired: 30
  },

  // ==================== TIER 5: Legendary Units ====================
  // STR Units
  [UnitType.T5_Overlord]: {
    type: UnitType.T5_Overlord,
    name: 'Overlord',
    tier: UnitTier.Tier5,
    metalCost: 14400,
    energyCost: 7200,
    slotCost: 3000,
    strength: 360,
    defense: 0,
    levelRequired: 30,
    rpRequired: 50
  },
  [UnitType.T5_Conqueror]: {
    type: UnitType.T5_Conqueror,
    name: 'Conqueror',
    tier: UnitTier.Tier5,
    metalCost: 16800,
    energyCost: 8400,
    slotCost: 3000,
    strength: 420,
    defense: 0,
    levelRequired: 30,
    rpRequired: 50
  },
  [UnitType.T5_Devastator]: {
    type: UnitType.T5_Devastator,
    name: 'Devastator',
    tier: UnitTier.Tier5,
    metalCost: 19200,
    energyCost: 9600,
    slotCost: 3000,
    strength: 480,
    defense: 0,
    levelRequired: 30,
    rpRequired: 50
  },
  [UnitType.T5_Apocalypse]: {
    type: UnitType.T5_Apocalypse,
    name: 'Apocalypse',
    tier: UnitTier.Tier5,
    metalCost: 21600,
    energyCost: 10800,
    slotCost: 3000,
    strength: 540,
    defense: 0,
    levelRequired: 30,
    rpRequired: 50
  },
  
  // DEF Units
  [UnitType.T5_Bastion]: {
    type: UnitType.T5_Bastion,
    name: 'Bastion',
    tier: UnitTier.Tier5,
    metalCost: 14400,
    energyCost: 7200,
    slotCost: 3000,
    strength: 0,
    defense: 360,
    levelRequired: 30,
    rpRequired: 50
  },
  [UnitType.T5_Monolith]: {
    type: UnitType.T5_Monolith,
    name: 'Monolith',
    tier: UnitTier.Tier5,
    metalCost: 16800,
    energyCost: 8400,
    slotCost: 3000,
    strength: 0,
    defense: 420,
    levelRequired: 30,
    rpRequired: 50
  },
  [UnitType.T5_Leviathan]: {
    type: UnitType.T5_Leviathan,
    name: 'Leviathan',
    tier: UnitTier.Tier5,
    metalCost: 19200,
    energyCost: 9600,
    slotCost: 3000,
    strength: 0,
    defense: 480,
    levelRequired: 30,
    rpRequired: 50
  },
  [UnitType.T5_Immortal]: {
    type: UnitType.T5_Immortal,
    name: 'Immortal',
    tier: UnitTier.Tier5,
    metalCost: 21600,
    energyCost: 10800,
    slotCost: 3000,
    strength: 0,
    defense: 540,
    levelRequired: 30,
    rpRequired: 50
  },

  // ==================== SPECIALIZED UNITS: Offensive Doctrine ====================
  [UnitType.SPEC_OFF_Vanguard]: {
    type: UnitType.SPEC_OFF_Vanguard,
    name: 'Vanguard',
    tier: UnitTier.Tier2, // Classified as Tier2 for balance purposes
    metalCost: 4000,
    energyCost: 2000,
    slotCost: 200,
    strength: 200,
    defense: 0,
    levelRequired: 15,
    rpRequired: 25 // Must choose Offensive specialization
  },
  [UnitType.SPEC_OFF_Berserker]: {
    type: UnitType.SPEC_OFF_Berserker,
    name: 'Berserker',
    tier: UnitTier.Tier3,
    metalCost: 6500,
    energyCost: 3250,
    slotCost: 300,
    strength: 280,
    defense: 0,
    levelRequired: 15,
    rpRequired: 25
  },
  [UnitType.SPEC_OFF_Executioner]: {
    type: UnitType.SPEC_OFF_Executioner,
    name: 'Executioner',
    tier: UnitTier.Tier3,
    metalCost: 9000,
    energyCost: 4500,
    slotCost: 300,
    strength: 360,
    defense: 0,
    levelRequired: 15,
    rpRequired: 25 // Requires 25%+ mastery
  },
  [UnitType.SPEC_OFF_Annihilator]: {
    type: UnitType.SPEC_OFF_Annihilator,
    name: 'Annihilator',
    tier: UnitTier.Tier4,
    metalCost: 12000,
    energyCost: 6000,
    slotCost: 400,
    strength: 480,
    defense: 0,
    levelRequired: 15,
    rpRequired: 25 // Requires 75%+ mastery
  },
  [UnitType.SPEC_OFF_Warmonger]: {
    type: UnitType.SPEC_OFF_Warmonger,
    name: 'Warmonger',
    tier: UnitTier.Tier5,
    metalCost: 16000,
    energyCost: 8000,
    slotCost: 500,
    strength: 620,
    defense: 0,
    levelRequired: 15,
    rpRequired: 25 // Requires 100% mastery
  },

  // ==================== SPECIALIZED UNITS: Defensive Doctrine ====================
  [UnitType.SPEC_DEF_Guardian]: {
    type: UnitType.SPEC_DEF_Guardian,
    name: 'Guardian',
    tier: UnitTier.Tier2,
    metalCost: 4000,
    energyCost: 2000,
    slotCost: 200,
    strength: 0,
    defense: 200,
    levelRequired: 15,
    rpRequired: 25 // Must choose Defensive specialization
  },
  [UnitType.SPEC_DEF_Fortress]: {
    type: UnitType.SPEC_DEF_Fortress,
    name: 'Fortress',
    tier: UnitTier.Tier3,
    metalCost: 6500,
    energyCost: 3250,
    slotCost: 300,
    strength: 0,
    defense: 280,
    levelRequired: 15,
    rpRequired: 25
  },
  [UnitType.SPEC_DEF_Citadel]: {
    type: UnitType.SPEC_DEF_Citadel,
    name: 'Citadel',
    tier: UnitTier.Tier3,
    metalCost: 9000,
    energyCost: 4500,
    slotCost: 300,
    strength: 0,
    defense: 360,
    levelRequired: 15,
    rpRequired: 25 // Requires 25%+ mastery
  },
  [UnitType.SPEC_DEF_Bulwark]: {
    type: UnitType.SPEC_DEF_Bulwark,
    name: 'Bulwark',
    tier: UnitTier.Tier4,
    metalCost: 12000,
    energyCost: 6000,
    slotCost: 400,
    strength: 0,
    defense: 480,
    levelRequired: 15,
    rpRequired: 25 // Requires 75%+ mastery
  },
  [UnitType.SPEC_DEF_Invincible]: {
    type: UnitType.SPEC_DEF_Invincible,
    name: 'Invincible',
    tier: UnitTier.Tier5,
    metalCost: 16000,
    energyCost: 8000,
    slotCost: 500,
    strength: 0,
    defense: 620,
    levelRequired: 15,
    rpRequired: 25 // Requires 100% mastery
  },

  // ==================== SPECIALIZED UNITS: Tactical Doctrine ====================
  [UnitType.SPEC_TAC_Striker]: {
    type: UnitType.SPEC_TAC_Striker,
    name: 'Striker',
    tier: UnitTier.Tier2,
    metalCost: 4500,
    energyCost: 2250,
    slotCost: 200,
    strength: 120,
    defense: 120,
    levelRequired: 15,
    rpRequired: 25 // Must choose Tactical specialization
  },
  [UnitType.SPEC_TAC_Vanguard]: {
    type: UnitType.SPEC_TAC_Vanguard,
    name: 'Tactical Vanguard',
    tier: UnitTier.Tier3,
    metalCost: 7000,
    energyCost: 3500,
    slotCost: 300,
    strength: 160,
    defense: 160,
    levelRequired: 15,
    rpRequired: 25
  },
  [UnitType.SPEC_TAC_Elite]: {
    type: UnitType.SPEC_TAC_Elite,
    name: 'Elite Operative',
    tier: UnitTier.Tier3,
    metalCost: 10000,
    energyCost: 5000,
    slotCost: 300,
    strength: 210,
    defense: 210,
    levelRequired: 15,
    rpRequired: 25 // Requires 25%+ mastery
  },
  [UnitType.SPEC_TAC_Commander]: {
    type: UnitType.SPEC_TAC_Commander,
    name: 'Commander',
    tier: UnitTier.Tier4,
    metalCost: 13000,
    energyCost: 6500,
    slotCost: 400,
    strength: 280,
    defense: 280,
    levelRequired: 15,
    rpRequired: 25 // Requires 75%+ mastery
  },
  [UnitType.SPEC_TAC_Supreme]: {
    type: UnitType.SPEC_TAC_Supreme,
    name: 'Supreme Commander',
    tier: UnitTier.Tier5,
    metalCost: 17000,
    energyCost: 8500,
    slotCost: 500,
    strength: 360,
    defense: 360,
    levelRequired: 15,
    rpRequired: 25 // Requires 100% mastery
  },

  // ==================== PRESTIGE UNITS (Achievement Unlocks) ====================
  [UnitType.PRESTIGE_TITAN]: {
    type: UnitType.PRESTIGE_TITAN,
    name: 'Prestige Titan',
    tier: UnitTier.Tier5,
    metalCost: 25000,
    energyCost: 15000,
    slotCost: 6,
    strength: 700,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0 // Requires Warlord achievement
  },
  [UnitType.PRESTIGE_FABRICATOR]: {
    type: UnitType.PRESTIGE_FABRICATOR,
    name: 'Master Fabricator',
    tier: UnitTier.Tier5,
    metalCost: 20000,
    energyCost: 20000,
    slotCost: 500,
    strength: 400,
    defense: 400,
    levelRequired: 1,
    rpRequired: 0 // Requires Master Builder achievement
  },
  [UnitType.PRESTIGE_OVERLORD]: {
    type: UnitType.PRESTIGE_OVERLORD,
    name: 'Supreme Overlord',
    tier: UnitTier.Tier5,
    metalCost: 35000,
    energyCost: 25000,
    slotCost: 700,
    strength: 1000,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0 // Requires Army Supreme achievement
  },
  [UnitType.PRESTIGE_HARVESTER]: {
    type: UnitType.PRESTIGE_HARVESTER,
    name: 'Mega Harvester',
    tier: UnitTier.Tier5,
    metalCost: 22000,
    energyCost: 22000,
    slotCost: 500,
    strength: 450,
    defense: 450,
    levelRequired: 1,
    rpRequired: 0 // Requires Resource Magnate achievement
  },
  [UnitType.PRESTIGE_VAULT_KEEPER]: {
    type: UnitType.PRESTIGE_VAULT_KEEPER,
    name: 'Vault Keeper',
    tier: UnitTier.Tier5,
    metalCost: 30000,
    energyCost: 18000,
    slotCost: 6,
    strength: 0,
    defense: 800,
    levelRequired: 1,
    rpRequired: 0 // Requires The Banker achievement
  },
  [UnitType.PRESTIGE_MYSTIC]: {
    type: UnitType.PRESTIGE_MYSTIC,
    name: 'Shrine Mystic',
    tier: UnitTier.Tier5,
    metalCost: 24000,
    energyCost: 24000,
    slotCost: 6,
    strength: 500,
    defense: 500,
    levelRequired: 1,
    rpRequired: 0 // Requires Shrine Devotee achievement
  },
  [UnitType.PRESTIGE_ANCIENT_SENTINEL]: {
    type: UnitType.PRESTIGE_ANCIENT_SENTINEL,
    name: 'Ancient Sentinel',
    tier: UnitTier.Tier5,
    metalCost: 26000,
    energyCost: 26000,
    slotCost: 6,
    strength: 550,
    defense: 550,
    levelRequired: 1,
    rpRequired: 0 // Requires Archaeologist achievement
  },
  [UnitType.PRESTIGE_SPELUNKER]: {
    type: UnitType.PRESTIGE_SPELUNKER,
    name: 'Master Spelunker',
    tier: UnitTier.Tier5,
    metalCost: 20000,
    energyCost: 20000,
    slotCost: 500,
    strength: 400,
    defense: 400,
    levelRequired: 1,
    rpRequired: 0 // Requires Cave Explorer achievement
  },
  [UnitType.PRESTIGE_CHAMPION]: {
    type: UnitType.PRESTIGE_CHAMPION,
    name: 'Legendary Champion',
    tier: UnitTier.Tier5,
    metalCost: 28000,
    energyCost: 28000,
    slotCost: 700,
    strength: 600,
    defense: 600,
    levelRequired: 1,
    rpRequired: 0 // Requires Legend achievement
  },
  [UnitType.PRESTIGE_APEX_PREDATOR]: {
    type: UnitType.PRESTIGE_APEX_PREDATOR,
    name: 'Apex Predator',
    tier: UnitTier.Tier5,
    metalCost: 32000,
    energyCost: 20000,
    slotCost: 700,
    strength: 900,
    defense: 0,
    levelRequired: 1,
    rpRequired: 0 // Requires Master Specialist achievement
  }
};

/**
 * Tier unlock requirements
 * Maps tier number to level and RP requirements
 */
export const TIER_UNLOCK_REQUIREMENTS = {
  [UnitTier.Tier1]: { level: 1, rp: 0 },
  [UnitTier.Tier2]: { level: 5, rp: 5 },
  [UnitTier.Tier3]: { level: 10, rp: 15 },
  [UnitTier.Tier4]: { level: 20, rp: 30 },
  [UnitTier.Tier5]: { level: 30, rp: 50 }
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
 * @property category - STR or DEF category
 * @property rarity - Rarity tier
 * @property strength - STR contribution
 * @property defense - DEF contribution
 * @property quantity - Number of units of this type owned
 * @property createdAt - When unit was built
 */
export interface PlayerUnit {
  id: string; // Alias for unitId - battle system compatibility
  unitId: string;
  unitType: UnitType; // Added for combat modal and army management compatibility
  name: string;
  category: 'STR' | 'DEF';
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
