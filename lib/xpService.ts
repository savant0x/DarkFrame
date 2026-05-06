/**
 * @file lib/xpService.ts
 * @created 2025-10-17
 * @overview Core service for player progression through experience points (XP) and levels.
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
  DAILY_LOGIN = 'daily_login'
}

export const XP_REWARDS: Record<XPAction, number> = {
  [XPAction.HARVEST_RESOURCE]: 20,
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

export function calculateLevel(totalXP: number): number {
  if (totalXP < 0) return 1;
  const LEVEL_30_XP = 30000;
  if (totalXP < LEVEL_30_XP) return Math.floor(totalXP / 1000) + 1;
  let level = 30;
  let xpAtCurrentLevel = LEVEL_30_XP;
  let xpRequiredForNextLevel = 3300;
  while (totalXP >= xpAtCurrentLevel + xpRequiredForNextLevel) {
    xpAtCurrentLevel += xpRequiredForNextLevel;
    level++;
    xpRequiredForNextLevel = Math.floor(xpRequiredForNextLevel * 1.1);
  }
  return level;
}

export function getXPForNextLevel(currentLevel: number): number {
  if (currentLevel < 30) return currentLevel * 1000;
  let xpRequired = 3300;
  for (let level = 31; level <= currentLevel; level++) {
    xpRequired = Math.floor(xpRequired * 1.1);
  }
  return xpRequired;
}

export function getXPProgress(totalXP: number): {
  currentLevelXP: number;
  progressPercent: number;
  xpForNextLevel: number;
} {
  const level = calculateLevel(totalXP);
  let xpAtLevelStart = 0;
  if (level <= 30) {
    xpAtLevelStart = (level - 1) * 1000;
    } else {
    xpAtLevelStart = 30000;
    let xpRequired = 3300;
    for (let lv = 30; lv < level; lv++) {
      xpAtLevelStart += xpRequired;
      xpRequired = Math.floor(xpRequired * 1.1);
    }
  }
  const currentLevelXP = totalXP - xpAtLevelStart;
  const xpForNextLevel = getXPForNextLevel(level);
  return { currentLevelXP, progressPercent: Math.min((currentLevelXP / xpForNextLevel) * 100, 100), xpForNextLevel };
}

export async function awardXP(
  playerId: string,
  action: XPAction,
  multiplier: number = 1
): Promise<{
  xpAwarded: number;
  totalXP: number;
  oldLevel: number;
  newLevel: number;
  levelUp: boolean;
  levelUpResult?: any;
}> {
  const supabase = createServiceClient();
  const baseXP = XP_REWARDS[action] || 0;
  const xpAwarded = baseXP * multiplier;

  const { data: player } = await supabase.from('players').select('*').eq('username', playerId).single();
  if (!player) throw new Error(`Player not found: ${playerId}`);

  const currentXP = player.xp || 0;
  const currentLevel = player.level || 1;
  const newTotalXP = currentXP + xpAwarded;
  const newLevel = calculateLevel(newTotalXP);
  const levelUp = newLevel > currentLevel;

  let levelUpResult: any;
  let rpAwarded = 0;

  if (levelUp) {
    const levelsGained = newLevel - currentLevel;
    rpAwarded = levelsGained; // 1 RP per level
  }

  await supabase.from('players').update({
    xp: newTotalXP,
    level: newLevel,
    last_xp_award: new Date().toISOString(),
    research_points: (player.research_points || 0) + rpAwarded,
    ...(levelUp ? { last_level_up: new Date().toISOString() } : {}),
  }).eq('username', playerId);

  return {
    xpAwarded,
    totalXP: newTotalXP,
    oldLevel: currentLevel,
    newLevel,
    levelUp,
    ...(levelUp ? { levelUpResult: { levelsGained: newLevel - currentLevel, newLevel, rpAwarded } } : {}),
  };
}

export async function getPlayerXPStats(playerId: string): Promise<any> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('*').eq('username', playerId).single();
  if (!player) return null;
  return {
    username: player.username,
    totalXP: player.xp || 0,
    level: player.level || 1,
    researchPoints: player.research_points || 0,
    totalLevelsGained: (player.level || 1) - 1,
  };
}

export async function getTopPlayersByXP(limit: number = 100) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('players')
    .select('username, xp, level, research_points')
    .order('xp', { ascending: false })
    .limit(limit);
  if (!data) return [];
  return data.map((p: any, index: number) => ({
    rank: index + 1,
    username: p.username,
    totalXP: p.xp || 0,
    level: p.level || 1,
    researchPoints: p.research_points || 0,
  }));
}

export async function spendResearchPoints(
  playerId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; newBalance: number; message: string }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('research_points').eq('username', playerId).single();
  if (!player) return { success: false, newBalance: 0, message: 'Player not found' };

  const currentRP = player.research_points || 0;
  if (currentRP < amount) return { success: false, newBalance: currentRP, message: `Insufficient research points. Need ${amount}, have ${currentRP}` };

  const newBalance = currentRP - amount;
  await supabase.from('players').update({ research_points: newBalance }).eq('username', playerId);

  // Log RP history
  await supabase.from('player_rp_history').insert({
    player_username: playerId,
    amount: -amount,
    balance: newBalance,
    reason,
  });

  return { success: true, newBalance, message: `Spent ${amount} RP on ${reason}` };
}
