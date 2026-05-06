/**
 * @file lib/specializationService.ts
 * @created 2025-10-17
 * @overview Specialization system for player doctrine selection and mastery progression
 * 
 * OVERVIEW:
 * Manages the 3 specialization paths (Offensive, Defensive, Tactical) that players can choose
 * at Level 15. Each specialization grants passive bonuses and unlocks 5 exclusive units.
 * Players can respec at a cost and track mastery progression (0-100%) for bonus stats.
 * 
 * SPECIALIZATION PATHS:
 * - Offensive Doctrine: +15% STR, -10% metal cost, unlocks 5 high-damage units
 * - Defensive Doctrine: +15% DEF, -10% energy cost, unlocks 5 high-defense units
 * - Tactical Doctrine: +10% STR/DEF for balanced units, -5% all costs, unlocks 5 hybrid units
 * 
 * MASTERY SYSTEM:
 * - Gain mastery by: building specialized units, winning battles, completing objectives
 * - Mastery grants scaling bonuses: 25% = +5%, 50% = +10%, 75% = +15%, 100% = +20%
 * - 100% mastery unlocks the 5th specialized unit for that path
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { logger } from './logger';
import { triggerAchievementCheck } from './statTrackingService';

/**
 * Specialization doctrine types
 */
export enum SpecializationDoctrine {
  None = 'none',
  Offensive = 'offensive',
  Defensive = 'defensive',
  Tactical = 'tactical'
}

/**
 * Specialization data structure (assembled from flat players columns)
 */
export interface Specialization {
  doctrine: SpecializationDoctrine;
  selected_at: string | null;
  mastery_level: number;
  mastery_xp: number;
  total_units_built: number;
  total_battles_won: number;
  respec_history: RespecHistoryEntry[];
  last_respec_at: string | null;
}

export interface RespecHistoryEntry {
  from_doctrine: SpecializationDoctrine;
  to_doctrine: SpecializationDoctrine;
  timestamp: string;
  rp_spent: number;
  resources_spent: { metal: number; energy: number };
}

/**
 * Specialization bonuses and requirements
 */
export const SPECIALIZATION_CONFIG = {
  [SpecializationDoctrine.Offensive]: {
    name: 'Offensive Doctrine',
    icon: '🗡️',
    description: 'Maximum damage output and aggressive tactics. Dominate the battlefield with overwhelming firepower.',
    unlockLevel: 15,
    unlockCost: 25,
    bonuses: {
      strengthMultiplier: 1.15,
      metalCostMultiplier: 0.90,
    },
    color: 'text-red-400',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500'
  },
  [SpecializationDoctrine.Defensive]: {
    name: 'Defensive Doctrine',
    icon: '🛡️',
    description: 'Impenetrable fortifications and attrition warfare. Outlast any enemy through superior defense.',
    unlockLevel: 15,
    unlockCost: 25,
    bonuses: {
      defenseMultiplier: 1.15,
      energyCostMultiplier: 0.90,
    },
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500'
  },
  [SpecializationDoctrine.Tactical]: {
    name: 'Tactical Doctrine',
    icon: '⚖️',
    description: 'Balanced warfare and versatility. Adapt to any situation with hybrid units and efficiency.',
    unlockLevel: 15,
    unlockCost: 25,
    bonuses: {
      balancedMultiplier: 1.10,
      metalCostMultiplier: 0.95,
      energyCostMultiplier: 0.95,
    },
    color: 'text-purple-400',
    bgColor: 'bg-purple-900/30',
    borderColor: 'border-purple-500'
  }
};

/**
 * Respec configuration
 */
export const RESPEC_CONFIG = {
  rpCost: 50,
  metalCost: 50000,
  energyCost: 50000,
  cooldownHours: 48
};

/**
 * Mastery XP requirements per level
 * Level 0-100, requires 100 XP per level (total 10,000 XP to max)
 */
export const MASTERY_XP_PER_LEVEL = 100;

/**
 * Mastery milestone bonuses
 */
