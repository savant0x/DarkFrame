/**
 * @file lib/achievementService.ts
 * @created 2025-01-17
 * @overview Achievement system with 10 prestige units and automatic stat tracking
 * 
 * OVERVIEW:
 * Manages achievements and unlocks prestige units based on player accomplishments.
 * Tracks 4 categories: Combat, Economic, Exploration, and Progression.
 * Each achievement unlocks a powerful prestige unit with unique bonuses.
 * Achievements are earned automatically through gameplay actions.
 * 
 * ACHIEVEMENT CATEGORIES:
 * - Combat (3): Battle victories, unit builds, PvP dominance
 * - Economic (3): Resource accumulation, trading, banking
 * - Exploration (2): Cave discoveries, map exploration
 * - Progression (2): Level milestones, specialization mastery
 * 
 * PRESTIGE UNITS:
 * - 10 unique units with exceptional stats (700-1000 power)
 * - Require achievement unlock + high resource costs
 * - Cannot be built without achievement
 */

import { getCollection } from './mongodb';
import type { Player } from '@/types/game.types';
import { logger } from './logger';

/**
 * Achievement category types
 */
export enum AchievementCategory {
  Combat = 'combat',
  Economic = 'economic',
  Exploration = 'exploration',
  Progression = 'progression'
}

/**
 * Achievement rarity/difficulty
 */
export enum AchievementRarity {
  Common = 'common',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary'
}

/**
 * Achievement unlock status
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  requirement: {
    type: string; // Stat to track
    value: number; // Threshold to reach
  };
  reward: {
    unitUnlock: string; // Prestige unit type unlocked
    rpBonus?: number; // Optional RP reward
  };
  unlockedAt?: Date;
  progress?: number; // Current progress toward requirement
}

/**
 * Complete list of 10 achievements with prestige unit unlocks
 */
export const ACHIEVEMENTS: Record<string, Omit<Achievement, 'unlockedAt' | 'progress'>> = {
  // ==================== COMBAT ACHIEVEMENTS (3) ====================
  WARLORD: {
    id: 'WARLORD',
    name: 'Warlord',
    description: 'Win 50 battles against other players',
    category: AchievementCategory.Combat,
    rarity: AchievementRarity.Epic,
    requirement: {
      type: 'battlesWon',
      value: 50
    },
    reward: {
      unitUnlock: 'PRESTIGE_TITAN',
      rpBonus: 100
    }
  },

  MASTER_BUILDER: {
    id: 'MASTER_BUILDER',
    name: 'Master Builder',
    description: 'Build 500 total units',
    category: AchievementCategory.Combat,
    rarity: AchievementRarity.Rare,
    requirement: {
      type: 'totalUnitsBuilt',
      value: 500
    },
    reward: {
      unitUnlock: 'PRESTIGE_FABRICATOR',
      rpBonus: 50
    }
  },

  ARMY_SUPREME: {
    id: 'ARMY_SUPREME',
    name: 'Army Supreme',
    description: 'Reach 50,000 total army power',
    category: AchievementCategory.Combat,
    rarity: AchievementRarity.Legendary,
    requirement: {
      type: 'totalArmyPower',
      value: 50000
    },
    reward: {
      unitUnlock: 'PRESTIGE_OVERLORD',
      rpBonus: 150
    }
  },

  // ==================== ECONOMIC ACHIEVEMENTS (3) ====================
  RESOURCE_MAGNATE: {
    id: 'RESOURCE_MAGNATE',
    name: 'Resource Magnate',
    description: 'Accumulate 1,000,000 total resources (metal + energy)',
    category: AchievementCategory.Economic,
    rarity: AchievementRarity.Epic,
    requirement: {
      type: 'totalResourcesGathered',
      value: 1000000
    },
    reward: {
      unitUnlock: 'PRESTIGE_HARVESTER',
      rpBonus: 100
    }
  },

  BANKER: {
    id: 'BANKER',
    name: 'The Banker',
    description: 'Store 500,000 resources in banks',
    category: AchievementCategory.Economic,
    rarity: AchievementRarity.Rare,
    requirement: {
      type: 'totalResourcesBanked',
      value: 500000
    },
    reward: {
      unitUnlock: 'PRESTIGE_VAULT_KEEPER',
      rpBonus: 75
    }
  },

  SHRINE_DEVOTEE: {
    id: 'SHRINE_DEVOTEE',
    name: 'Shrine Devotee',
    description: 'Trade at the shrine 100 times',
    category: AchievementCategory.Economic,
    rarity: AchievementRarity.Rare,
    requirement: {
      type: 'shrineTradeCount',
      value: 100
    },
    reward: {
      unitUnlock: 'PRESTIGE_MYSTIC',
      rpBonus: 50
    }
  },

  // ==================== EXPLORATION ACHIEVEMENTS (2) ====================
  ARCHAEOLOGIST: {
    id: 'ARCHAEOLOGIST',
    name: 'Archaeologist',
    description: 'Discover all 15 ancient technologies',
    category: AchievementCategory.Exploration,
    rarity: AchievementRarity.Legendary,
    requirement: {
      type: 'discoveriesFound',
      value: 15
    },
    reward: {
      unitUnlock: 'PRESTIGE_ANCIENT_SENTINEL',
      rpBonus: 200
    }
  },

  CAVE_EXPLORER: {
    id: 'CAVE_EXPLORER',
    name: 'Cave Explorer',
    description: 'Explore 1,000 caves and forests',
    category: AchievementCategory.Exploration,
    rarity: AchievementRarity.Epic,
    requirement: {
      type: 'cavesExplored',
      value: 1000
    },
    reward: {
      unitUnlock: 'PRESTIGE_SPELUNKER',
      rpBonus: 100
    }
  },

  // ==================== PROGRESSION ACHIEVEMENTS (2) ====================
  LEGEND: {
    id: 'LEGEND',
    name: 'Legend',
    description: 'Reach Level 50',
    category: AchievementCategory.Progression,
    rarity: AchievementRarity.Legendary,
    requirement: {
      type: 'level',
      value: 50
    },
    reward: {
      unitUnlock: 'PRESTIGE_CHAMPION',
      rpBonus: 250
    }
  },

  MASTER_SPECIALIST: {
    id: 'MASTER_SPECIALIST',
    name: 'Master Specialist',
    description: 'Reach 100% mastery in any specialization',
    category: AchievementCategory.Progression,
    rarity: AchievementRarity.Epic,
    requirement: {
      type: 'specializationMastery',
      value: 100
    },
    reward: {
      unitUnlock: 'PRESTIGE_APEX_PREDATOR',
      rpBonus: 150
    }
  }
};

