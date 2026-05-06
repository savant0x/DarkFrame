/**
 * @file lib/achievementService.ts
 * @created 2025-01-17
 * @overview Achievement system with 10 prestige units and automatic stat tracking
 */

import { createServiceClient } from '@/lib/supabase/server';
import { logger } from './logger';

export enum AchievementCategory {
  Combat = 'combat',
  Economic = 'economic',
  Exploration = 'exploration',
  Progression = 'progression'
}

export enum AchievementRarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary'
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  requirement: { type: string; value: number };
  reward: { unitUnlock: string; rpBonus?: number };
  unlockedAt?: Date;
  progress?: number;
}

export const ACHIEVEMENTS: Record<string, Omit<Achievement, 'unlockedAt' | 'progress'>> = {
  WARLORD: {
    id: 'WARLORD', name: 'Warlord', description: 'Win 50 battles against other players',
    category: AchievementCategory.Combat, rarity: AchievementRarity.Epic,
    requirement: { type: 'battlesWon', value: 50 },
    reward: { unitUnlock: 'PRESTIGE_TITAN', rpBonus: 100 }
  },
  MASTER_BUILDER: {
    id: 'MASTER_BUILDER', name: 'Master Builder', description: 'Build 500 total units',
    category: AchievementCategory.Combat, rarity: AchievementRarity.Rare,
    requirement: { type: 'totalUnitsBuilt', value: 500 },
    reward: { unitUnlock: 'PRESTIGE_FABRICATOR', rpBonus: 50 }
  },
  ARMY_SUPREME: {
    id: 'ARMY_SUPREME', name: 'Army Supreme', description: 'Reach 50,000 total army power',
    category: AchievementCategory.Combat, rarity: AchievementRarity.Legendary,
    requirement: { type: 'totalArmyPower', value: 50000 },
    reward: { unitUnlock: 'PRESTIGE_OVERLORD', rpBonus: 150 }
  },
  RESOURCE_MAGNATE: {
    id: 'RESOURCE_MAGNATE', name: 'Resource Magnate', description: 'Accumulate 1,000,000 total resources',
    category: AchievementCategory.Economic, rarity: AchievementRarity.Epic,
    requirement: { type: 'totalResourcesGathered', value: 1000000 },
    reward: { unitUnlock: 'PRESTIGE_HARVESTER', rpBonus: 100 }
  },
  BANKER: {
    id: 'BANKER', name: 'The Banker', description: 'Store 500,000 resources in banks',
    category: AchievementCategory.Economic, rarity: AchievementRarity.Rare,
    requirement: { type: 'totalResourcesBanked', value: 500000 },
    reward: { unitUnlock: 'PRESTIGE_VAULT_KEEPER', rpBonus: 75 }
  },
  SHRINE_DEVOTEE: {
    id: 'SHRINE_DEVOTEE', name: 'Shrine Devotee', description: 'Trade at the shrine 100 times',
    category: AchievementCategory.Economic, rarity: AchievementRarity.Rare,
    requirement: { type: 'shrineTradeCount', value: 100 },
    reward: { unitUnlock: 'PRESTIGE_MYSTIC', rpBonus: 50 }
  },
  ARCHAEOLOGIST: {
    id: 'ARCHAEOLOGIST', name: 'Archaeologist', description: 'Discover all 15 ancient technologies',
    category: AchievementCategory.Exploration, rarity: AchievementRarity.Legendary,
    requirement: { type: 'discoveriesFound', value: 15 },
    reward: { unitUnlock: 'PRESTIGE_ANCIENT_SENTINEL', rpBonus: 200 }
  },
  CAVE_EXPLORER: {
    id: 'CAVE_EXPLORER', name: 'Cave Explorer', description: 'Explore 1,000 caves and forests',
    category: AchievementCategory.Exploration, rarity: AchievementRarity.Epic,
    requirement: { type: 'cavesExplored', value: 1000 },
    reward: { unitUnlock: 'PRESTIGE_SPELUNKER', rpBonus: 100 }
  },
  LEGEND: {
    id: 'LEGEND', name: 'Legend', description: 'Reach Level 50',
    category: AchievementCategory.Progression, rarity: AchievementRarity.Legendary,
    requirement: { type: 'level', value: 50 },
    reward: { unitUnlock: 'PRESTIGE_CHAMPION', rpBonus: 250 }
  },
  MASTER_SPECIALIST: {
    id: 'MASTER_SPECIALIST', name: 'Master Specialist', description: 'Reach 100% mastery in any specialization',
    category: AchievementCategory.Progression, rarity: AchievementRarity.Epic,
    requirement: { type: 'specializationMastery', value: 100 },
    reward: { unitUnlock: 'PRESTIGE_APEX_PREDATOR', rpBonus: 150 }
  }
};

