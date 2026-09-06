/**
 * BattleTrackingService - Tracks and aggregates player battle stats
 * @created 2025-10-19
 * @author ECHO v5.1
 *
 * OVERVIEW: Provides functions to record battles, fetch player stats, and get recent battles. Used by /api/battle/attack and /api/stats/battles endpoints.
 */
import { db } from '@/lib/db';
import { battleLogs } from '@/lib/db/schema';
import { eq, or,  desc,  sql } from 'drizzle-orm';

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
export async function recordBattle(battle: BattleRecord): Promise<void> {
  await db.insert(battleLogs).values({
    battleId: `battle_${Date.now()}`,
    battleType: 'pvp',
    timestamp: battle.timestamp,
    attackerUsername: battle.attacker,
    attackerUnits: [],
    attackerTotalSTR: battle.attackerPower,
    attackerTotalDEF: 0,
    attackerInitialHP: 0,
    attackerFinalHP: 0,
    attackerUnitsLost: 0,
    attackerUnitsCaptured: 0,
    attackerStartingHP: 0,
    attackerEndingHP: 0,
    attackerDamageDealt: 0,
    attackerXpEarned: 0,
    defenderUsername: battle.defender,
    defenderUnits: [],
    defenderTotalSTR: battle.defenderPower,
    defenderTotalDEF: 0,
    defenderInitialHP: 0,
    defenderFinalHP: 0,
    defenderUnitsLost: 0,
    defenderUnitsCaptured: 0,
    defenderStartingHP: 0,
    defenderEndingHP: 0,
    defenderDamageDealt: 0,
    defenderXpEarned: 0,
    outcome: battle.winner ? (battle.winner === battle.attacker ? 'attacker_win' : 'defender_win') : 'draw',
    rounds: [],
    totalRounds: 0,
    attackerXP: 0,
    defenderXP: 0,
    locationX: battle.factoryLocation?.x || 0,
    locationY: battle.factoryLocation?.y || 0,
  });
}

/**
 * Gets aggregated battle stats for a player
 */
export async function getPlayerBattleStats(username: string): Promise<PlayerBattleStats> {
  const winsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(battleLogs)
    .where(eq(battleLogs.outcome, 'attacker_win'));

  const _wins = winsResult[0]?.count || 0;
  
  const allBattles = await db
    .select()
    .from(battleLogs)
    .where(or(
      eq(battleLogs.attackerUsername, username),
      eq(battleLogs.defenderUsername, username)
    ));

  const totalBattles = allBattles.length;
  const playerWins = allBattles.filter(b => {
    if (b.outcome === 'attacker_win' && b.attackerUsername === username) return true;
    if (b.outcome === 'defender_win' && b.defenderUsername === username) return true;
    return false;
  }).length;

  const draws = allBattles.filter(b => !b.outcome || b.outcome === 'draw').length;
  const losses = totalBattles - playerWins - draws;
  const winRate = totalBattles > 0 ? playerWins / totalBattles : 0;

  return { username, wins: playerWins, losses, draws, winRate, totalBattles };
}

/**
 * Gets the most recent battles
 * @param limit - Number of battles to return (default: 10)
 * @returns Array of BattleRecord
 */
export async function getRecentBattles(limit: number = 10): Promise<BattleRecord[]> {
  const docs = await db
    .select()
    .from(battleLogs)
    .orderBy(desc(battleLogs.timestamp))
    .limit(limit);

  return docs.map(doc => ({
    attacker: doc.attackerUsername ?? '',
    defender: doc.defenderUsername ?? '',
    winner: doc.outcome === 'attacker_win' ? doc.attackerUsername : doc.outcome === 'defender_win' ? doc.defenderUsername : '',
    factoryLocation: { x: Number(doc.locationX) || 0, y: Number(doc.locationY) || 0 },
    attackerPower: doc.attackerTotalSTR ?? 0,
    defenderPower: doc.defenderTotalSTR ?? 0,
    factoryCaptured: false,
    timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
    details: {},
  }));
}

/**
 * IMPLEMENTATION NOTES:
 * - All stats are recalculated live for accuracy.
 * - Draws are defined as battles with winner: null.
 * - Extend for advanced stats as needed.
 */
