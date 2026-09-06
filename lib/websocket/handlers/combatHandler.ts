/**
 * Combat Event Handler
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Handles combat-related WebSocket events including attack notifications,
 * battle results, and defense alerts.
 */

import type { Server } from 'socket.io';
import { db } from '@/lib/db';
import { players, battleLogs } from '@/lib/db/schema';

import {
  broadcastAttackStarted,
  broadcastBattleResult,

} from '../broadcast';

import type {
  CombatAttackStartedPayload,
  CombatBattleResultPayload,

} from '@/types/websocket';
import { eq } from 'drizzle-orm';

export async function handleBattleStart(
  io: Server,
  attackerId: string,
  defenderId: string,
  location: { x: number; y: number }
): Promise<void> {
  try {
    const [attacker, defender] = await Promise.all([
      db.query.players.findFirst({ where: eq(players.username, attackerId) }),
      db.query.players.findFirst({ where: eq(players.username, defenderId) }),
    ]);
    
    if (!attacker || !defender) return;
    
    const battleId = `battle_${Date.now()}_${attackerId}`;
    await db.insert(battleLogs).values({
      battleId,
      battleType: 'pvp',
      timestamp: new Date(),
      attackerUsername: attackerId,
      attackerUnits: [],
      attackerTotalSTR: 0,
      attackerTotalDEF: 0,
      attackerInitialHP: 0,
      attackerFinalHP: 0,
      attackerUnitsLost: 0,
      attackerUnitsCaptured: 0,
      attackerStartingHP: 0,
      attackerEndingHP: 0,
      attackerDamageDealt: 0,
      attackerXpEarned: 0,
      defenderUsername: defenderId,
      defenderUnits: [],
      defenderTotalSTR: 0,
      defenderTotalDEF: 0,
      defenderInitialHP: 0,
      defenderFinalHP: 0,
      defenderUnitsLost: 0,
      defenderUnitsCaptured: 0,
      defenderStartingHP: 0,
      defenderEndingHP: 0,
      defenderDamageDealt: 0,
      defenderXpEarned: 0,
      outcome: 'ongoing',
      rounds: [],
      totalRounds: 0,
      attackerXP: 0,
      defenderXP: 0,
      locationX: location.x,
      locationY: location.y,
    });
    
    const payload: CombatAttackStartedPayload = {
      battleId,
      attackerId,
      attackerName: attacker.username,
      defenderId,
      defenderName: defender.username,
      attackerClanId: attacker.clanId || undefined,
      defenderClanId: defender.clanId || undefined,
      location,
      startedAt: Date.now(),
    };
    
    await broadcastAttackStarted(io, payload);
    
  } catch (error) {
    console.error('[Combat Handler] Failed to handle battle start:', error);
  }
}

export async function handleBattleEnd(
  io: Server,
  battleId: string,
  winner: string,
  loser: string,
  casualties: { winner: number; loser: number }
): Promise<void> {
  try {
    await db.update(battleLogs).set({
      outcome: 'completed',
      attackerEndingHP: 0,
      defenderEndingHP: 0,
    }).where(eq(battleLogs.battleId, battleId));
    
    const payload: CombatBattleResultPayload = {
      battleId,
      winner,
      loser,
      casualties,
      resourcesLost: { winner: {}, loser: {} },
      experienceGained: { winner: 100, loser: 25 },
      completedAt: Date.now(),
    };
    
    await broadcastBattleResult(io, payload);
    
  } catch (error) {
    console.error('[Combat Handler] Failed to handle battle end:', error);
  }
}