export const MASTERY_MILESTONES = {
  25: { bonusPercent: 5, description: '+5% bonus stats to specialized units' },
  50: { bonusPercent: 10, description: '+10% bonus stats to specialized units' },
  75: { bonusPercent: 15, description: '+15% bonus stats, 4th specialized unit unlocked' },
  100: { bonusPercent: 20, description: '+20% bonus stats, 5th specialized unit unlocked, prestige available' }
};

// Player row type from database
type PlayerRow = Database['public']['Tables']['players']['Row'];

/**
 * Build a Specialization object from a player's flat columns
 */
function buildSpecializationFromPlayer(player: PlayerRow): Specialization {
  return {
    doctrine: player.spec_doctrine as SpecializationDoctrine,
    selected_at: player.spec_selected_at,
    mastery_level: player.spec_mastery_level,
    mastery_xp: player.spec_mastery_xp,
    total_units_built: player.spec_total_units_built,
    total_battles_won: player.spec_total_battles_won,
    respec_history: [],
    last_respec_at: player.spec_last_respec_at,
  };
}

/**
 * Check if player can choose a specialization
 */
export async function canChooseSpecialization(
  playerId: string
): Promise<{ 
  canChoose: boolean; 
  reason?: string; 
  currentLevel?: number;
  requiredLevel?: number;
  currentRP?: number;
  requiredRP?: number;
}> {
  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from('players')
    .select('spec_doctrine, level, research_points')
    .eq('username', playerId)
    .single();

  if (!player) {
    return { canChoose: false, reason: 'Player not found' };
  }

  if (player.spec_doctrine !== 'none') {
    return { canChoose: false, reason: 'Already has a specialization. Use respec to change.' };
  }

  const currentLevel = player.level || 1;
  const requiredLevel = 15;
  const currentRP = player.research_points || 0;
  const requiredRP = 25;

  if (currentLevel < requiredLevel) {
    return {
      canChoose: false,
      reason: `Requires Level ${requiredLevel}`,
      currentLevel,
      requiredLevel,
      currentRP,
      requiredRP
    };
  }

  if (currentRP < requiredRP) {
    return {
      canChoose: false,
      reason: `Requires ${requiredRP} Research Points`,
      currentLevel,
      requiredLevel,
      currentRP,
      requiredRP
    };
  }

  return { canChoose: true, currentLevel, requiredLevel, currentRP, requiredRP };
}

/**
 * Choose a specialization for the player
 */
export async function chooseSpecialization(
  playerId: string,
  doctrine: SpecializationDoctrine
): Promise<{
  success: boolean;
  message: string;
  specialization?: Specialization;
  rpRemaining?: number;
}> {
  if (doctrine === SpecializationDoctrine.None || !SPECIALIZATION_CONFIG[doctrine]) {
    return { success: false, message: 'Invalid specialization doctrine' };
  }

  const eligibility = await canChooseSpecialization(playerId);
  if (!eligibility.canChoose) {
    return { success: false, message: eligibility.reason || 'Cannot choose specialization' };
  }

  const supabase = createServiceClient();
  const config = SPECIALIZATION_CONFIG[doctrine];

  const { data: player } = await supabase
    .from('players')
    .select('research_points')
    .eq('username', playerId)
    .single();

  if (!player || (player.research_points || 0) < config.unlockCost) {
    return { success: false, message: 'Failed to choose specialization. Insufficient RP or player not found.' };
  }

  const now = new Date().toISOString();
  const newRp = (player.research_points || 0) - config.unlockCost;

  const { data: updated, error } = await supabase
    .from('players')
    .update({
      research_points: newRp,
      spec_doctrine: doctrine,
      spec_selected_at: now,
      spec_mastery_level: 0,
      spec_mastery_xp: 0,
      spec_total_units_built: 0,
      spec_total_battles_won: 0,
      spec_last_respec_at: null,
    })
    .eq('username', playerId)
    .select('research_points, spec_doctrine, spec_selected_at, spec_mastery_level, spec_mastery_xp, spec_total_units_built, spec_total_battles_won, spec_last_respec_at')
    .single();

  if (error || !updated) {
    return { success: false, message: 'Failed to choose specialization.' };
  }

  const newSpecialization: Specialization = {
    doctrine,
    selected_at: now,
    mastery_level: 0,
    mastery_xp: 0,
    total_units_built: 0,
    total_battles_won: 0,
    respec_history: [],
    last_respec_at: null,
  };

  logger.success('Specialization chosen', { username: playerId, doctrine, rpSpent: config.unlockCost });

  return {
    success: true,
    message: `Successfully specialized in ${config.name}!`,
    specialization: newSpecialization,
    rpRemaining: updated.research_points
  };
}

