/**
 * @file lib/beerBaseAnalytics.ts
 * @created 2025-10-25
 * @updated 2025-10-25
 * 
 * OVERVIEW:
 * Beer Base analytics tracking service with 365-day retention and annual purging.
 * Tracks spawn events, defeat events, and calculates effectiveness metrics.
 * Highly optimized storage (~59 bytes/spawn, ~36 bytes/defeat).
 * 
 * STORAGE ESTIMATE:
 * - 15 spawns/day × 365 days × 59 bytes = 323 KB/year
 * - 10 defeats/day × 365 days × 36 bytes = 131 KB/year
 * - Indexes (30% overhead) = 136 KB/year
 * - Total: ~590 KB/year (200 active players)
 * 
 * ANNUAL PURGE:
 * Runs January 1st at 12:01 AM UTC via Vercel Cron
 * Deletes all events from previous year
 * Optional: Auto-export before purge
 */

import { createServiceClient } from '@/lib/supabase/server';
import { logger } from './logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Optimized spawn event (~59 bytes)
 */
export interface SpawnEvent {
  _id?: any;
  t: Date;           // timestamp
  tier: number;      // 0-5 (WEAK to GOD)
  x: number;         // position x
  y: number;         // position y
  by: string;        // "auto" | "manual" | "schedule-{id}"
  sid?: string;      // schedule ID if applicable
}

/**
 * Optimized defeat event (~36 bytes)
 */
export interface DefeatEvent {
  _id?: any;
  t: Date;           // timestamp
  tier: number;      // tier defeated
  by: string;        // username
  r: {               // rewards
    m: number;       // metal
    e: number;       // energy
  };
  alive: number;     // seconds alive
}

export interface SpawnStatistics {
  totalSpawns: number;
  dailySpawns: { date: string; count: number }[];
  tierDistribution: { tier: number; tierName: string; count: number; percentage: number }[];
  spawnSources: { source: string; count: number; percentage: number }[];
  averagePerDay: number;
}

export interface DefeatStatistics {
  totalDefeats: number;
  dailyDefeats: { date: string; count: number }[];
  defeatsByTier: { tier: number; tierName: string; count: number; percentage: number }[];
  topPlayers: { username: string; defeats: number; totalRewards: { metal: number; energy: number } }[];
  averagePerDay: number;
}

export interface EffectivenessMetrics {
  overallDefeatRate: number;
  avgLifespanByTier: { tier: number; tierName: string; avgSeconds: number; avgHours: number }[];
  engagementScore: number;
  peakActivityHours: number[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_NAMES = ['WEAK', 'MEDIUM', 'STRONG', 'ELITE', 'ULTRA', 'GOD'];

// ============================================================================
// HELPERS: Type <-> Supabase row mapping
// ============================================================================

interface SpawnRow {
  id: string;
  created_at: string;
  tier: number;
  position_x: number;
  position_y: number;
  spawned_by: string;
  schedule_id: string | null;
}

interface DefeatRow {
  id: string;
  created_at: string;
  tier: number;
  defeated_by: string;
  rewards: { m: number; e: number };
  alive_seconds: number;
}

function mapSpawnRow(row: SpawnRow): SpawnEvent {
  return {
    t: new Date(row.created_at),
    tier: row.tier,
    x: row.position_x,
    y: row.position_y,
    by: row.spawned_by,
    sid: row.schedule_id ?? undefined,
  };
}

function mapDefeatRow(row: DefeatRow): DefeatEvent {
  return {
    t: new Date(row.created_at),
    tier: row.tier,
    by: row.defeated_by,
    r: {
      m: row.rewards.m,
      e: row.rewards.e,
    },
    alive: row.alive_seconds,
  };
}

// ============================================================================
// RECORD EVENTS
// ============================================================================

/**
 * Record Beer Base spawn event
 * 
 * @param tier - Power tier (0-5)
 * @param position - Map position {x, y}
 * @param spawnedBy - "auto", "manual", or "schedule-{id}"
 * @param scheduleId - Schedule ID if spawned by schedule
 */
export async function recordSpawnEvent(
  tier: number,
  position: { x: number; y: number },
  spawnedBy: string = 'auto',
  scheduleId?: string
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const event: SpawnEvent = {
      t: new Date(),
      tier,
      x: position.x,
      y: position.y,
      by: spawnedBy,
      sid: scheduleId
    };

    await supabase.from('beer_base_spawn_events').insert({
      created_at: event.t.toISOString(),
      tier: event.tier,
      position_x: event.x,
      position_y: event.y,
      spawned_by: event.by,
      schedule_id: event.sid ?? null,
    });

    logger.info('Beer Base spawn event recorded', {
      tier: TIER_NAMES[tier],
      position,
      spawnedBy,
      scheduleId
    });
  } catch (error) {
    logger.error('Failed to record spawn event', error);
    // Don't throw - analytics shouldn't break game functionality
  }
}

/**
 * Record Beer Base defeat event
 * 
 * @param tier - Power tier defeated
 * @param defeatedBy - Username of player who defeated
 * @param rewards - Resources awarded {metal, energy}
 * @param timeAlive - Seconds between spawn and defeat
 */
export async function recordDefeatEvent(
  tier: number,
  defeatedBy: string,
  rewards: { metal: number; energy: number },
  timeAlive: number
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const event: DefeatEvent = {
      t: new Date(),
      tier,
      by: defeatedBy,
      r: {
        m: rewards.metal,
        e: rewards.energy
      },
      alive: timeAlive
    };

    await supabase.from('beer_base_defeat_events').insert({
      created_at: event.t.toISOString(),
      tier: event.tier,
      defeated_by: event.by,
      rewards: { m: event.r.m, e: event.r.e },
      alive_seconds: event.alive,
    });

    logger.info('Beer Base defeat event recorded', {
      tier: TIER_NAMES[tier],
      defeatedBy,
      timeAlive: `${(timeAlive / 3600).toFixed(1)}h`
    });
  } catch (error) {
    logger.error('Failed to record defeat event', error);
    // Don't throw - analytics shouldn't break game functionality
  }
}

