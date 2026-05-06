/**
 * Cache Key Management
 * 
 * Provides consistent cache key naming conventions and utilities
 * for generating, parsing, and managing Redis cache keys.
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-041 (Redis Caching Layer)
 * 
 * OVERVIEW:
 * This module defines a standardized key naming convention for all cached
 * data in DarkFrame. Consistent key naming enables easy invalidation,
 * pattern-based deletion, and clear cache organization.
 * 
 * Key Format: {namespace}:{entity}:{identifier}[:{suffix}]
 * Examples:
 *   - leaderboard:clans:power
 *   - clan:stats:clan123
 *   - player:profile:player456
 *   - territory:ownership:map
 */

/**
 * Cache key prefixes by data type
 */
export const CachePrefix = {
  LEADERBOARD: 'leaderboard',
  CLAN: 'clan',
  PLAYER: 'player',
  TERRITORY: 'territory',
  BATTLE: 'battle',
  AUCTION: 'auction',
  FACTORY: 'factory',
  ACHIEVEMENT: 'achievement',
} as const;

/**
 * Cache TTL (Time To Live) in seconds
 */
export const CacheTTL = {
  // Leaderboards - 5 minutes
  LEADERBOARD: 300,
  
  // Clan stats - 2 minutes
  CLAN_STATS: 120,
  
  // Player profiles - 1 minute
  PLAYER_PROFILE: 60,
  
  // Territory data - 5 minutes
  TERRITORY_DATA: 300,
  
  // Battle logs - 10 minutes (historical data, changes less)
  BATTLE_LOGS: 600,
  
  // Auction listings - 30 seconds (time-sensitive)
  AUCTION_LISTINGS: 30,
  
  // Factory status - 2 minutes
  FACTORY_STATUS: 120,
  
  // Achievements - 5 minutes (rarely changes)
  ACHIEVEMENTS: 300,
} as const;

/**
 * Leaderboard cache keys
 */
export const LeaderboardKeys = {
  /**
   * Clan leaderboard by power
   */
  clanPower: () => `${CachePrefix.LEADERBOARD}:clans:power`,
  
  /**
   * Clan leaderboard by level
   */
  clanLevel: () => `${CachePrefix.LEADERBOARD}:clans:level`,
  
  /**
   * Clan leaderboard by territory count
   */
  clanTerritories: () => `${CachePrefix.LEADERBOARD}:clans:territories`,
  
  /**
   * Clan leaderboard by wealth
   */
  clanWealth: () => `${CachePrefix.LEADERBOARD}:clans:wealth`,
  
  /**
   * Clan leaderboard by total kills
   */
  clanKills: () => `${CachePrefix.LEADERBOARD}:clans:kills`,
  
  /**
   * Player leaderboard by level
   */
  playerLevel: () => `${CachePrefix.LEADERBOARD}:players:level`,
  
  /**
   * Player leaderboard by power
   */
  playerPower: () => `${CachePrefix.LEADERBOARD}:players:power`,
  
  /**
   * Player leaderboard by kills
   */
  playerKills: () => `${CachePrefix.LEADERBOARD}:players:kills`,
  
  /**
   * Player leaderboard by achievements
   */
  playerAchievements: () => `${CachePrefix.LEADERBOARD}:players:achievements`,
  
  /**
   * All leaderboard keys pattern
   */
  all: () => `${CachePrefix.LEADERBOARD}:*`,
} as const;

/**
 * Clan cache keys
 */
export const ClanKeys = {
  /**
   * Clan basic stats (member count, territory count, power)
   */
  stats: (clanId: string) => `${CachePrefix.CLAN}:stats:${clanId}`,
  
  /**
   * Clan member list
   */
  members: (clanId: string) => `${CachePrefix.CLAN}:members:${clanId}`,
  
  /**
   * Clan territories list
   */
  territories: (clanId: string) => `${CachePrefix.CLAN}:territories:${clanId}`,
  
  /**
   * Clan treasury balance
   */
  treasury: (clanId: string) => `${CachePrefix.CLAN}:treasury:${clanId}`,
  
  /**
   * Active clan wars
   */
  wars: (clanId: string) => `${CachePrefix.CLAN}:wars:${clanId}`,
  
  /**
   * Clan alliances
   */
  alliances: (clanId: string) => `${CachePrefix.CLAN}:alliances:${clanId}`,
  
  /**
   * All keys for a specific clan
   */
  allForClan: (clanId: string) => `${CachePrefix.CLAN}:*:${clanId}`,
  
  /**
   * All clan cache keys pattern
   */
  all: () => `${CachePrefix.CLAN}:*`,
} as const;

/**
 * Player cache keys
 */
