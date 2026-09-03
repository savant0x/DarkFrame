/**
 * @file lib/discoveryService.ts
 * @created 2025-01-17
 * @overview Discovery system for ancient technologies
 * 
 * OVERVIEW:
 * Manages the discovery of 15 ancient technologies found in caves with 5% drop chance.
 * Each discovery grants permanent bonuses across industrial, combat, or strategic categories.
 * Players can track their progress (X/15 discoveries) and benefit from cumulative effects.
 * 
 * DISCOVERY CATEGORIES:
 * - Industrial (5): Resource production, factory efficiency, gathering bonuses
 * - Combat (5): Unit stats, battle advantages, defensive bonuses
 * - Strategic (5): Economic benefits, movement, special abilities
 * 
 * DROP MECHANICS:
 * - 5% chance per cave harvest
 * - Cannot discover duplicates
 * - No level requirements
 * - Discoveries persist forever
 */

import { getCollection } from './mongodb';
import type { Player } from '@/types/game.types';
import { logger } from './logger';

/**
 * Discovery category types
 */
export enum DiscoveryCategory {
  Industrial = 'industrial',
  Combat = 'combat',
  Strategic = 'strategic'
}

/**
 * Ancient technology discovery
 */
export interface Discovery {
  id: string;
  name: string;
  category: DiscoveryCategory;
  description: string;
  bonus: string;
  discoveredAt: Date;
  discoveredInCave: { x: number; y: number };
}

/**
 * Discovery configuration
 */
export interface DiscoveryConfig {
  id: string;
  name: string;
  category: DiscoveryCategory;
  description: string;
  bonus: string;
  icon: string;
  bonusEffect: {
    type: string; // 'metal_yield' | 'energy_yield' | 'unit_strength' | etc
    value: number; // Bonus amount (percentage or flat)
  };
}

/**
 * Complete list of 15 ancient technologies
 */