// ============================================================================
// ANALYTICS QUERIES
// ============================================================================

/**
 * Get spawn statistics
 * 
 * @param startDate - Start of date range (default: 30 days ago)
 * @param endDate - End of date range (default: now)
 */
export async function getSpawnStats(
  startDate?: Date,
  endDate?: Date
): Promise<SpawnStatistics> {
  const supabase = createServiceClient();

  // Default to last 30 days
  const end = endDate || new Date();
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get all spawns in date range
  const { data: rows, error } = await supabase
    .from('beer_base_spawn_events')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch spawn stats', error);
    return {
      totalSpawns: 0,
      dailySpawns: [],
      tierDistribution: TIER_NAMES.map((tierName, tier) => ({ tier, tierName, count: 0, percentage: 0 })),
      spawnSources: [],
      averagePerDay: 0,
    };
  }

  const spawns = (rows as SpawnRow[]).map(mapSpawnRow);
  const totalSpawns = spawns.length;

  // Daily spawn counts
  const dailyMap = new Map<string, number>();
  spawns.forEach(spawn => {
    const date = spawn.t.toISOString().split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  });

  const dailySpawns = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Tier distribution
  const tierCounts = [0, 0, 0, 0, 0, 0];
  spawns.forEach(spawn => {
    if (spawn.tier >= 0 && spawn.tier <= 5) {
      tierCounts[spawn.tier]++;
    }
  });

  const tierDistribution = tierCounts.map((count, tier) => ({
    tier,
    tierName: TIER_NAMES[tier],
    count,
    percentage: totalSpawns > 0 ? (count / totalSpawns) * 100 : 0
  }));

  // Spawn sources
  const sourceMap = new Map<string, number>();
  spawns.forEach(spawn => {
    const source = spawn.by.startsWith('schedule-') ? 'schedule' : spawn.by;
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
  });

  const spawnSources = Array.from(sourceMap.entries()).map(([source, count]) => ({
    source,
    count,
    percentage: totalSpawns > 0 ? (count / totalSpawns) * 100 : 0
  }));

  // Average per day
  const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const averagePerDay = totalSpawns / daysDiff;

  return {
    totalSpawns,
    dailySpawns,
    tierDistribution,
    spawnSources,
    averagePerDay
  };
}

/**
 * Get defeat statistics
 * 
 * @param startDate - Start of date range (default: 30 days ago)
 * @param endDate - End of date range (default: now)
 */