/**
 * Check if player can respec (change specialization)
 */
export async function canRespec(
  playerId: string
): Promise<{
  canRespec: boolean;
  reason?: string;
  currentRP?: number;
  currentMetal?: number;
  currentEnergy?: number;
  cooldownRemaining?: number;
}> {
  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from('players')
    .select('spec_doctrine, spec_last_respec_at, research_points, resources_metal, resources_energy')
    .eq('username', playerId)
    .single();

  if (!player) {
    return { canRespec: false, reason: 'Player not found' };
  }

  if (!player.spec_doctrine || player.spec_doctrine === 'none') {
    return { canRespec: false, reason: 'No specialization to respec from' };
  }

  const currentRP = player.research_points || 0;
  const currentMetal = player.resources_metal || 0;
  const currentEnergy = player.resources_energy || 0;

  if (currentRP < RESPEC_CONFIG.rpCost) {
    return { 
      canRespec: false, 
      reason: `Requires ${RESPEC_CONFIG.rpCost} RP (have ${currentRP})`,
      currentRP,
      currentMetal,
      currentEnergy
    };
  }

  if (currentMetal < RESPEC_CONFIG.metalCost) {
    return { 
      canRespec: false, 
      reason: `Requires ${RESPEC_CONFIG.metalCost.toLocaleString()} Metal (have ${currentMetal.toLocaleString()})`,
      currentRP,
      currentMetal,
      currentEnergy
    };
  }

  if (currentEnergy < RESPEC_CONFIG.energyCost) {
    return { 
      canRespec: false, 
      reason: `Requires ${RESPEC_CONFIG.energyCost.toLocaleString()} Energy (have ${currentEnergy.toLocaleString()})`,
      currentRP,
      currentMetal,
      currentEnergy
    };
  }

  if (player.spec_last_respec_at) {
    const cooldownMs = RESPEC_CONFIG.cooldownHours * 60 * 60 * 1000;
    const timeSinceRespec = Date.now() - new Date(player.spec_last_respec_at).getTime();
    
    if (timeSinceRespec < cooldownMs) {
      const remainingMs = cooldownMs - timeSinceRespec;
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      
      return {
        canRespec: false,
        reason: `Respec on cooldown. ${remainingHours} hours remaining.`,
        currentRP,
        currentMetal,
        currentEnergy,
        cooldownRemaining: remainingHours
      };
    }
  }

  return { canRespec: true, currentRP, currentMetal, currentEnergy };
}

/**
 * Respec player to a new specialization
 */
