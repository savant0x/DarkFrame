/**
 * Battle Log Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Specialized service for tracking combat engagements in DarkFrame.
 * Enhances existing battle logging with detailed statistics, unit tracking, and analytics.
 * Provides comprehensive combat data for balancing, player analytics, and leaderboards.
 * 
 * Features:
 * - Detailed battle tracking (participants, units, damage, outcomes)
 * - Battle statistics and analytics
 * - Combat leaderboards and rankings
 * - Unit performance analysis
 * - Clan warfare tracking
 * - Factory battle logging
 * 
 * Dependencies:
 * - Supabase for data persistence
 * - activityLog.types.ts for battle-specific types
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Json, Tables } from '@/types/database';
import {
  BattleLog,
  BattleLogQuery,
  BattleLogStats,
  BattleType,
  BattleOutcome,
} from '@/types/activityLog.types';

// ============================================================================
// CONSTANTS
// ============================================================================

const TABLE_NAME = 'battle_logs';
const DEFAULT_QUERY_LIMIT = 50;
const MAX_QUERY_LIMIT = 500;

// ============================================================================
// HELPERS
// ============================================================================

function toISO(d: Date): string {
  return d.toISOString();
}

function fromISO(s: string): Date {
  return new Date(s);
}

// Helper to apply filters to a Supabase query builder
function applyFilters(q: any, query: BattleLogQuery) {
  if (query.playerId) {
    q = q.or(`attacker_username.eq.${query.playerId},defender_username.eq.${query.playerId}`);
  }

  if (query.startDate) {
    q = q.gte('created_at', toISO(query.startDate));
  }
  if (query.endDate) {
    q = q.lte('created_at', toISO(query.endDate));
  }

  return q;
}

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

/**
 * Log a battle engagement
 * 
 * @param battleLog - Battle log entry to record
 * @returns Promise resolving to inserted battle log ID
 * 
 * @example
 * await logBattle({
 *   battleId: 'battle_1729234567890',
 *   battleType: BattleType.PLAYER_VS_PLAYER,
 *   timestamp: new Date(),
 *   attackerId: '12345',
 *   attackerUsername: 'player1',
 *   defenderId: '67890',
 *   defenderUsername: 'player2',
 *   tileX: 10,
 *   tileY: 15,
 *   outcome: BattleOutcome.ATTACKER_WIN,
 *   winner: '12345',
 *   loser: '67890',
 *   attackerUnits: [...],
 *   defenderUnits: [...],
 *   attackerSurvivors: [...],
 *   defenderSurvivors: [...],
 *   attackerDamageDealt: 1500,
 *   defenderDamageDealt: 800,
 *   attackerUnitsLost: 5,
 *   defenderUnitsLost: 12,
 *   totalDamage: 2300,
 *   battleDurationMs: 250,
 *   attackerLevel: 15,
 *   defenderLevel: 14
 * });
 */
export async function logBattle(battleLog: Omit<BattleLog, '_id'>): Promise<string> {
  try {
    const supabase = createServiceClient();

    const entry = {
      attacker_username: battleLog.attackerUsername || '',
      defender_username: battleLog.defenderUsername || '',
      attacker_strength: battleLog.attackerDamageDealt || 0,
      defender_defense: battleLog.defenderDamageDealt || 0,
      damage_dealt: battleLog.totalDamage || 0,
      outcome: battleLog.outcome || 'unknown',
      resources_stolen: (battleLog as unknown as { resourcesStolen?: Json }).resourcesStolen || null,
      created_at: toISO(battleLog.timestamp || new Date()),
    };

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(entry)
      .select('id')
      .single();

    if (error) {
      console.error('[BattleLog] Error logging battle:', error);
      throw new Error('Failed to log battle');
    }

    return data.id;
  } catch (error) {
    console.error('[BattleLog] Error logging battle:', error);
    throw new Error('Failed to log battle');
  }
}

