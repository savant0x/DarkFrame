/**
 * Cache Warming Module
 * 
 * Pre-populates Redis cache with frequently accessed data on server startup
 * to ensure optimal performance from the first request.
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-041 (Redis Caching Layer)
 * 
 * OVERVIEW:
 * Cache warming is the process of loading hot data into Redis before users
 * request it. This eliminates cold-start delays and ensures consistent
 * performance from server startup.
 * 
 * Warm Data Categories:
 * - Leaderboards (10 categories)
 * - Top 100 players
 * - Top 50 clans
 * - Global territory ownership map
 * 
 * When to Warm:
 * - Server startup
 * - After cache flush
 * - After major data imports
 * - Scheduled (e.g., every 6 hours)
 */

import { getDatabase } from './mongodb';



import { setCache, setCacheMultiple } from './cacheService';
// FID-20260914-009 Phase A: TerritoryKeys removed with the dead territory-warming
// branch — the `clan_territories` collection it read is unmapped on the shim and
// the warmed keys had zero readers anywhere in the codebase.
import { LeaderboardKeys, ClanKeys, PlayerKeys, CacheTTL } from './cacheKeys';
import { isRedisAvailable } from './redis';

/**
 * Cache warming statistics
 */
interface WarmingStats {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  itemsWarmed: number;
  errors: number;
  categories: string[];
}

/**
 * Warm all leaderboards
 * Caches all 10 leaderboard categories
 */
async function warmLeaderboards(): Promise<number> {
  console.log('🔥 Warming leaderboards...');
  let warmed = 0;

  try {
    const db = await getDatabase();

    // Clan leaderboards
    const [clansByPower, clansByLevel, clansByTerritories, clansByWealth, clansByKills] = 
      await Promise.all([
        db.collection('clans').find({}).sort({ power: -1 }).limit(100).toArray(),
        db.collection('clans').find({}).sort({ level: -1 }).limit(100).toArray(),
        db.collection('clans').find({}).sort({ territoryCount: -1 }).limit(100).toArray(),
        db.collection('clans').find({}).sort({ totalWealth: -1 }).limit(100).toArray(),
        db.collection('clans').find({}).sort({ totalKills: -1 }).limit(100).toArray(),
      ]);

    // Player leaderboards
    const [playersByLevel, playersByPower, playersByKills, playersByAchievements] = 
      await Promise.all([
        db.collection('players').find({}).sort({ level: -1 }).limit(100).toArray(),
        db.collection('players').find({}).sort({ power: -1 }).limit(100).toArray(),
        db.collection('players').find({}).sort({ totalKills: -1 }).limit(100).toArray(),
        db.collection('players').find({}).sort({ achievementCount: -1 }).limit(100).toArray(),
      ]);

    // Cache all leaderboards
    await Promise.all([
      setCache(LeaderboardKeys.clanPower(), clansByPower, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanLevel(), clansByLevel, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanTerritories(), clansByTerritories, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanWealth(), clansByWealth, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanKills(), clansByKills, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerLevel(), playersByLevel, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerPower(), playersByPower, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerKills(), playersByKills, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerAchievements(), playersByAchievements, CacheTTL.LEADERBOARD),
    ]);

    warmed = 9;
    console.log(`✅ Warmed ${warmed} leaderboards`);
  } catch (error) {
    console.error('❌ Error warming leaderboards:', error);
  }

  return warmed;
}

/**
 * Warm top player profiles
 * Caches top 100 players by level
 */
async function warmTopPlayers(): Promise<number> {
  console.log('🔥 Warming top player profiles...');
  let warmed = 0;

  try {
    const db = await getDatabase();
    const topPlayers = await db.collection('players')
      .find({})
      .sort({ level: -1 })
      .limit(100)
      .toArray();

    const cacheEntries = topPlayers.map((player) => ({
      key: PlayerKeys.profile((player as { _id?: { toString(): string } })._id!.toString()),
      value: {
        _id: player._id,
        username: player.username,
        level: player.level,
        power: player.power,
        clanId: player.clanId,
        currentHP: player.currentHP,
        maxHP: player.maxHP,
        x: player.x,
        y: player.y,
      },
      ttl: CacheTTL.PLAYER_PROFILE,
    }));

    await setCacheMultiple(cacheEntries);
    warmed = cacheEntries.length;
    console.log(`✅ Warmed ${warmed} player profiles`);
  } catch (error) {
    console.error('❌ Error warming player profiles:', error);
  }

  return warmed;
}