export async function respecSpecialization(
  playerId: string,
  newDoctrine: SpecializationDoctrine
): Promise<{
  success: boolean;
  message: string;
  specialization?: Specialization;
  rpRemaining?: number;
  metalRemaining?: number;
  energyRemaining?: number;
}> {
  if (newDoctrine === SpecializationDoctrine.None || !SPECIALIZATION_CONFIG[newDoctrine]) {
    return { success: false, message: 'Invalid specialization doctrine' };
  }

  const eligibility = await canRespec(playerId);
  if (!eligibility.canRespec) {
    return { success: false, message: eligibility.reason || 'Cannot respec' };
  }

  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from('players')
    .select('spec_doctrine, spec_last_respec_at, research_points, resources_metal, resources_energy')
    .eq('username', playerId)
    .single();

  if (!player || !player.spec_doctrine || player.spec_doctrine === 'none') {
    return { success: false, message: 'Player or specialization not found' };
  }

  const oldDoctrine = player.spec_doctrine as SpecializationDoctrine;
  if (oldDoctrine === newDoctrine) {
    return { success: false, message: 'Already specialized in this doctrine' };
  }

  const oldConfig = SPECIALIZATION_CONFIG[oldDoctrine as keyof typeof SPECIALIZATION_CONFIG];
  const newConfig = SPECIALIZATION_CONFIG[newDoctrine as keyof typeof SPECIALIZATION_CONFIG];

  const now = new Date().toISOString();

  const currentRp = player.research_points || 0;
  const currentMetal = player.resources_metal || 0;
  const currentEnergy = player.resources_energy || 0;

  const newRp = currentRp - RESPEC_CONFIG.rpCost;
  const newMetal = Math.max(0, currentMetal - RESPEC_CONFIG.metalCost);
  const newEnergy = Math.max(0, currentEnergy - RESPEC_CONFIG.energyCost);

  const { data: updated, error } = await supabase
    .from('players')
    .update({
      research_points: newRp,
      resources_metal: newMetal,
      resources_energy: newEnergy,
      spec_doctrine: newDoctrine,
      spec_selected_at: now,
      spec_mastery_level: 0,
      spec_mastery_xp: 0,
      spec_total_units_built: 0,
      spec_total_battles_won: 0,
      spec_last_respec_at: now,
    })
    .eq('username', playerId)
    .select('research_points, resources_metal, resources_energy, spec_doctrine, spec_selected_at, spec_mastery_level, spec_mastery_xp, spec_total_units_built, spec_total_battles_won, spec_last_respec_at')
    .single();

  if (error || !updated) {
    return { success: false, message: 'Failed to respec.' };
  }

  // Record respec history
  await supabase
    .from('player_respec_history')
    .insert({
      player_username: playerId,
      from_doctrine: oldDoctrine,
      to_doctrine: newDoctrine,
      rp_spent: RESPEC_CONFIG.rpCost,
      resources_metal: RESPEC_CONFIG.metalCost,
      resources_energy: RESPEC_CONFIG.energyCost,
      changed_at: now,
    });

  // Fetch respec history for the response
  const { data: historyRows } = await supabase
    .from('player_respec_history')
    .select('from_doctrine, to_doctrine, changed_at, rp_spent, resources_metal, resources_energy')
    .eq('player_username', playerId)
    .order('changed_at', { ascending: false });

  const respecHistory: RespecHistoryEntry[] = (historyRows || []).map(r => ({
    from_doctrine: r.from_doctrine as SpecializationDoctrine,
    to_doctrine: r.to_doctrine as SpecializationDoctrine,
    timestamp: r.changed_at,
    rp_spent: r.rp_spent,
    resources_spent: { metal: r.resources_metal, energy: r.resources_energy },
  }));

  const updatedSpecialization: Specialization = {
    doctrine: newDoctrine,
    selected_at: now,
    mastery_level: 0,
    mastery_xp: 0,
    total_units_built: 0,
    total_battles_won: 0,
    respec_history: respecHistory,
    last_respec_at: now,
  };

  logger.success('Specialization respec completed', {
    username: playerId,
    from: oldDoctrine,
    to: newDoctrine,
    costs: { metal: RESPEC_CONFIG.metalCost, energy: RESPEC_CONFIG.energyCost }
  });

  return {
    success: true,
    message: `Successfully respecialized from ${oldConfig.name} to ${newConfig.name}!`,
    specialization: updatedSpecialization,
    rpRemaining: updated.research_points,
    metalRemaining: updated.resources_metal,
    energyRemaining: updated.resources_energy
  };
}

/**
 * Award mastery XP and check for level-ups
 */