/**
 * Check and unlock achievements for a player
 * 
 * @param playerId - Player username
 * @returns Array of newly unlocked achievements
 */
export async function checkAchievements(playerId: string): Promise<Achievement[]> {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player) {
    return [];
  }

  const existingAchievements = player.achievements || [];
  // Dedup on the union: full records carry `id`; tutorial markers carry `achievementId`
  // (they represent the same "already earned" fact).
  const unlockedIds = existingAchievements.map((a) => ('id' in a ? a.id : a.achievementId));
  const newlyUnlocked: Achievement[] = [];

  // Check each achievement
  for (const [id, config] of Object.entries(ACHIEVEMENTS)) {
    // Skip if already unlocked
    if (unlockedIds.includes(id)) continue;

    // Get current progress value
    let currentValue = 0;
    switch (config.requirement.type) {
      case 'battlesWon':
        currentValue = player.stats?.battlesWon || 0;
        break;
      case 'totalUnitsBuilt':
        currentValue = player.stats?.totalUnitsBuilt || 0;
        break;
      case 'totalArmyPower':
        currentValue = (player.totalStrength || 0) + (player.totalDefense || 0);
        break;
      case 'totalResourcesGathered':
        currentValue = player.stats?.totalResourcesGathered || 0;
        break;
      case 'totalResourcesBanked':
        currentValue = player.stats?.totalResourcesBanked || 0;
        break;
      case 'shrineTradeCount':
        currentValue = player.stats?.shrineTradeCount || 0;
        break;
      case 'discoveriesFound':
        currentValue = player.discoveries?.length || 0;
        break;
      case 'cavesExplored':
        currentValue = player.stats?.cavesExplored || 0;
        break;
      case 'level':
        currentValue = player.level || 1;
        break;
      case 'specializationMastery':
        currentValue = player.specialization?.masteryLevel || 0;
        break;
    }

    // Check if requirement met
    if (currentValue >= config.requirement.value) {
      const unlockedAchievement: Achievement = {
        ...config,
        unlockedAt: new Date(),
        progress: currentValue
      };

      newlyUnlocked.push(unlockedAchievement);

      // Add to player's achievements
      await playersCollection.updateOne(
        { username: playerId },
        { 
          $push: { achievements: unlockedAchievement }
        }
      );

      // Award RP via researchPointService (with VIP bonus support)
      if (config.reward.rpBonus && config.reward.rpBonus > 0) {
        try {
          const { awardRP } = await import('./researchPointService');
          const result = await awardRP(
            playerId,
            config.reward.rpBonus,
            'achievement',
            `Achievement Unlocked: ${config.name}`,
            { achievementId: id, rarity: config.rarity }
          );
          
          if (result.success) {
            logger.success('Achievement RP awarded!', {
              username: playerId,
              achievement: config.name,
              rpAwarded: result.rpAwarded,
              vipBonus: result.vipBonusApplied
            });
          }
        } catch (error) {
          console.error('❌ Error awarding RP for achievement:', error);
          // Fallback to old system if RP service fails
          await playersCollection.updateOne(
            { username: playerId },
            { $inc: { researchPoints: config.reward.rpBonus } }
          );
        }
      }

      logger.success('Achievement unlocked!', {
        username: playerId,
        achievement: config.name,
        category: config.category,
        rarity: config.rarity,
        prestigeUnit: config.reward.unitUnlock,
        rpBonus: config.reward.rpBonus
      });
    }
  }

  return newlyUnlocked;
}