/**
 * Warm top clan stats
 * Caches top 50 clans
 */
async function warmTopClans(): Promise<number> {
  console.log('🔥 Warming top clan stats...');
  let warmed = 0;

  try {
    const db = await getDatabase();
    const topClans = await db.collection('clans')
      .find({})
      .sort({ power: -1 })
      .limit(50)
      .toArray();

    const cacheEntries = topClans.map((clan) => ({
      key: ClanKeys.stats((clan as { _id?: { toString(): string } })._id!.toString()),
      value: {
        _id: clan._id,
        name: clan.name,
        tag: clan.tag,
        level: clan.level,
        power: clan.power,
        memberCount: clan.memberCount,
        territoryCount: clan.territoryCount,
        totalWealth: clan.totalWealth,
      },
      ttl: CacheTTL.CLAN_STATS,
    }));

    await setCacheMultiple(cacheEntries);
    warmed = cacheEntries.length;
    console.log(`✅ Warmed ${warmed} clan stats`);
  } catch (error) {
    console.error('❌ Error warming clan stats:', error);
  }

  return warmed;
}

// FID-20260914-009 Phase A: warmTerritoryMap() removed. It read the unmapped
// `clan_territories` collection (a silent read no-op on the shim) to warm two
// cache keys that had no readers. The live territory source of truth is
// territoryService (tiles.base_owner), which does not consume these keys.

/**
 * Warm all hot data categories
 * Main entry point for cache warming
 * 
 * @returns Warming statistics
 * 
 * @example
 * // On server startup:
 * await warmCache();
 */
export async function warmCache(): Promise<WarmingStats> {
  const stats: WarmingStats = {
    startTime: new Date(),
    itemsWarmed: 0,
    errors: 0,
    categories: [],
  };

  console.log('🚀 Starting cache warming...');

  // Check if Redis is available
  if (!isRedisAvailable()) {
    console.warn('⚠️ Redis not available, skipping cache warming');
    stats.endTime = new Date();
    stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
    return stats;
  }

  try {
    // Warm each category in parallel (FID-20260914-009 Phase A: the territories
    // category was dead — unmapped collection, unread cache keys — and is gone).
    const [leaderboards, players, clans] = await Promise.all([
      warmLeaderboards(),
      warmTopPlayers(),
      warmTopClans(),
    ]);

    stats.itemsWarmed = leaderboards + players + clans;
    stats.categories = ['leaderboards', 'players', 'clans'];
    
    stats.endTime = new Date();
    stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

    console.log(`✅ Cache warming complete: ${stats.itemsWarmed} items in ${stats.duration}ms`);
  } catch (error) {
    console.error('❌ Cache warming failed:', error);
    stats.errors++;
    stats.endTime = new Date();
    stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
  }

  return stats;
}

/**
 * Warm leaderboards only
 * Lighter weight warming for frequent updates
 * 
 * @returns Number of leaderboards warmed
 */
export async function warmLeaderboardsOnly(): Promise<number> {
  if (!isRedisAvailable()) {
    return 0;
  }
  return await warmLeaderboards();
}

/**
 * Schedule automatic cache warming
 * Runs warming at specified interval
 * 
 * @param intervalMs - Warming interval in milliseconds (default: 6 hours)
 * 
 * @example
 * // Warm cache every 6 hours
 * scheduleWarming(6 * 60 * 60 * 1000);
 */
export function scheduleWarming(intervalMs: number = 6 * 60 * 60 * 1000): NodeJS.Timeout {
  console.log(`📅 Scheduling cache warming every ${intervalMs / 1000 / 60} minutes`);
  
  // Initial warming
  warmCache();
  
  // Schedule recurring warming
  return setInterval(() => {
    console.log('⏰ Scheduled cache warming triggered');
    warmCache();
  }, intervalMs);
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Parallel warming for speed (Promise.all)
// - Focuses on hot data (top 100 players, top 50 clans)
// - Leaderboards warmed first (most frequently accessed)
// - Territory map warmed for spatial queries
// - Graceful failure if Redis unavailable
// - Timing tracked for performance monitoring
// - Can be scheduled for automatic refresh
// ============================================================
// END OF FILE
// ============================================================