export const ANCIENT_TECHNOLOGIES: Record<string, DiscoveryConfig> = {
  // ==================== INDUSTRIAL DISCOVERIES (5) ====================
  AUTO_HARVESTER: {
    id: 'AUTO_HARVESTER',
    name: 'Automated Harvester',
    category: DiscoveryCategory.Industrial,
    description: 'Ancient blueprints for automated resource extraction systems. Increases metal gathering efficiency.',
    bonus: '+15% Metal Yield',
    icon: '⚙️',
    bonusEffect: { type: 'metal_yield', value: 0.15 }
  },
  
  FUSION_CORE: {
    id: 'FUSION_CORE',
    name: 'Fusion Core Reactor',
    category: DiscoveryCategory.Industrial,
    description: 'Advanced energy generation technology from the old world. Boosts energy collection.',
    bonus: '+15% Energy Yield',
    icon: '⚡',
    bonusEffect: { type: 'energy_yield', value: 0.15 }
  },
  
  NANO_FORGE: {
    id: 'NANO_FORGE',
    name: 'Nano-Fabrication Forge',
    category: DiscoveryCategory.Industrial,
    description: 'Molecular assembly technology that reduces material waste in production.',
    bonus: '-10% All Unit Costs',
    icon: '🔧',
    bonusEffect: { type: 'unit_cost_reduction', value: 0.10 }
  },
  
  QUANTUM_FACTORY: {
    id: 'QUANTUM_FACTORY',
    name: 'Quantum Factory Matrix',
    category: DiscoveryCategory.Industrial,
    description: 'Multi-dimensional manufacturing framework. Increases factory slot capacity.',
    bonus: '+2 Factory Slots',
    icon: '🏭',
    bonusEffect: { type: 'factory_slots', value: 2 }
  },
  
  RAPID_ASSEMBLY: {
    id: 'RAPID_ASSEMBLY',
    name: 'Rapid Assembly Protocol',
    category: DiscoveryCategory.Industrial,
    description: 'Accelerated production techniques. Faster factory slot regeneration.',
    bonus: '+20% Slot Regen Speed',
    icon: '⏱️',
    bonusEffect: { type: 'slot_regen_speed', value: 0.20 }
  },
  
  // ==================== COMBAT DISCOVERIES (5) ====================
  TITAN_ARMOR: {
    id: 'TITAN_ARMOR',
    name: 'Titan Composite Armor',
    category: DiscoveryCategory.Combat,
    description: 'Advanced defensive plating used by ancient war machines. Improves all unit defense.',
    bonus: '+10% Unit Defense',
    icon: '🛡️',
    bonusEffect: { type: 'unit_defense', value: 0.10 }
  },
  
  PLASMA_WEAPONS: {
    id: 'PLASMA_WEAPONS',
    name: 'Plasma Weapon Systems',
    category: DiscoveryCategory.Combat,
    description: 'Devastating energy weapons from a forgotten era. Increases offensive power.',
    bonus: '+10% Unit Strength',
    icon: '⚔️',
    bonusEffect: { type: 'unit_strength', value: 0.10 }
  },
  
  TACTICAL_AI: {
    id: 'TACTICAL_AI',
    name: 'Tactical Combat AI',
    category: DiscoveryCategory.Combat,
    description: 'Artificial intelligence for battlefield command and coordination. Boosts combat effectiveness.',
    bonus: '+5% Damage Dealt in Battle',
    icon: '🧠',
    bonusEffect: { type: 'damage_dealt', value: 0.05 }
  },
  
  SHIELD_MATRIX: {
    id: 'SHIELD_MATRIX',
    name: 'Energy Shield Matrix',
    category: DiscoveryCategory.Combat,
    description: 'Force field technology that deflects incoming attacks. Reduces damage taken.',
    bonus: '-5% Damage Taken in Battle',
    icon: '💠',
    bonusEffect: { type: 'damage_taken_reduction', value: 0.05 }
  },
  
  REPAIR_NANITES: {
    id: 'REPAIR_NANITES',
    name: 'Regenerative Nanites',
    category: DiscoveryCategory.Combat,
    description: 'Self-repairing microscopic machines. Increases unit HP in combat.',
    bonus: '+15% Unit HP',
    icon: '💉',
    bonusEffect: { type: 'unit_hp', value: 0.15 }
  },
  
  // ==================== STRATEGIC DISCOVERIES (5) ====================
  BANK_PROTOCOL: {
    id: 'BANK_PROTOCOL',
    name: 'Secure Banking Protocol',
    category: DiscoveryCategory.Strategic,
    description: 'Ancient encryption methods for resource storage. Increases bank capacity.',
    bonus: '+25% Bank Capacity',
    icon: '🏦',
    bonusEffect: { type: 'bank_capacity', value: 0.25 }
  },
  
  SHRINE_BLESSING: {
    id: 'SHRINE_BLESSING',
    name: 'Ancient Shrine Blessing',
    category: DiscoveryCategory.Strategic,
    description: 'Amplifies the power of shrine rituals. Boosts shrine trading effectiveness.',
    bonus: '+10% Shrine Boost Duration',
    icon: '🕌',
    bonusEffect: { type: 'shrine_boost_duration', value: 0.10 }
  },
  
  WARP_DRIVE: {
    id: 'WARP_DRIVE',
    name: 'Warp Drive Prototype',
    category: DiscoveryCategory.Strategic,
    description: 'Experimental faster-than-light technology. Unlocks instant travel ability.',
    bonus: 'Fast Travel Unlocked',
    icon: '🚀',
    bonusEffect: { type: 'fast_travel', value: 1 }
  },
  
  CRYSTAL_RESONATOR: {
    id: 'CRYSTAL_RESONATOR',
    name: 'Crystal Resonator',
    category: DiscoveryCategory.Strategic,
    description: 'Harmonic amplification device. Increases XP gain from all sources.',
    bonus: '+20% XP Gain',
    icon: '💎',
    bonusEffect: { type: 'xp_multiplier', value: 0.20 }
  },
  
  FORTUNE_ALGORITHM: {
    id: 'FORTUNE_ALGORITHM',
    name: 'Fortune Algorithm',
    category: DiscoveryCategory.Strategic,
    description: 'Predictive analysis software for cave exploration. Improves cave loot quality.',
    bonus: '+10% Better Cave Loot',
    icon: '🎲',
    bonusEffect: { type: 'cave_loot_quality', value: 0.10 }
  }
};

/**
 * Discovery drop rate configuration
 */
export const DISCOVERY_DROP_RATE = 0.05; // 5% chance per cave harvest

/**
 * Check if player should receive a discovery during cave harvest
 * 
 * @param playerId - Player username
 * @returns Discovery result with new technology if discovered
 */
export async function checkDiscoveryDrop(
  playerId: string,
  caveLocation: { x: number; y: number }
): Promise<{
  discovered: boolean;
  discovery?: Discovery;
  isNew: boolean;
  totalDiscoveries?: number;
}> {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player) {
    return { discovered: false, isNew: false };
  }

  // Check if discovery roll succeeds
  const roll = Math.random();
  if (roll > DISCOVERY_DROP_RATE) {
    return { discovered: false, isNew: false };
  }

  // Get player's existing discoveries
  const existingDiscoveries = player.discoveries || [];
  const discoveredIds = existingDiscoveries.map((d: Discovery) => d.id);

  // Find undiscovered technologies
  const availableDiscoveries = Object.values(ANCIENT_TECHNOLOGIES).filter(
    tech => !discoveredIds.includes(tech.id)
  );

  // If all discovered, no new discovery possible
  if (availableDiscoveries.length === 0) {
    return { discovered: true, isNew: false, totalDiscoveries: 15 };
  }

  // Randomly select one undiscovered technology
  const selectedTech = availableDiscoveries[Math.floor(Math.random() * availableDiscoveries.length)];

  // Create discovery record
  const newDiscovery: Discovery = {
    id: selectedTech.id,
    name: selectedTech.name,
    category: selectedTech.category,
    description: selectedTech.description,
    bonus: selectedTech.bonus,
    discoveredAt: new Date(),
    discoveredInCave: caveLocation
  };

  // Add to player's discoveries
  await playersCollection.updateOne(
    { username: playerId },
    { $push: { discoveries: newDiscovery } as any }
  );

  logger.success('Ancient technology discovered!', {
    username: playerId,
    technology: selectedTech.name,
    category: selectedTech.category,
    location: caveLocation,
    totalDiscoveries: existingDiscoveries.length + 1
  });

  return {
    discovered: true,
    discovery: newDiscovery,
    isNew: true,
    totalDiscoveries: existingDiscoveries.length + 1
  };
}

