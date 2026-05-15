/**
 * Battle Log Service
 * 
 * Created: 2025-10-18
 * Updated: 2026-05-15 — FID-20260515-BATTLE-SYSTEM-FIX
 * 
 * OVERVIEW:
 * Specialized service for tracking combat engagements in DarkFrame.
 * Maps Supabase battle_logs rows to domain BattleLog types.
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
// MAPPING FUNCTIONS
// ============================================================================

export function mapDbBattleLogToDomain(row: Tables<'battle_logs'>): BattleLog {
  const outcome = toBattleOutcome(row.outcome);
  const isAttackerWin = outcome === BattleOutcome.ATTACKER_WIN;
  return {
    _id: row.id,
    battleId: row.id,
    battleType: BattleType.PLAYER_VS_PLAYER,
    timestamp: fromISO(row.created_at),
    attackerId: row.attacker_username,
    attackerUsername: row.attacker_username,
    defenderId: row.defender_username,
    defenderUsername: row.defender_username,
    tileX: 0,
    tileY: 0,
    outcome,
    winner: isAttackerWin ? row.attacker_username : row.defender_username,
    loser: isAttackerWin ? row.defender_username : row.attacker_username,
    attackerUnits: [],
    defenderUnits: [],
    attackerSurvivors: [],
    defenderSurvivors: [],
    attackerDamageDealt: row.attacker_strength || 0,
    defenderDamageDealt: row.defender_defense || 0,
    attackerUnitsLost: 0,
    defenderUnitsLost: 0,
    totalDamage: row.damage_dealt || 0,
    battleDurationMs: 0,
    attackerLevel: 0,
    defenderLevel: 0,
    resourcesLooted: parseResourceLoot(row.resources_stolen),
  };
}

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

function parseResourceLoot(value: Json | null): { metal: number; energy: number; } | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const metal = 'metal' in value ? Number(value.metal) : 0;
  const energy = 'energy' in value ? Number(value.energy) : 0;
  return { metal, energy };
}

function toBattleOutcome(s: string): BattleOutcome {
  switch (s) {
    case BattleOutcome.ATTACKER_WIN: return BattleOutcome.ATTACKER_WIN;
    case BattleOutcome.DEFENDER_WIN: return BattleOutcome.DEFENDER_WIN;
    case BattleOutcome.DRAW: return BattleOutcome.DRAW;
    default: return BattleOutcome.DRAW;
  }
}

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

export async function logBattle(battleLog: Omit<BattleLog, '_id'>): Promise<string> {
  try {
    const supabase = createServiceClient();

    const entry = {
      attacker_username: battleLog.attackerUsername || '',
      defender_username: battleLog.defenderUsername || '',
      attacker_strength: battleLog.attackerDamageDealt || 0,
      defender_defense: battleLog.defenderDamageDealt || 0,
      damage_dealt: battleLog.totalDamage || 0,
      outcome: battleLog.outcome || BattleOutcome.DRAW,
      resources_stolen: battleLog.resourcesLooted ?? null,
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

export async function logBattlesBulk(battleLogs: Omit<BattleLog, '_id'>[]): Promise<string[]> {
  try {
    const supabase = createServiceClient();

    const entries = battleLogs.map(log => ({
      attacker_username: log.attackerUsername || '',
      defender_username: log.defenderUsername || '',
      attacker_strength: log.attackerDamageDealt || 0,
      defender_defense: log.defenderDamageDealt || 0,
      damage_dealt: log.totalDamage || 0,
      outcome: log.outcome || BattleOutcome.DRAW,
      resources_stolen: log.resourcesLooted ? JSON.stringify(log.resourcesLooted) : null,
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

    return (data || []).map((row) => mapDbBattleLogToDomain(row));
  } catch (error) {
    console.error('[BattleLog] Error querying battle logs:', error);
    throw new Error('Failed to query battle logs');
  }
}

export async function getPlayerCombatLogs(playerId: string, limit: number = 50): Promise<BattleLog[]> {
  return queryBattleLogs({ playerId, limit } as BattleLogQuery);
}

export async function getRecentCombatLogs(limit: number = 50): Promise<BattleLog[]> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  return queryBattleLogs({
    startDate: oneDayAgo,
    limit
  } as BattleLogQuery);
}

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

    return mapDbBattleLogToDomain(data);
  } catch (error) {
    console.error('[BattleLog] Error getting battle by ID:', error);
    return null;
  }
}

export async function getBattlesAtLocation(tileX: number, tileY: number, limit: number = 20): Promise<BattleLog[]> {
  return queryBattleLogs({ limit } as BattleLogQuery);
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

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

    const playerMap = new Map<string, any>();

    for (const battle of battles) {
      const bType = 'unknown';
      battlesByType[bType] = (battlesByType[bType] || 0) + 1;

      if (battle.outcome === BattleOutcome.ATTACKER_WIN) attackerWins++;
      else if (battle.outcome === BattleOutcome.DEFENDER_WIN) defenderWins++;
      else if (battle.outcome === BattleOutcome.DRAW) draws++;

      totalDamage += battle.damage_dealt || 0;

      const attUser = battle.attacker_username;
      const defUser = battle.defender_username;

      if (attUser) {
        const existing = playerMap.get(attUser);
        if (existing) {
          existing.battlesParticipated++;
          if (battle.outcome === BattleOutcome.ATTACKER_WIN) existing.wins++;
        } else {
          playerMap.set(attUser, {
            playerId: attUser,
            username: attUser,
            battlesParticipated: 1,
            wins: battle.outcome === BattleOutcome.ATTACKER_WIN ? 1 : 0,
          });
        }
      }

      if (defUser) {
        const existing = playerMap.get(defUser);
        if (existing) {
          existing.battlesParticipated++;
          if (battle.outcome === BattleOutcome.DEFENDER_WIN) existing.wins++;
        } else {
          playerMap.set(defUser, {
            playerId: defUser,
            username: defUser,
            battlesParticipated: 1,
            wins: battle.outcome === BattleOutcome.DEFENDER_WIN ? 1 : 0,
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
      battlesByType,
      winRate,
      averageDamage,
      totalUnitsLost: 0,
      mostActivePlayers,
      deadliestUnits
    };
  } catch (error) {
    console.error('[BattleLog] Error calculating battle statistics:', error);
    throw new Error('Failed to calculate battle statistics');
  }
}

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

      if (battle.outcome === BattleOutcome.ATTACKER_WIN) {
        if (isAttacker) wins++; else losses++;
      } else if (battle.outcome === BattleOutcome.DEFENDER_WIN) {
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

export async function createBattleLogIndexes(): Promise<void> {
  console.log('[BattleLog] Index management handled via Supabase migrations');
  console.log('[BattleLog] Required indexes:');
  console.log('[BattleLog]   - attacker_username + created_at (desc)');
  console.log('[BattleLog]   - defender_username + created_at (desc)');
  console.log('[BattleLog]   - id (unique)');
  console.log('[BattleLog]   - created_at (desc)');
}
