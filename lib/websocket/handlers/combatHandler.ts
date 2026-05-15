/**
 * Combat Event Handler
 * Created: 2025-10-19
 * Updated: 2026-05-15 — FID-20260515-BATTLE-SYSTEM-FIX
 * 
 * OVERVIEW:
 * Handles combat-related WebSocket events including attack notifications,
 * battle results, and defense alerts.
 */

import type { Server, Socket } from 'socket.io';
import { createServiceClient } from '@/lib/supabase/server';
import type { AuthenticatedUser } from '../auth';
import {
  broadcastAttackStarted,
  broadcastBattleResult,
  notifyDefenseAlert,
} from '../broadcast';
import { joinBattleRoom } from '../rooms';
import type {
  CombatAttackStartedPayload,
  CombatBattleResultPayload,
  CombatDefenseAlertPayload,
} from '@/types/websocket';

interface ParticipantInfo {
  username: string;
  clan_id: string | null;
}

export async function handleBattleStart(
  io: Server,
  attackerId: string,
  defenderId: string,
  location: { x: number; y: number }
): Promise<void> {
  try {
    const supabase = createServiceClient();
    
    const { data: attacker, error: attErr } = await supabase
      .from('players')
      .select('username, clan_id')
      .eq('username', attackerId)
      .single();
    
    const { data: defender, error: defErr } = await supabase
      .from('players')
      .select('username, clan_id')
      .eq('username', defenderId)
      .single();
    
    if (attErr || !attacker || defErr || !defender) return;
    
    const battleId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const battleData = {
      id: battleId,
      attacker_username: attackerId,
      defender_username: defenderId,
      attacker_strength: 0,
      damage_dealt: 0,
      defender_defense: 0,
      outcome: 'ONGOING',
    };
    
    await supabase.from('battle_logs').insert(battleData);
    
    const payload: CombatAttackStartedPayload = {
      battleId,
      attackerId,
      attackerName: attacker.username,
      defenderId,
      defenderName: defender.username,
      attackerClanId: attacker.clan_id || undefined,
      defenderClanId: defender.clan_id || undefined,
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
  outcome: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'DRAW',
  winner: string,
  loser: string,
  casualties: { winner: number; loser: number }
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const now = Date.now();
    
    await supabase
      .from('battle_logs')
      .update({
        outcome,
        damage_dealt: casualties?.winner || 0,
        defender_defense: casualties?.loser || 0,
      })
      .eq('id', battleId);
    
    const payload: CombatBattleResultPayload = {
      battleId,
      winner,
      loser,
      casualties,
      resourcesLost: { winner: {}, loser: {} },
      experienceGained: { winner: 100, loser: 25 },
      completedAt: now,
    };
    
    await broadcastBattleResult(io, payload);
    
  } catch (error) {
    console.error('[Combat Handler] Failed to handle battle end:', error);
  }
}