/**
 * Get player's discovery progress
 * 
 * @param playerId - Player username
 * @returns Discovery statistics and list
 */
export async function getDiscoveryProgress(playerId: string) {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player) {
    return null;
  }

  const discoveries = player.discoveries || [];
  const discoveredIds = discoveries.map((d: Discovery) => d.id);

  // Calculate statistics by category
  const byCategory = {
    [DiscoveryCategory.Industrial]: discoveries.filter((d: Discovery) => d.category === DiscoveryCategory.Industrial).length,
    [DiscoveryCategory.Combat]: discoveries.filter((d: Discovery) => d.category === DiscoveryCategory.Combat).length,
    [DiscoveryCategory.Strategic]: discoveries.filter((d: Discovery) => d.category === DiscoveryCategory.Strategic).length
  };

  // Get undiscovered technologies
  const undiscovered = Object.values(ANCIENT_TECHNOLOGIES).filter(
    tech => !discoveredIds.includes(tech.id)
  );

  return {
    totalDiscovered: discoveries.length,
    totalAvailable: 15,
    progressPercent: Math.floor((discoveries.length / 15) * 100),
    byCategory,
    discoveries: discoveries.map((d: Discovery) => ({
      ...d,
      config: ANCIENT_TECHNOLOGIES[d.id]
    })),
    undiscovered: undiscovered.map(tech => ({
      id: tech.id,
      name: tech.name,
      category: tech.category,
      icon: tech.icon,
      description: tech.description
    })),
    completionStatus: discoveries.length >= 15 ? 'COMPLETE' : 'IN_PROGRESS'
  };
}

/**
 * Calculate cumulative bonuses from all discoveries
 * 
 * @param playerId - Player username
 * @returns Aggregate bonus values
 */
export async function getDiscoveryBonuses(playerId: string) {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player || !player.discoveries) {
    return {
      metalYield: 0,
      energyYield: 0,
      unitCostReduction: 0,
      factorySlots: 0,
      slotRegenSpeed: 0,
      unitDefense: 0,
      unitStrength: 0,
      damageDealt: 0,
      damageTakenReduction: 0,
      unitHp: 0,
      bankCapacity: 0,
      shrineBoostDuration: 0,
      fastTravel: false,
      xpMultiplier: 0,
      caveLootQuality: 0
    };
  }

  const bonuses = {
    metalYield: 0,
    energyYield: 0,
    unitCostReduction: 0,
    factorySlots: 0,
    slotRegenSpeed: 0,
    unitDefense: 0,
    unitStrength: 0,
    damageDealt: 0,
    damageTakenReduction: 0,
    unitHp: 0,
    bankCapacity: 0,
    shrineBoostDuration: 0,
    fastTravel: false,
    xpMultiplier: 0,
    caveLootQuality: 0
  };

  // Accumulate bonuses from all discoveries
  for (const discovery of player.discoveries) {
    const config = ANCIENT_TECHNOLOGIES[discovery.id];
    if (!config) continue;

    const effect = config.bonusEffect;
    
    switch (effect.type) {
      case 'metal_yield':
        bonuses.metalYield += effect.value;
        break;
      case 'energy_yield':
        bonuses.energyYield += effect.value;
        break;
      case 'unit_cost_reduction':
        bonuses.unitCostReduction += effect.value;
        break;
      case 'factory_slots':
        bonuses.factorySlots += effect.value;
        break;
      case 'slot_regen_speed':
        bonuses.slotRegenSpeed += effect.value;
        break;
      case 'unit_defense':
        bonuses.unitDefense += effect.value;
        break;
      case 'unit_strength':
        bonuses.unitStrength += effect.value;
        break;
      case 'damage_dealt':
        bonuses.damageDealt += effect.value;
        break;
      case 'damage_taken_reduction':
        bonuses.damageTakenReduction += effect.value;
        break;
      case 'unit_hp':
        bonuses.unitHp += effect.value;
        break;
      case 'bank_capacity':
        bonuses.bankCapacity += effect.value;
        break;
      case 'shrine_boost_duration':
        bonuses.shrineBoostDuration += effect.value;
        break;
      case 'fast_travel':
        bonuses.fastTravel = true;
        break;
      case 'xp_multiplier':
        bonuses.xpMultiplier += effect.value;
        break;
      case 'cave_loot_quality':
        bonuses.caveLootQuality += effect.value;
        break;
    }
  }

  return bonuses;
}