export async function getDefeatStats(
  startDate?: Date,
  endDate?: Date
): Promise<DefeatStatistics> {
  const supabase = createServiceClient();

  // Default to last 30 days
  const end = endDate || new Date();
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get all defeats in date range
  const { data: rows, error } = await supabase
    .from('beer_base_defeat_events')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch defeat stats', error);
    return {
      totalDefeats: 0,
      dailyDefeats: [],
      defeatsByTier: TIER_NAMES.map((tierName, tier) => ({ tier, tierName, count: 0, percentage: 0 })),
      topPlayers: [],
      averagePerDay: 0,
    };
  }

  const defeats = (rows as DefeatRow[]).map(mapDefeatRow);
  const totalDefeats = defeats.length;

  // Daily defeat counts
  const dailyMap = new Map<string, number>();
  defeats.forEach(defeat => {
    const date = defeat.t.toISOString().split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
  });

  const dailyDefeats = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Defeats by tier
  const tierCounts = [0, 0, 0, 0, 0, 0];
  defeats.forEach(defeat => {
    if (defeat.tier >= 0 && defeat.tier <= 5) {
      tierCounts[defeat.tier]++;
    }
  });

  const defeatsByTier = tierCounts.map((count, tier) => ({
    tier,
    tierName: TIER_NAMES[tier],
    count,
    percentage: totalDefeats > 0 ? (count / totalDefeats) * 100 : 0
  }));

  // Top players
  const playerMap = new Map<string, { defeats: number; metal: number; energy: number }>();
  defeats.forEach(defeat => {
    const existing = playerMap.get(defeat.by) || { defeats: 0, metal: 0, energy: 0 };
    playerMap.set(defeat.by, {
      defeats: existing.defeats + 1,
      metal: existing.metal + defeat.r.m,
      energy: existing.energy + defeat.r.e
    });
  });

  const topPlayers = Array.from(playerMap.entries())
    .map(([username, data]) => ({
      username,
      defeats: data.defeats,
      totalRewards: { metal: data.metal, energy: data.energy }
    }))
    .sort((a, b) => b.defeats - a.defeats)
    .slice(0, 10);

  // Average per day
  const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const averagePerDay = totalDefeats / daysDiff;

  return {
    totalDefeats,
    dailyDefeats,
    defeatsByTier,
    topPlayers,
    averagePerDay
  };
}

/**
 * Get effectiveness metrics
 * 
 * @param startDate - Start of date range (default: 30 days ago)
 * @param endDate - End of date range (default: now)
 */
