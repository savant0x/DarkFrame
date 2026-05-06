/**
 * BattleTrackingService - Tracks and aggregates player battle stats
 * @created 2025-10-19
 * @author ECHO v5.1
 *
 * OVERVIEW: Provides functions to record battles, fetch player stats, and get recent battles. Used by /api/battle/attack and /api/stats/battles endpoints.
 */
import { createServiceClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/types/database';

export interface BattleRecord {
  attacker: string;
  defender: string;
  winner: string;
  factoryLocation: { x: number; y: number };
  attackerPower: number;
  defenderPower: number;
  factoryCaptured: boolean;
  timestamp: Date;
  details: any;
}

export interface PlayerBattleStats {
  username: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalBattles: number;
}

/**
 * Records a battle in the battleLogs collection
 */
/**
 * Records a battle in the battleLogs collection
 */
export async function recordBattle(battle: BattleRecord): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('battle_logs').insert({
    attacker_username: battle.attacker,
    defender_username: battle.defender,
    attacker_strength: battle.attackerPower,
    defender_defense: battle.defenderPower,
    outcome: battle.winner,
    damage_dealt: 0,
    created_at: battle.timestamp.toISOString(),
    resources_stolen: battle.details,
  } as unknown as TablesInsert<'battle_logs'>);
}

/**
 * Gets aggregated battle stats for a player
 */
/**
 * Gets aggregated battle stats for a player
 */
export async function getPlayerBattleStats(username: string): Promise<PlayerBattleStats> {
  const supabase = createServiceClient();

  const { count: wins } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .eq('outcome', username);

  const { count: losses } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
    .neq('outcome', username);

  const { count: draws } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
    .is('outcome', null);

  const { count: totalBattles } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .or(`attacker_username.eq.${username},defender_username.eq.${username}`);

  const winRate = (totalBattles || 0) > 0 ? (wins || 0) / (totalBattles || 1) : 0;
  return { username, wins: wins || 0, losses: losses || 0, draws: draws || 0, winRate, totalBattles: totalBattles || 0 };
}

/**
 * Gets the most recent battles
 * @param limit - Number of battles to return (default: 10)
 * @returns Array of BattleRecord
 */
export async function getRecentBattles(limit: number = 10): Promise<BattleRecord[]> {
  const supabase = createServiceClient();
  const { data: docs } = await supabase
    .from('battle_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  return (docs || []).map((doc: any) => ({
    attacker: doc.attacker ?? '',
    defender: doc.defender ?? '',
    winner: doc.winner ?? '',
    factoryLocation: doc.factory_location ?? { x: 0, y: 0 },
    attackerPower: doc.attacker_power ?? 0,
    defenderPower: doc.defender_power ?? 0,
    factoryCaptured: doc.factory_captured ?? false,
    timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
    details: doc.details ?? {},
  }));
}

/**
 * IMPLEMENTATION NOTES:
 * - All stats are recalculated live for accuracy.
 * - Draws are defined as battles with winner: null.
 * - Extend for advanced stats as needed.
 */