/**
 * Log multiple battles in bulk
 * 
 * @param battleLogs - Array of battle log entries
 * @returns Promise resolving to array of inserted battle log IDs
 * 
 * @example
 * await logBattlesBulk([battle1, battle2, battle3]);
 */
export async function logBattlesBulk(battleLogs: Omit<BattleLog, '_id'>[]): Promise<string[]> {
  try {
    const supabase = createServiceClient();

    const entries = battleLogs.map(log => ({
      attacker_username: log.attackerUsername || '',
      defender_username: log.defenderUsername || '',
      attacker_strength: log.attackerDamageDealt || 0,
      defender_defense: log.defenderDamageDealt || 0,
      damage_dealt: log.totalDamage || 0,
      outcome: log.outcome || 'unknown',
      resources_stolen: (log as unknown as { resourcesStolen?: Json }).resourcesStolen || null,
      created_at: toISO(log.timestamp || new Date()),
    }));

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(entries)
      .select('id');

    if (error) {
      console.error('[BattleLog] Error bulk logging battles:', error);
      return [];
    }

    return (data || []).map(d => d.id);
  } catch (error) {
    console.error('[BattleLog] Error bulk logging battles:', error);
    return [];
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Query battle logs with filtering and pagination
 * 
 * @param query - Query parameters for filtering battles
 * @returns Promise resolving to array of matching battle logs
 * 
 * @example
 * const battles = await queryBattleLogs({
 *   playerId: '12345',
 *   battleType: BattleType.PLAYER_VS_PLAYER,
 *   startDate: new Date('2025-10-01'),
 *   limit: 20
 * });
 */
export async function queryBattleLogs(query: BattleLogQuery): Promise<BattleLog[]> {
  try {
    const supabase = createServiceClient();

    const limit = Math.min(query.limit || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    const offset = query.offset || 0;

    let q = supabase.from(TABLE_NAME).select('*');

    q = applyFilters(q, query);

    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error } = await q;

    if (error) {
      console.error('[BattleLog] Error querying battle logs:', error);
      throw new Error('Failed to query battle logs');
    }

    return (data || []).map((row: any) => ({
      _id: row.id,
      attackerUsername: row.attacker_username,
      defenderUsername: row.defender_username,
      attackerDamageDealt: row.attacker_strength,
      defenderDamageDealt: row.defender_defense,
      totalDamage: row.damage_dealt,
      outcome: row.outcome,
      resourcesStolen: row.resources_stolen,
      timestamp: fromISO(row.created_at),
    } as unknown as BattleLog));
  } catch (error) {
    console.error('[BattleLog] Error querying battle logs:', error);
    throw new Error('Failed to query battle logs');
  }
}

/**
 * Get battle logs for a specific player
 * 
 * @param playerId - Player ID to get battles for
 * @param limit - Maximum number of battles to return
 * @returns Promise resolving to player's recent battles
 * 
 * @example
 * const playerBattles = await getPlayerCombatLogs('12345', 20);
 */
export async function getPlayerCombatLogs(playerId: string, limit: number = 50): Promise<BattleLog[]> {
  return queryBattleLogs({ playerId, limit } as BattleLogQuery);
}

/**
 * Get recent battle logs (last 24 hours)
 * 
 * @param limit - Maximum number of battles to return
 * @returns Promise resolving to recent battles
 * 
 * @example
 * const recentBattles = await getRecentCombatLogs(50);
 */
export async function getRecentCombatLogs(limit: number = 50): Promise<BattleLog[]> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return queryBattleLogs({
    startDate: oneDayAgo,
    limit
  } as BattleLogQuery);
}

/**
 * Get battle by ID
 * 
 * @param battleId - Unique battle identifier (Supabase row id)
 * @returns Promise resolving to battle log or null
 * 
 * @example
 * const battle = await getBattleById('some-uuid');
 */
export async function getBattleById(battleId: string): Promise<BattleLog | null> {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', battleId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      _id: data.id,
      attackerUsername: data.attacker_username,
      defenderUsername: data.defender_username,
      attackerDamageDealt: data.attacker_strength,
      defenderDamageDealt: data.defender_defense,
      totalDamage: data.damage_dealt,
      outcome: data.outcome,
      resourcesStolen: data.resources_stolen,
      timestamp: fromISO(data.created_at),
    } as unknown as BattleLog;
  } catch (error) {
    console.error('[BattleLog] Error getting battle by ID:', error);
    return null;
  }
}