export const PlayerKeys = {
  /**
   * Player profile (basic stats)
   */
  profile: (playerId: string) => `${CachePrefix.PLAYER}:profile:${playerId}`,
  
  /**
   * Player location
   */
  location: (playerId: string) => `${CachePrefix.PLAYER}:location:${playerId}`,
  
  /**
   * Player inventory summary
   */
  inventory: (playerId: string) => `${CachePrefix.PLAYER}:inventory:${playerId}`,
  
  /**
   * Player achievements
   */
  achievements: (playerId: string) => `${CachePrefix.PLAYER}:achievements:${playerId}`,
  
  /**
   * Player battle history
   */
  battles: (playerId: string) => `${CachePrefix.PLAYER}:battles:${playerId}`,
  
  /**
   * All keys for a specific player
   */
  allForPlayer: (playerId: string) => `${CachePrefix.PLAYER}:*:${playerId}`,
  
  /**
   * All player cache keys pattern
   */
  all: () => `${CachePrefix.PLAYER}:*`,
} as const;

/**
 * Territory cache keys
 */
export const TerritoryKeys = {
  /**
   * Global territory ownership map
   */
  ownershipMap: () => `${CachePrefix.TERRITORY}:ownership:map`,
  
  /**
   * Territory counts by clan
   */
  clanCounts: () => `${CachePrefix.TERRITORY}:counts:clans`,
  
  /**
   * War zone territories
   */
  warZones: () => `${CachePrefix.TERRITORY}:warzones`,
  
  /**
   * Specific tile ownership
   */
  tile: (x: number, y: number) => `${CachePrefix.TERRITORY}:tile:${x}:${y}`,
  
  /**
   * All territory cache keys pattern
   */
  all: () => `${CachePrefix.TERRITORY}:*`,
} as const;

/**
 * Battle cache keys
 */
export const BattleKeys = {
  /**
   * Recent battles global feed
   */
  recentGlobal: () => `${CachePrefix.BATTLE}:recent:global`,
  
  /**
   * Recent battles for a player
   */
  recentPlayer: (playerId: string) => `${CachePrefix.BATTLE}:recent:${playerId}`,
  
  /**
   * Battle log details
   */
  log: (battleId: string) => `${CachePrefix.BATTLE}:log:${battleId}`,
  
  /**
   * All battle cache keys pattern
   */
  all: () => `${CachePrefix.BATTLE}:*`,
} as const;

/**
 * Auction cache keys
 */
export const AuctionKeys = {
  /**
   * Active auction listings
   */
  activeListings: () => `${CachePrefix.AUCTION}:listings:active`,
  
  /**
   * Auctions by seller
   */
  bySeller: (sellerId: string) => `${CachePrefix.AUCTION}:seller:${sellerId}`,
  
  /**
   * Specific auction details
   */
  details: (auctionId: string) => `${CachePrefix.AUCTION}:details:${auctionId}`,
  
  /**
   * All auction cache keys pattern
   */
  all: () => `${CachePrefix.AUCTION}:*`,
} as const;

/**
 * Factory cache keys
 */
export const FactoryKeys = {
  /**
   * Factory at specific coordinates
   */
  atLocation: (x: number, y: number) => `${CachePrefix.FACTORY}:location:${x}:${y}`,
  
  /**
   * Factories owned by player
   */
  byPlayer: (playerId: string) => `${CachePrefix.FACTORY}:player:${playerId}`,
  
  /**
   * Factories owned by clan
   */
  byClan: (clanId: string) => `${CachePrefix.FACTORY}:clan:${clanId}`,
  
  /**
   * All factory cache keys pattern
   */
  all: () => `${CachePrefix.FACTORY}:*`,
} as const;

/**
 * Utility function to generate a custom cache key
 * 
 * @param parts - Key parts to join
 * @returns Formatted cache key
 * 
 * @example
 * const key = generateKey('custom', 'data', 'user123');
 * // Returns: "custom:data:user123"
 */
export function generateKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

/**
 * Parse a cache key into its components
 * 
 * @param key - Cache key to parse
 * @returns Array of key parts
 * 
 * @example
 * const parts = parseKey('player:profile:player123');
 * // Returns: ['player', 'profile', 'player123']
 */
export function parseKey(key: string): string[] {
  return key.split(':');
}

/**
 * Get all cache keys matching a pattern
 * Useful for bulk operations
 * 
 * @param pattern - Redis key pattern (e.g., 'player:*')
 * @returns Array of matching keys
 */
export function getKeyPattern(pattern: string): string {
  return pattern;
}

/**
 * Get TTL for a specific cache type
 * 
 * @param cacheType - Type of cached data
 * @returns TTL in seconds
 */
export function getTTL(cacheType: keyof typeof CacheTTL): number {
  return CacheTTL[cacheType];
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Consistent key naming enables pattern-based deletion
// - TTL values optimized for data volatility
// - Leaderboards: 5min (moderate change frequency)
// - Player profiles: 1min (frequent updates)
// - Territory: 5min (changes during wars)
// - Auctions: 30s (time-sensitive bidding)
// ============================================================
// END OF FILE
// ============================================================