/**
 * Get player's achievement progress
 * 
 * @param playerId - Player username
 * @returns Achievement statistics and progress
 */
export async function getAchievementProgress(playerId: string) {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player) {
    return null;
  }

  const unlockedAchievements = player.achievements || [];
  const unlockedIds = unlockedAchievements.map((a) => ('id' in a ? a.id : a.achievementId));

  // Calculate progress for each achievement
  const allAchievements = Object.values(ACHIEVEMENTS).map(config => {
    const isUnlocked = unlockedIds.includes(config.id);
    
    // Get current progress value
    let currentValue = 0;
    switch (config.requirement.type) {
      case 'battlesWon':
        currentValue = player.stats?.battlesWon || 0;
        break;
      case 'totalUnitsBuilt':
        currentValue = player.stats?.totalUnitsBuilt || 0;
        break;
      case 'totalArmyPower':
        currentValue = (player.totalStrength || 0) + (player.totalDefense || 0);
        break;
      case 'totalResourcesGathered':
        currentValue = player.stats?.totalResourcesGathered || 0;
        break;
      case 'totalResourcesBanked':
        currentValue = player.stats?.totalResourcesBanked || 0;
        break;
      case 'shrineTradeCount':
        currentValue = player.stats?.shrineTradeCount || 0;
        break;
      case 'discoveriesFound':
        currentValue = player.discoveries?.length || 0;
        break;
      case 'cavesExplored':
        currentValue = player.stats?.cavesExplored || 0;
        break;
      case 'level':
        currentValue = player.level || 1;
        break;
      case 'specializationMastery':
        currentValue = player.specialization?.masteryLevel || 0;
        break;
    }

    const progressPercent = Math.min(100, Math.floor((currentValue / config.requirement.value) * 100));

    return {
      ...config,
      isUnlocked,
      currentValue,
      progressPercent,
      unlockedAt: isUnlocked ? unlockedAchievements.find((a) => 'id' in a && a.id === config.id)?.unlockedAt : undefined
    };
  });

  // Calculate statistics by category
  const byCategory = {
    [AchievementCategory.Combat]: {
      unlocked: allAchievements.filter(a => a.category === AchievementCategory.Combat && a.isUnlocked).length,
      total: allAchievements.filter(a => a.category === AchievementCategory.Combat).length
    },
    [AchievementCategory.Economic]: {
      unlocked: allAchievements.filter(a => a.category === AchievementCategory.Economic && a.isUnlocked).length,
      total: allAchievements.filter(a => a.category === AchievementCategory.Economic).length
    },
    [AchievementCategory.Exploration]: {
      unlocked: allAchievements.filter(a => a.category === AchievementCategory.Exploration && a.isUnlocked).length,
      total: allAchievements.filter(a => a.category === AchievementCategory.Exploration).length
    },
    [AchievementCategory.Progression]: {
      unlocked: allAchievements.filter(a => a.category === AchievementCategory.Progression && a.isUnlocked).length,
      total: allAchievements.filter(a => a.category === AchievementCategory.Progression).length
    }
  };

  return {
    totalUnlocked: unlockedAchievements.length,
    totalAvailable: 10,
    progressPercent: Math.floor((unlockedAchievements.length / 10) * 100),
    byCategory,
    achievements: allAchievements,
    completionStatus: unlockedAchievements.length >= 10 ? 'COMPLETE' : 'IN_PROGRESS'
  };
}

/**
 * Get list of prestige units unlocked for a player
 * 
 * @param playerId - Player username
 * @returns Array of unlocked prestige unit types
 */
export async function getUnlockedPrestigeUnits(playerId: string): Promise<string[]> {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player || !player.achievements) {
    return [];
  }

  return player.achievements
    .filter((a): a is Achievement => 'id' in a)
    .map((a) => a.reward.unitUnlock);
}

/**
 * Check if player has unlocked a specific prestige unit
 * 
 * @param playerId - Player username
 * @param unitType - Prestige unit type to check
 * @returns True if unlocked
 */
export async function hasPrestigeUnitUnlocked(playerId: string, unitType: string): Promise<boolean> {
  const unlockedUnits = await getUnlockedPrestigeUnits(playerId);
  return unlockedUnits.includes(unitType);
}