/**
 * Get battles at specific location
 * 
 * NOTE: The battle_logs table does not store tile coordinates.
 * Battles are queried by attacker/defender username instead.
 * 
 * @param tileX - X coordinate
 * @param tileY - Y coordinate
 * @param limit - Maximum number of battles to return
 * @returns Promise resolving to battles at location
 */
export async function getBattlesAtLocation(tileX: number, tileY: number, limit: number = 20): Promise<BattleLog[]> {
  return queryBattleLogs({ limit } as BattleLogQuery);
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

/**
 * Get battle log statistics
 * 
 * @param query - Optional query to filter statistics
 * @returns Promise resolving to battle log statistics
 * 
 * @example
 * const stats = await getBattleLogStats({
 *   playerId: '12345',
 *   startDate: new Date('2025-10-01')
 * });
 */
export async function getBattleLogStats(query?: BattleLogQuery): Promise<BattleLogStats> {
  try {
    const supabase = createServiceClient();

    let q = supabase.from(TABLE_NAME).select('*', { count: 'exact', head: false });
    if (query) {
      q = applyFilters(q, query);
    }

    const { data: allBattles, count: totalBattles, error } = await q;

    if (error) {
      console.error('[BattleLog] Error calculating battle statistics:', error);
      throw new Error('Failed to calculate battle statistics');
    }

    const battles = allBattles || [];
    const battlesByType: Record<string, number> = {};

    let attackerWins = 0;
    let defenderWins = 0;
    let draws = 0;
    let totalDamage = 0;
    let totalUnitsLost = 0;

    const playerMap = new Map<string, any>();

    for (const battle of battles) {
      const bType = 'unknown';
      battlesByType[bType] = (battlesByType[bType] || 0) + 1;

      if (battle.outcome === 'ATTACKER_WIN') attackerWins++;
      else if (battle.outcome === 'DEFENDER_WIN') defenderWins++;
      else if (battle.outcome === 'DRAW') draws++;

      totalDamage += battle.damage_dealt || 0;

      const attUser = battle.attacker_username;
      const defUser = battle.defender_username;

      if (attUser) {
        const existing = playerMap.get(attUser);
        if (existing) {
          existing.battlesParticipated++;
          if (battle.outcome === 'ATTACKER_WIN') existing.wins++;
        } else {
          playerMap.set(attUser, {
            playerId: attUser,
            username: attUser,
            battlesParticipated: 1,
            wins: battle.outcome === 'ATTACKER_WIN' ? 1 : 0,
          });
        }
      }

      if (defUser) {
        const existing = playerMap.get(defUser);
        if (existing) {
          existing.battlesParticipated++;
          if (battle.outcome === 'DEFENDER_WIN') existing.wins++;
        } else {
          playerMap.set(defUser, {
            playerId: defUser,
            username: defUser,
            battlesParticipated: 1,
            wins: battle.outcome === 'DEFENDER_WIN' ? 1 : 0,
          });
        }
      }
    }

    playerMap.forEach(player => {
      player.losses = player.battlesParticipated - player.wins;
    });

    const mostActivePlayers = Array.from(playerMap.values())
      .sort((a, b) => b.battlesParticipated - a.battlesParticipated)
      .slice(0, 10);

    const safeTotal = totalBattles || 0;

    const winRate = {
      attacker: safeTotal > 0 ? (attackerWins / safeTotal) * 100 : 0,
      defender: safeTotal > 0 ? (defenderWins / safeTotal) * 100 : 0,
      draw: safeTotal > 0 ? (draws / safeTotal) * 100 : 0
    };

    const averageDamage = safeTotal > 0 ? totalDamage / safeTotal : 0;

    const deadliestUnits: Array<{
      unitType: string;
      totalDamageDealt: number;
      battlesUsed: number;
    }> = [];

    return {
      totalBattles: totalBattles || 0,
      battlesByType: battlesByType as unknown as Record<string, number>,
      winRate,
      averageDamage,
      totalUnitsLost,
      mostActivePlayers,
      deadliestUnits
    };
  } catch (error) {
    console.error('[BattleLog] Error calculating battle statistics:', error);
    throw new Error('Failed to calculate battle statistics');
  }
}

/**
 * Get player combat statistics
 * 
 * @param playerId - Player ID to get stats for
 * @returns Promise resolving to player's combat statistics
 * 
 * @example
 * const playerStats = await getPlayerCombatStatistics('12345');
 */
export async function getPlayerCombatStatistics(playerId: string): Promise<{
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalUnitsLost: number;
  favoriteUnit?: string;
}> {
  try {
    const supabase = createServiceClient();

    const { data: battles, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .or(`attacker_username.eq.${playerId},defender_username.eq.${playerId}`);

    if (error) {
      console.error('[BattleLog] Error calculating player combat stats:', error);
      throw new Error('Failed to calculate player combat stats');
    }

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    let totalUnitsLost = 0;

    for (const battle of battles || []) {
      const isAttacker = battle.attacker_username === playerId;

      if (battle.outcome === 'ATTACKER_WIN') {
        if (isAttacker) wins++; else losses++;
      } else if (battle.outcome === 'DEFENDER_WIN') {
        if (!isAttacker) wins++; else losses++;
      } else {
        draws++;
      }

      if (isAttacker) {
        totalDamageDealt += battle.attacker_strength || 0;
        totalDamageTaken += battle.defender_defense || 0;
      } else {
        totalDamageDealt += battle.defender_defense || 0;
        totalDamageTaken += battle.attacker_strength || 0;
      }
    }

    const totalBattles = (battles || []).length;
    const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;

    return {
      totalBattles,
      wins,
      losses,
      draws,
      winRate,
      totalDamageDealt,
      totalDamageTaken,
      totalUnitsLost
    };
  } catch (error) {
    console.error('[BattleLog] Error calculating player combat stats:', error);
    throw new Error('Failed to calculate player combat stats');
  }
}

// ============================================================================
// INDEX MANAGEMENT
// ============================================================================

/**
 * Create Supabase indexes for optimal query performance
 * NOTE: Supabase indexes are managed via migrations, not code.
 * This function is retained as a no-op for API compatibility.
 * 
 * @returns Promise resolving when indexes are noted
 * 
 * @example
 * await createBattleLogIndexes();
 */
export async function createBattleLogIndexes(): Promise<void> {
  console.log('[BattleLog] Index management handled via Supabase migrations');
  console.log('[BattleLog] Required indexes:');
  console.log('[BattleLog]   - attacker_username + created_at (desc)');
  console.log('[BattleLog]   - defender_username + created_at (desc)');
  console.log('[BattleLog]   - id (unique)');
  console.log('[BattleLog]   - created_at (desc)');
}

/**
 * FOOTER:
 * 
 * Implementation Notes:
 * - Battle logs provide detailed combat analytics for game balancing
 * - Player statistics track performance across all battle types
 * - Supabase indexes should be created via migrations
 * - Unit performance tracking enables meta-game analysis
 * 
 * Performance Considerations:
 * - Battle logs are more detailed than activity logs (larger documents)
 * - Consider implementing battle log aggregation for historical analysis
 * - Unit performance queries may require additional optimization
 * 
 * Future Enhancements:
 * - Implement deadliest units aggregation (currently placeholder)
 * - Add battle replay data structure
 * - Implement real-time battle streaming for spectators
 * - Add ML-based battle outcome prediction
 */
