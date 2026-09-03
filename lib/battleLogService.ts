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
 * - Drizzle ORM (MySQL) for data persistence
 * - activityLog.types.ts for battle-specific types
 */

import { db } from '@/lib/db';
import { battleLogs } from '@/lib/db/schema';
import { eq, and, or, gte, lte, desc, sql } from 'drizzle-orm';
import {
  BattleLog,
  BattleLogQuery,
  BattleLogStats,
  BattleType,
  BattleOutcome,
  UnitSnapshot
} from '@/types/activityLog.types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_QUERY_LIMIT = 50;
const MAX_QUERY_LIMIT = 500;

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

/**
 * Log a battle engagement
 */
export async function logBattle(battleLog: Omit<BattleLog, '_id'>): Promise<string> {
  try {
    const entry: BattleLog = {
      ...battleLog,
      timestamp: battleLog.timestamp || new Date()
    };
    
    await db.insert(battleLogs).values(entry as any);
    
    return (entry as any).battleId || '';
  } catch (error) {
    console.error('[BattleLog] Error logging battle:', error);
    throw new Error('Failed to log battle');
  }
}

/**
 * Log multiple battles in bulk
 */
export async function logBattlesBulk(battleLogsData: Omit<BattleLog, '_id'>[]): Promise<string[]> {
  try {
    const entries: BattleLog[] = battleLogsData.map(log => ({
      ...log,
      timestamp: log.timestamp || new Date()
    }));
    
    if (entries.length === 0) return [];
    
    await db.insert(battleLogs).values(entries as any);
    
    return entries.map(e => (e as any).battleId || '');
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
 */
export async function queryBattleLogs(query: BattleLogQuery): Promise<BattleLog[]> {
  try {
    const conditions = [];
    
    if (query.playerId) {
      conditions.push(or(
        eq(battleLogs.attackerUsername, query.playerId),
        eq(battleLogs.defenderUsername, query.playerId)
      ));
    }
    
    if (query.battleType) {
      conditions.push(eq(battleLogs.battleType, query.battleType));
    }
    
    if (query.outcome) {
      conditions.push(eq(battleLogs.outcome, query.outcome));
    }
    
    if (query.startDate) {
      conditions.push(gte(battleLogs.timestamp, query.startDate));
    }
    
    if (query.endDate) {
      conditions.push(lte(battleLogs.timestamp, query.endDate));
    }
    
    if (query.tileX !== undefined && query.tileY !== undefined) {
      conditions.push(
        and(
          eq(battleLogs.locationX, query.tileX),
          eq(battleLogs.locationY, query.tileY)
        )
      );
    }
    
    const limit = Math.min(query.limit || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
    const offset = query.offset || 0;
    
    const battles = await db
      .select()
      .from(battleLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(battleLogs.timestamp))
      .limit(limit)
      .offset(offset);
    
    return battles as unknown as BattleLog[];
  } catch (error) {
    console.error('[BattleLog] Error querying battle logs:', error);
    throw new Error('Failed to query battle logs');
  }
}

/**
 * Get battle logs for a specific player
 */
export async function getPlayerCombatLogs(playerId: string, limit: number = 50): Promise<BattleLog[]> {
  return queryBattleLogs({ playerId, limit });
}

/**
 * Get recent battle logs (last 24 hours)
 */
export async function getRecentCombatLogs(limit: number = 50): Promise<BattleLog[]> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  return queryBattleLogs({
    startDate: oneDayAgo,
    limit
  });
}

/**
 * Get battle by ID
 */
export async function getBattleById(battleId: string): Promise<BattleLog | null> {
  try {
    const battles = await db
      .select()
      .from(battleLogs)
      .where(eq(battleLogs.battleId, battleId))
      .limit(1);
    
    return (battles[0] as unknown as BattleLog) || null;
  } catch (error) {
    console.error('[BattleLog] Error getting battle by ID:', error);
    return null;
  }
}

/**
 * Get battles at specific location
 */
export async function getBattlesAtLocation(tileX: number, tileY: number, limit: number = 20): Promise<BattleLog[]> {
  return queryBattleLogs({ tileX, tileY, limit });
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

/**
 * Get battle log statistics
 */
export async function getBattleLogStats(query?: BattleLogQuery): Promise<BattleLogStats> {
  try {
    const conditions = [];
    
    if (query?.playerId) {
      conditions.push(or(
        eq(battleLogs.attackerUsername, query.playerId),
        eq(battleLogs.defenderUsername, query.playerId)
      ));
    }
    
    if (query?.startDate) {
      conditions.push(gte(battleLogs.timestamp, query.startDate));
    }
    
    if (query?.endDate) {
      conditions.push(lte(battleLogs.timestamp, query.endDate));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const totalBattlesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(battleLogs)
      .where(whereClause);
    
    const totalBattles = totalBattlesResult[0]?.count || 0;
    
    const typeStats = await db
      .select({
        battleType: battleLogs.battleType,
        count: sql<number>`count(*)`,
      })
      .from(battleLogs)
      .where(whereClause)
      .groupBy(battleLogs.battleType);
    
    const battlesByType: Record<BattleType, number> = {} as any;
    typeStats.forEach(stat => {
      battlesByType[stat.battleType as BattleType] = stat.count;
    });
    
    const outcomeStats = await db
      .select({
        outcome: battleLogs.outcome,
        count: sql<number>`count(*)`,
      })
      .from(battleLogs)
      .where(whereClause)
      .groupBy(battleLogs.outcome);
    
    const attackerWins = outcomeStats.find(s => s.outcome === BattleOutcome.ATTACKER_WIN)?.count || 0;
    const defenderWins = outcomeStats.find(s => s.outcome === BattleOutcome.DEFENDER_WIN)?.count || 0;
    const draws = outcomeStats.find(s => s.outcome === BattleOutcome.DRAW)?.count || 0;
    
    const winRate = {
      attacker: totalBattles > 0 ? (attackerWins / totalBattles) * 100 : 0,
      defender: totalBattles > 0 ? (defenderWins / totalBattles) * 100 : 0,
      draw: totalBattles > 0 ? (draws / totalBattles) * 100 : 0
    };
    
    const damageStats = await db
      .select({
        avgDamage: sql<number>`avg(${battleLogs.attackerDamageDealt} + ${battleLogs.defenderDamageDealt})`,
      })
      .from(battleLogs)
      .where(whereClause);
    
    const averageDamage = damageStats[0]?.avgDamage || 0;
    
    const unitsLostStats = await db
      .select({
        totalLost: sql<number>`sum(${battleLogs.attackerUnitsLost} + ${battleLogs.defenderUnitsLost})`,
      })
      .from(battleLogs)
      .where(whereClause);
    
    const totalUnitsLost = unitsLostStats[0]?.totalLost || 0;
    
    const attackerStats = await db
      .select({
        playerId: battleLogs.attackerUsername,
        username: battleLogs.attackerUsername,
        battlesAsAttacker: sql<number>`count(*)`,
        winsAsAttacker: sql<number>`sum(case when ${battleLogs.outcome} = ${BattleOutcome.ATTACKER_WIN} then 1 else 0 end)`,
      })
      .from(battleLogs)
      .where(whereClause)
      .groupBy(battleLogs.attackerUsername);
    
    const defenderStats = await db
      .select({
        playerId: battleLogs.defenderUsername,
        username: battleLogs.defenderUsername,
        battlesAsDefender: sql<number>`count(*)`,
        winsAsDefender: sql<number>`sum(case when ${battleLogs.outcome} = ${BattleOutcome.DEFENDER_WIN} then 1 else 0 end)`,
      })
      .from(battleLogs)
      .where(whereClause)
      .groupBy(battleLogs.defenderUsername);
    
    const playerMap = new Map<string, any>();
    
    attackerStats.forEach((stat: any) => {
      playerMap.set(stat.playerId, {
        playerId: stat.playerId,
        username: stat.username,
        battlesParticipated: stat.battlesAsAttacker,
        wins: stat.winsAsAttacker,
        losses: 0
      });
    });
    
    defenderStats.forEach((stat: any) => {
      const existing = playerMap.get(stat.playerId);
      if (existing) {
        existing.battlesParticipated += stat.battlesAsDefender;
        existing.wins += stat.winsAsDefender;
      } else {
        playerMap.set(stat.playerId, {
          playerId: stat.playerId,
          username: stat.username,
          battlesParticipated: stat.battlesAsDefender,
          wins: stat.winsAsDefender,
          losses: 0
        });
      }
    });
    
    playerMap.forEach(player => {
      player.losses = player.battlesParticipated - player.wins;
    });
    
    const mostActivePlayers = Array.from(playerMap.values())
      .sort((a, b) => b.battlesParticipated - a.battlesParticipated)
      .slice(0, 10);
    
    const deadliestUnits: Array<{
      unitType: string;
      totalDamageDealt: number;
      battlesUsed: number;
    }> = [];
    
    return {
      totalBattles,
      battlesByType,
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
    const battles = await db
      .select()
      .from(battleLogs)
      .where(or(
        eq(battleLogs.attackerUsername, playerId),
        eq(battleLogs.defenderUsername, playerId)
      ));
    
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalDamageDealt = 0;
    let totalDamageTaken = 0;
    let totalUnitsLost = 0;
    
    battles.forEach(battle => {
      const isAttacker = battle.attackerUsername === playerId;
      
      if (battle.outcome === BattleOutcome.ATTACKER_WIN && isAttacker) {
        wins++;
      } else if (battle.outcome === BattleOutcome.DEFENDER_WIN && !isAttacker) {
        wins++;
      } else if (battle.outcome === BattleOutcome.ATTACKER_WIN && !isAttacker) {
        losses++;
      } else if (battle.outcome === BattleOutcome.DEFENDER_WIN && isAttacker) {
        losses++;
      } else {
        draws++;
      }
      
      if (isAttacker) {
        totalDamageDealt += battle.attackerDamageDealt;
        totalDamageTaken += battle.defenderDamageDealt;
        totalUnitsLost += battle.attackerUnitsLost;
      } else {
        totalDamageDealt += battle.defenderDamageDealt;
        totalDamageTaken += battle.attackerDamageDealt;
        totalUnitsLost += battle.defenderUnitsLost;
      }
    });
    
    const totalBattles = battles.length;
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
 * Create indexes for optimal query performance
 * Note: With MySQL/Drizzle, indexes are managed via schema migrations.
 * This function is kept for compatibility but no longer creates indexes programmatically.
 */
export async function createBattleLogIndexes(): Promise<void> {
  console.log('[BattleLog] Indexes are managed via Drizzle schema migrations');
}

/**
 * FOOTER:
 * 
 * Implementation Notes:
 * - Battle logs provide detailed combat analytics for game balancing
 * - Player statistics track performance across all battle types
 * - MySQL indexes are defined in the Drizzle schema
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
