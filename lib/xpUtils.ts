/**
 * @file lib/xpUtils.ts
 * Client-side safe XP/level calculation utilities. No server dependencies.
 * Keep pure functions here; server-only DB operations go in xpService.ts.
 */

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
  [XPAction.HARVEST_RESOURCE]: 12,
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
  return Math.max(1, Math.floor(Math.pow(totalXP / 250, 1 / 2.5)));
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