export async function getEffectivenessMetrics(
  startDate?: Date,
  endDate?: Date
): Promise<EffectivenessMetrics> {
  const supabase = createServiceClient();

  // Default to last 30 days
  const end = endDate || new Date();
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get spawns and defeats
  const [{ data: spawnRows, error: spawnError }, { data: defeatRows, error: defeatError }] = await Promise.all([
    supabase
      .from('beer_base_spawn_events')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('beer_base_defeat_events')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  if (spawnError) {
    logger.error('Failed to fetch spawn data for effectiveness metrics', spawnError);
  }
  if (defeatError) {
    logger.error('Failed to fetch defeat data for effectiveness metrics', defeatError);
  }

  const spawns = (spawnRows as SpawnRow[] || []).map(mapSpawnRow);
  const defeats = (defeatRows as DefeatRow[] || []).map(mapDefeatRow);

  // Overall defeat rate
  const overallDefeatRate = spawns.length > 0 ? (defeats.length / spawns.length) * 100 : 0;

  // Avg lifespan by tier
  const tierLifespans: { [tier: number]: number[] } = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: []
  };

  defeats.forEach(defeat => {
    if (defeat.tier >= 0 && defeat.tier <= 5) {
      tierLifespans[defeat.tier].push(defeat.alive);
    }
  });

  const avgLifespanByTier = Object.entries(tierLifespans).map(([tier, lifespans]) => {
    const avgSeconds = lifespans.length > 0
      ? lifespans.reduce((sum, val) => sum + val, 0) / lifespans.length
      : 0;
    return {
      tier: parseInt(tier),
      tierName: TIER_NAMES[parseInt(tier)],
      avgSeconds,
      avgHours: avgSeconds / 3600
    };
  });

  // Engagement score (defeats per active player per week)
  const uniquePlayers = new Set(defeats.map(d => d.by)).size;
  const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const weeks = daysDiff / 7;
  const engagementScore = uniquePlayers > 0 ? defeats.length / uniquePlayers / weeks : 0;

  // Peak activity hours
  const hourCounts = new Array(24).fill(0);
  defeats.forEach(defeat => {
    const hour = defeat.t.getUTCHours();
    hourCounts[hour]++;
  });

  const peakActivityHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(item => item.hour);

  return {
    overallDefeatRate,
    avgLifespanByTier,
    engagementScore,
    peakActivityHours
  };
}

// ============================================================================
// EXPORT FUNCTIONALITY
// ============================================================================

/**
 * Export analytics data
 * 
 * @param format - "csv" or "json"
 * @param startDate - Start of date range (default: all data)
 * @param endDate - End of date range (default: now)
 */
export async function exportAnalytics(
  format: 'csv' | 'json',
  startDate?: Date,
  endDate?: Date
): Promise<string> {
  const supabase = createServiceClient();

  const end = endDate || new Date();
  const start = startDate || new Date(0); // Beginning of time if not specified

  const [{ data: spawnRows, error: spawnError }, { data: defeatRows, error: defeatError }] = await Promise.all([
    supabase
      .from('beer_base_spawn_events')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('beer_base_defeat_events')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  if (spawnError) {
    logger.error('Failed to fetch spawn data for export', spawnError);
  }
  if (defeatError) {
    logger.error('Failed to fetch defeat data for export', defeatError);
  }

  const spawns = (spawnRows as SpawnRow[] || []).map(mapSpawnRow);
  const defeats = (defeatRows as DefeatRow[] || []).map(mapDefeatRow);

  if (format === 'json') {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      spawns: spawns.map(s => ({
        timestamp: s.t.toISOString(),
        tier: TIER_NAMES[s.tier],
        position: { x: s.x, y: s.y },
        spawnedBy: s.by,
        scheduleId: s.sid
      })),
      defeats: defeats.map(d => ({
        timestamp: d.t.toISOString(),
        tier: TIER_NAMES[d.tier],
        defeatedBy: d.by,
        rewards: { metal: d.r.m, energy: d.r.e },
        timeAliveHours: (d.alive / 3600).toFixed(2)
      }))
    }, null, 2);
  } else {
    // CSV format
    let csv = 'Event Type,Timestamp,Tier,Details\n';
    
    spawns.forEach(s => {
      csv += `Spawn,${s.t.toISOString()},${TIER_NAMES[s.tier]},"x:${s.x} y:${s.y} by:${s.by}"\n`;
    });
    
    defeats.forEach(d => {
      csv += `Defeat,${d.t.toISOString()},${TIER_NAMES[d.tier]},"by:${d.by} metal:${d.r.m} energy:${d.r.e} hours:${(d.alive / 3600).toFixed(2)}"\n`;
    });
    
    return csv;
  }
}

// ============================================================================
// ANNUAL PURGE
// ============================================================================

/**
 * Purge analytics data older than 365 days
 * Runs annually on January 1st
 * 
 * @returns Count of deleted records
 */
export async function purgeOldAnalytics(): Promise<{
  spawnsDeleted: number;
  defeatsDeleted: number;
}> {
  const supabase = createServiceClient();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [{ error: spawnError, count: spawnCount }, { error: defeatError, count: defeatCount }] = await Promise.all([
    supabase
      .from('beer_base_spawn_events')
      .delete({ count: 'exact' })
      .lt('created_at', oneYearAgo.toISOString()),
    supabase
      .from('beer_base_defeat_events')
      .delete({ count: 'exact' })
      .lt('created_at', oneYearAgo.toISOString()),
  ]);

  if (spawnError) {
    logger.error('Failed to purge old spawn events', spawnError);
  }
  if (defeatError) {
    logger.error('Failed to purge old defeat events', defeatError);
  }

  logger.info('Old analytics data purged', {
    spawnsDeleted: spawnCount || 0,
    defeatsDeleted: defeatCount || 0,
    cutoffDate: oneYearAgo.toISOString()
  });

  return {
    spawnsDeleted: spawnCount || 0,
    defeatsDeleted: defeatCount || 0
  };
}
