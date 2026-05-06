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

import { createServiceClient } from '@/lib/supabase/server';
import { setCache, setCacheMultiple } from './cacheService';
import { LeaderboardKeys, ClanKeys, PlayerKeys, TerritoryKeys, CacheTTL } from './cacheKeys';
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
    const supabase = createServiceClient();

    // Clan leaderboards
    const [clansByPower, clansByLevel, clansByTerritories, clansByWealth, clansByKills] = 
      await Promise.all([
        supabase.from('clans').select('*').order('power', { ascending: false }).limit(100),
        supabase.from('clans').select('*').order('level', { ascending: false }).limit(100),
        supabase.from('clans').select('*').order('territory_count', { ascending: false }).limit(100),
        supabase.from('clans').select('*').order('total_wealth', { ascending: false }).limit(100),
        supabase.from('clans').select('*').order('total_kills', { ascending: false }).limit(100),
      ]);

    // Player leaderboards
    const [playersByLevel, playersByPower, playersByKills, playersByAchievements] = 
      await Promise.all([
        supabase.from('players').select('*').order('level', { ascending: false }).limit(100),
        supabase.from('players').select('*').order('power', { ascending: false }).limit(100),
        supabase.from('players').select('*').order('total_kills', { ascending: false }).limit(100),
        supabase.from('players').select('*').order('achievement_count', { ascending: false }).limit(100),
      ]);

    // Cache all leaderboards
    await Promise.all([
      setCache(LeaderboardKeys.clanPower(), clansByPower.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanLevel(), clansByLevel.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanTerritories(), clansByTerritories.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanWealth(), clansByWealth.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.clanKills(), clansByKills.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerLevel(), playersByLevel.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerPower(), playersByPower.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerKills(), playersByKills.data, CacheTTL.LEADERBOARD),
      setCache(LeaderboardKeys.playerAchievements(), playersByAchievements.data, CacheTTL.LEADERBOARD),
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
    const supabase = createServiceClient();
    const { data: topPlayers } = await supabase
      .from('players')
      .select('*')
      .order('level', { ascending: false })
      .limit(100);

    const cacheEntries = (topPlayers || []).map((player: any) => ({
      key: PlayerKeys.profile(player.id),
      value: {
        _id: player.id,
        username: player.username,
        level: player.level,
        power: player.power,
        clan_id: player.clan_id,
        current_hp: player.current_hp,
        max_hp: player.max_hp,
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
    const supabase = createServiceClient();
    const { data: topClans } = await supabase
      .from('clans')
      .select('*')
      .order('power', { ascending: false })
      .limit(50);

    const cacheEntries = (topClans || []).map((clan: any) => ({
      key: ClanKeys.stats(clan.id),
      value: {
        _id: clan.id,
        name: clan.name,
        tag: clan.tag,
        level: clan.level,
        power: clan.power,
        member_count: clan.member_count,
        territory_count: clan.territory_count,
        total_wealth: clan.total_wealth,
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

/**
 * Warm territory ownership map
 * Caches global territory data
 */
async function warmTerritoryMap(): Promise<number> {
  console.log('🔥 Warming territory ownership map...');
  let warmed = 0;

  try {
    const supabase = createServiceClient();
    
    // Get all clan territories
    const { data: territories } = await supabase
      .from('clan_territories')
      .select('*');

    // Build ownership map: { "x,y": clanId }
    const ownershipMap: Record<string, string> = {};
    for (const territory of (territories || [])) {
      const key = `${territory.tile_x},${territory.tile_y}`;
      ownershipMap[key] = territory.clan_id;
    }

    // Cache the ownership map
    await setCache(
      TerritoryKeys.ownershipMap(),
      ownershipMap,
      CacheTTL.TERRITORY_DATA
    );

    // Cache territory counts by clan
    const clanCounts: Record<string, number> = {};
    for (const territory of (territories || [])) {
      clanCounts[territory.clan_id] = (clanCounts[territory.clan_id] || 0) + 1;
    }

    await setCache(
      TerritoryKeys.clanCounts(),
      clanCounts,
      CacheTTL.TERRITORY_DATA
    );

    warmed = 2;
    console.log(`✅ Warmed territory map (${(territories || []).length} territories)`);
  } catch (error) {
    console.error('❌ Error warming territory map:', error);
  }

  return warmed;
}

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
    // Warm each category in parallel
    const [leaderboards, players, clans, territories] = await Promise.all([
      warmLeaderboards(),
      warmTopPlayers(),
      warmTopClans(),
      warmTerritoryMap(),
    ]);

    stats.itemsWarmed = leaderboards + players + clans + territories;
    stats.categories = ['leaderboards', 'players', 'clans', 'territories'];
    
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
