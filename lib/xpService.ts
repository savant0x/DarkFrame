/**
 * @file lib/xpService.ts
 * @created 2025-10-17
 * @overview Core service for player progression through experience points (XP) and levels.
 *
 * Polynomial level curve: XP = 250 × L^2.5
 * Level 30 requires ~1.23M XP (not 29K)
 * Level 50 requires ~441K XP
 * Level 100 requires ~250K XP
 */

import { createServiceClient } from '@/lib/supabase/server';

export enum XPAction {
  HARVEST_RESOURCE = 'harvest_resource',
  CAVE_EXPLORATION = 'cave_exploration',
  CAVE_ITEM_RARE = 'cave_item_rare',
  CAVE_ITEM_LEGENDARY = 'cave_item_legendary',
  FACTORY_CAPTURE = 'factory_capture',
  FACTORY_UPGRADE = 'factory_upgrade',
  FACTORY_ABANDON = 'factory_abandon',
  UNIT_BUILD = 'unit_build',
  SHRINE_SACRIFICE = 'shrine_sacrifice',
  INFANTRY_ATTACK_WIN = 'infantry_attack_win',
  INFANTRY_ATTACK_LOSS = 'infantry_attack_loss',
  BASE_ATTACK_WIN = 'base_attack_win',
  BASE_ATTACK_LOSS = 'base_attack_loss',
  DEFENSE_SUCCESS = 'defense_success',
  FACTORY_DEFENSE = 'factory_defense',
  FIRST_LOGIN = 'first_login',
  DAILY_LOGIN = 'daily_login',
}

export const XP_REWARDS: Record<XPAction, number> = {
  [XPAction.HARVEST_RESOURCE]: 3,
  [XPAction.CAVE_EXPLORATION]: 30,
  [XPAction.CAVE_ITEM_RARE]: 50,
  [XPAction.CAVE_ITEM_LEGENDARY]: 100,
  [XPAction.FACTORY_CAPTURE]: 200,
  [XPAction.FACTORY_UPGRADE]: 100,
  [XPAction.FACTORY_ABANDON]: 0,
  [XPAction.UNIT_BUILD]: 10,
  [XPAction.SHRINE_SACRIFICE]: 40,
  [XPAction.INFANTRY_ATTACK_WIN]: 300,
  [XPAction.INFANTRY_ATTACK_LOSS]: 50,
  [XPAction.BASE_ATTACK_WIN]: 400,
  [XPAction.BASE_ATTACK_LOSS]: 60,
  [XPAction.DEFENSE_SUCCESS]: 150,
  [XPAction.FACTORY_DEFENSE]: 100,
  [XPAction.FIRST_LOGIN]: 200,
  [XPAction.DAILY_LOGIN]: 20,
};

/**
 * Polynomial level curve: XP = 250 × L^2.5
 * Inverse: L = (XP / 250) ^ (1/2.5)
 */
export function calculateLevel(totalXP: number): number {
  if (totalXP < 1) return 1;
  return Math.floor(Math.pow(totalXP / 250, 1 / 2.5)) + 1;
}

/** Get cumulative XP required to reach a specific level. */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(250 * Math.pow(level, 2.5));
}

/** Get XP progress within current level. */
export function getXPProgress(totalXP: number): {
  currentLevelXP: number;
  progressPercent: number;
  xpForNextLevel: number;
} {
  const level = calculateLevel(totalXP);
  const xpAtLevelStart = getXPForLevel(level);
  const xpForNextLevel = getXPForLevel(level + 1) - xpAtLevelStart;
  const currentLevelXP = totalXP - xpAtLevelStart;
  return {
    currentLevelXP,
    progressPercent: Math.min((currentLevelXP / xpForNextLevel) * 100, 100),
    xpForNextLevel,
  };
}

/** Award XP to a player, handle level-up, award 1 RP per level gained. */
export async function awardXP(playerId: string, action: XPAction, multiplier: number = 1): Promise<{ xpGained: number; newLevel: number; rpAwarded: number; xpAwarded: number; levelUp: boolean }> {
  const supabase = createServiceClient();
  const baseXP = XP_REWARDS[action] || 0;
  const xpGained = Math.floor(baseXP * multiplier);

  const { data: player } = await supabase.from('players').select('xp, level, research_points').eq('username', playerId).single();
  if (!player) throw new Error('Player not found');

  const oldLevel = player.level || 1;
  const newTotalXP = (player.xp || 0) + xpGained;
  const newLevel = calculateLevel(newTotalXP);
  const levelsGained = newLevel - oldLevel;
  const rpAwarded = levelsGained;

  await supabase.from('players').update({
    xp: newTotalXP,
    level: newLevel,
    research_points: (player.research_points || 0) + rpAwarded,
  }).eq('username', playerId);

  return { xpGained, newLevel, rpAwarded, xpAwarded: xpGained, levelUp: levelsGained > 0 };
}

export async function getPlayerXPStats(playerId: string) {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('xp, level, research_points').eq('username', playerId).single();
  if (!player) throw new Error('Player not found');
  const progress = getXPProgress(player.xp || 0);
  return { xp: player.xp || 0, level: player.level || 1, researchPoints: player.research_points || 0, ...progress };
}

export async function getTopPlayersByXP(limit: number = 10) {
  const supabase = createServiceClient();
  const { data } = await supabase.from('players').select('username, xp, level').order('xp', { ascending: false }).limit(limit);
  return data || [];
}

export async function spendResearchPoints(playerId: string, amount: number, reason: string): Promise<{ success: boolean; remaining: number }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('research_points').eq('username', playerId).single();
  if (!player || (player.research_points || 0) < amount) return { success: false, remaining: player?.research_points || 0 };
  const remaining = (player.research_points || 0) - amount;
  await supabase.from('players').update({ research_points: remaining }).eq('username', playerId);
  await supabase.from('player_rp_history').insert({ player_username: playerId, amount: -amount, reason, balance: remaining });
  return { success: true, remaining };
}
