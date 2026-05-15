/**
 * BattleTrackingService - Tracks and aggregates player battle stats
 * @created 2025-10-19
 * @updated 2026-05-15 — FID-20260515-BATTLE-SYSTEM-FIX
 *
 * OVERVIEW: Provides functions to record battles, fetch player stats, and get recent battles.
 * Fixed column references to match Supabase schema (attacker_username, defender_username, outcome, created_at).
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

export async function recordBattle(battle: BattleRecord): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('battle_logs').insert({
    attacker_username: battle.attacker,
    defender_username: battle.defender,
    attacker_strength: battle.attackerPower,
    defender_defense: battle.defenderPower,
    outcome: battle.winner === battle.attacker ? 'ATTACKER_WIN' : (battle.winner === battle.defender ? 'DEFENDER_WIN' : 'DRAW'),
    damage_dealt: 0,
    created_at: battle.timestamp.toISOString(),
    resources_stolen: battle.details,
  });
}

export async function getPlayerBattleStats(username: string): Promise<PlayerBattleStats> {
  const supabase = createServiceClient();

  const { count: totalBattles } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .or(`attacker_username.eq.${username},defender_username.eq.${username}`);

  const { count: wins } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
    .or(`outcome.eq.ATTACKER_WIN,and(attacker_username.eq.${username},outcome.eq.ATTACKER_WIN),and(defender_username.eq.${username},outcome.eq.DEFENDER_WIN)`);

  const { count: draws } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
    .eq('outcome', 'DRAW');

  const total = totalBattles || 0;
  const w = wins || 0;
  const d = draws || 0;
  const l = total - w - d;
  const winRate = total > 0 ? w / total : 0;

  return { username, wins: w, losses: Math.max(0, l), draws: d, winRate, totalBattles: total };
}

export async function getRecentBattles(limit: number = 10): Promise<BattleRecord[]> {
  const supabase = createServiceClient();
  const { data: docs } = await supabase
    .from('battle_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (docs || []).map((doc: any) => ({
    attacker: doc.attacker_username ?? '',
    defender: doc.defender_username ?? '',
    winner: doc.outcome === 'ATTACKER_WIN' ? doc.attacker_username : (doc.outcome === 'DEFENDER_WIN' ? doc.defender_username : ''),
    factoryLocation: { x: 0, y: 0 },
    attackerPower: doc.attacker_strength ?? 0,
    defenderPower: doc.defender_defense ?? 0,
    factoryCaptured: doc.outcome === 'ATTACKER_WIN',
    timestamp: doc.created_at ? new Date(doc.created_at) : new Date(),
    details: doc.resources_stolen ?? {},
  }));
}