export async function awardMasteryXP(
  playerId: string,
  xpAmount: number,
  reason: string
): Promise<{
  success: boolean;
  message: string;
  newMasteryLevel?: number;
  newMasteryXP?: number;
  leveledUp?: boolean;
  milestonesReached?: number[];
}> {
  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from('players')
    .select('spec_doctrine, spec_mastery_level, spec_mastery_xp')
    .eq('username', playerId)
    .single();

  if (!player || !player.spec_doctrine || player.spec_doctrine === 'none') {
    return { success: false, message: 'Player has no specialization' };
  }

  const oldMasteryLevel = player.spec_mastery_level || 0;
  const oldMasteryXp = player.spec_mastery_xp || 0;
  const currentMasteryXP = oldMasteryXp + xpAmount;
  let newMasteryLevel = oldMasteryLevel;
  const milestonesReached: number[] = [];

  while (newMasteryLevel < 100 && currentMasteryXP >= (newMasteryLevel + 1) * MASTERY_XP_PER_LEVEL) {
    newMasteryLevel++;
    if ([25, 50, 75, 100].includes(newMasteryLevel)) {
      milestonesReached.push(newMasteryLevel);
    }
  }

  const leveledUp = newMasteryLevel > oldMasteryLevel;

  await supabase
    .from('players')
    .update({
      spec_mastery_xp: currentMasteryXP,
      spec_mastery_level: newMasteryLevel,
    })
    .eq('username', playerId);

  if (leveledUp || newMasteryLevel === 100) {
    await triggerAchievementCheck(playerId);
  }

  if (leveledUp) {
    logger.success('Mastery level-up', {
      username: playerId,
      oldLevel: oldMasteryLevel,
      newLevel: newMasteryLevel,
      reason
    });
  }

  return {
    success: true,
    message: leveledUp 
      ? `Mastery increased to ${newMasteryLevel}%!` 
      : `Gained ${xpAmount} mastery XP`,
    newMasteryLevel,
    newMasteryXP: currentMasteryXP,
    leveledUp,
    milestonesReached
  };
}

/**
 * Get player's specialization status
 */
export async function getSpecializationStatus(playerId: string) {
  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from('players')
    .select('spec_doctrine, spec_selected_at, spec_mastery_level, spec_mastery_xp, spec_total_units_built, spec_total_battles_won, spec_last_respec_at, level, research_points, resources_metal, resources_energy')
    .eq('username', playerId)
    .single();

  if (!player) {
    return null;
  }

  const { data: historyRows } = await supabase
    .from('player_respec_history')
    .select('from_doctrine, to_doctrine, changed_at, rp_spent, resources_metal, resources_energy')
    .eq('player_username', playerId)
    .order('changed_at', { ascending: false });

  const respecHistory: RespecHistoryEntry[] = (historyRows || []).map(r => ({
    from_doctrine: r.from_doctrine as SpecializationDoctrine,
    to_doctrine: r.to_doctrine as SpecializationDoctrine,
    timestamp: r.changed_at,
    rp_spent: r.rp_spent,
    resources_spent: { metal: r.resources_metal, energy: r.resources_energy },
  }));

  const doctrine = player.spec_doctrine as SpecializationDoctrine;
  const specialization: Specialization = {
    doctrine,
    selected_at: player.spec_selected_at,
    mastery_level: player.spec_mastery_level,
    mastery_xp: player.spec_mastery_xp,
    total_units_built: player.spec_total_units_built,
    total_battles_won: player.spec_total_battles_won,
    respec_history: respecHistory,
    last_respec_at: player.spec_last_respec_at,
  };

  const config = doctrine !== SpecializationDoctrine.None && doctrine in SPECIALIZATION_CONFIG
    ? SPECIALIZATION_CONFIG[doctrine]
    : null;

  return {
    specialization,
    config,
    playerLevel: player.level || 1,
    playerRP: player.research_points || 0,
    playerResources: { metal: player.resources_metal || 0, energy: player.resources_energy || 0 },
    canChoose: await canChooseSpecialization(playerId),
    canRespec: await canRespec(playerId)
  };
}