export async function checkAchievements(playerId: string): Promise<Achievement[]> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('*').eq('username', playerId).single();
  if (!player) return [];

  // Get existing achievements
  const { data: existingAchievements } = await supabase
    .from('player_achievements')
    .select('achievement_id')
    .eq('player_username', playerId);

  const unlockedIds = new Set((existingAchievements || []).map(a => a.achievement_id));
  const newlyUnlocked: Achievement[] = [];

  for (const [id, config] of Object.entries(ACHIEVEMENTS)) {
    if (unlockedIds.has(id)) continue;

    let currentValue = 0;
    switch (config.requirement.type) {
      case 'battlesWon': currentValue = player.stat_battles_won || 0; break;
      case 'totalUnitsBuilt': currentValue = player.stat_total_units_built || 0; break;
      case 'totalArmyPower': currentValue = (player.total_strength || 0) + (player.total_defense || 0); break;
      case 'totalResourcesGathered': currentValue = player.stat_total_resources_gathered || 0; break;
      case 'totalResourcesBanked': currentValue = player.stat_total_resources_banked || 0; break;
      case 'shrineTradeCount': currentValue = player.stat_shrine_trade_count || 0; break;
      case 'discoveriesFound': currentValue = 0; break;
      case 'cavesExplored': currentValue = player.stat_caves_explored || 0; break;
      case 'level': currentValue = player.level || 1; break;
      case 'specializationMastery': currentValue = player.spec_mastery_level || 0; break;
    }

    if (currentValue >= config.requirement.value) {
      const unlockedAchievement: Achievement = {
        ...config, unlockedAt: new Date(), progress: currentValue
      };

      newlyUnlocked.push(unlockedAchievement);

      // Insert into player_achievements
      await supabase.from('player_achievements').insert({
        achievement_id: id,
        player_username: playerId,
        name: config.name,
        category: config.category,
        rarity: config.rarity,
        progress: currentValue,
        description: config.description,
        req_type: config.requirement.type,
        req_value: config.requirement.value,
        reward_unit_unlock: config.reward.unitUnlock,
        reward_rp_bonus: config.reward.rpBonus || 0,
      });

      // Award RP
      if (config.reward.rpBonus && config.reward.rpBonus > 0) {
        await supabase.from('players').update({
          research_points: (player.research_points || 0) + config.reward.rpBonus,
        }).eq('username', playerId);
      }

      logger.success('Achievement unlocked!', {
        username: playerId, achievement: config.name,
        category: config.category, rarity: config.rarity,
        prestigeUnit: config.reward.unitUnlock, rpBonus: config.reward.rpBonus,
      });
    }
  }

  return newlyUnlocked;
}

export async function getAchievementProgress(playerId: string) {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('*').eq('username', playerId).single();
  if (!player) return null;

  // Get unlocked achievements
  const { data: achievements } = await supabase
    .from('player_achievements')
    .select('*')
    .eq('player_username', playerId);

  const unlockedAchievements = achievements || [];
  const unlockedIds = new Set(unlockedAchievements.map((a: any) => a.achievement_id));

  const allAchievements = Object.values(ACHIEVEMENTS).map(config => {
    const isUnlocked = unlockedIds.has(config.id);
    let currentValue = 0;
    switch (config.requirement.type) {
      case 'battlesWon': currentValue = player.stat_battles_won || 0; break;
      case 'totalUnitsBuilt': currentValue = player.stat_total_units_built || 0; break;
      case 'totalArmyPower': currentValue = (player.total_strength || 0) + (player.total_defense || 0); break;
      case 'totalResourcesGathered': currentValue = player.stat_total_resources_gathered || 0; break;
      case 'totalResourcesBanked': currentValue = player.stat_total_resources_banked || 0; break;
      case 'shrineTradeCount': currentValue = player.stat_shrine_trade_count || 0; break;
      case 'discoveriesFound': currentValue = 0; break;
      case 'cavesExplored': currentValue = player.stat_caves_explored || 0; break;
      case 'level': currentValue = player.level || 1; break;
      case 'specializationMastery': currentValue = player.spec_mastery_level || 0; break;
    }
    const progressPercent = Math.min(100, Math.floor((currentValue / config.requirement.value) * 100));
    return { ...config, isUnlocked, currentValue, progressPercent };
  });

  return {
    totalUnlocked: unlockedAchievements.length,
    totalAvailable: 10,
    progressPercent: Math.floor((unlockedAchievements.length / 10) * 100),
    achievements: allAchievements,
    completionStatus: unlockedAchievements.length >= 10 ? 'COMPLETE' : 'IN_PROGRESS',
  };
}

export async function getUnlockedPrestigeUnits(playerId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('player_achievements')
    .select('reward_unit_unlock')
    .eq('player_username', playerId);
  if (!data) return [];
  return data.filter((a: any) => a.reward_unit_unlock).map((a: any) => a.reward_unit_unlock);
}

export async function hasPrestigeUnitUnlocked(playerId: string, unitType: string): Promise<boolean> {
  const unlockedUnits = await getUnlockedPrestigeUnits(playerId);
  return unlockedUnits.includes(unitType);
}
