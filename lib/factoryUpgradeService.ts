/**
 * Factory Upgrade Service
 * Created: 2025-10-17
 * Updated: 2025-11-04 - Exponential slot cost system
 * 
 * OVERVIEW:
 * Core service for factory upgrade system, handling level progression,
 * cost calculations, and stat improvements. Factories can be upgraded
 * from Level 1 to Level 10 with exponentially increasing costs.
 * 
 * UPGRADE FORMULA:
 * - Metal Cost = 1000 × (1.5^level)
 * - Energy Cost = 500 × (1.5^level)
 * - Max Slots = 5000 + ((level - 1) × 500)
 * - Regen Rate = 416.67 + ((level - 1) × 41.67) slots/hour
 * 
 * SLOT PROGRESSION:
 * Level 1: 5,000 slots (416.67/hr) - 12h full regen
 * Level 5: 7,000 slots (583.33/hr) - 12h full regen
 * Level 10: 9,500 slots (791.67/hr) - 12h full regen
 * 
 * COST PROGRESSION:
 * Level 1→2: 1,500 metal + 750 energy
 * Level 5→6: 11,391 metal + 5,695 energy
 * Level 9→10: 76,699 metal + 38,349 energy
 * Total to Level 10: ~169,000 metal + ~84,500 energy
 * 
 * KEY FEATURES:
 * - Exponential cost scaling (1.5x multiplier)
 * - Linear slot capacity growth (+500 per level)
 * - 12-hour regeneration cycle (syncs with harvest reset)
 * - Max 10 factories per player (strategic choices)
 * - Abandon functionality for factory repositioning
 * - Supports exponential unit slot costs (T1=1, T2=3, T3=7, T4=15, T5=30)
 */

import { Factory, FactoryStats } from '@/types/game.types';

/**
 * Factory upgrade level constants
 */
export const FACTORY_UPGRADE = {
  MIN_LEVEL: 1,
  MAX_LEVEL: 10,
  
  // Cost formula constants
  BASE_METAL_COST: 1000,
  BASE_ENERGY_COST: 500,
  COST_MULTIPLIER: 1.5,
  
  // Stats formula constants (Updated for exponential slot cost system)
  BASE_SLOTS: 5000,           // Level 1 factory = 5,000 slots
  SLOTS_PER_LEVEL: 500,       // +500 slots per level (Level 10 = 9,500 slots)
  BASE_REGEN_RATE: 416.67,    // ~417 slots/hour (full regen in 12 hours)
  REGEN_PER_LEVEL: 41.67,     // +41.67 slots/hour per level
  
  // Defense formula constants (NEW: Exponential scaling after Level 1)
  // Level 1: 1,000 (accessible for first factory capture)
  // Level 2+: Exponential growth - (level-1)² × 50,000
  // Level 10: 3,650,000 (requires ~3M+ strength for high success)
  
  // Player limits
  MAX_FACTORIES_PER_PLAYER: 10
} as const;

/**
 * Upgrade cost breakdown
 */
export interface UpgradeCost {
  metal: number;
  energy: number;
  level: number; // Target level after upgrade
}

/**
 * Calculate upgrade cost for a specific level
 * Formula: BaseCost × (1.5^level)
 * 
 * @param currentLevel - Current factory level (1-9)
 * @returns Cost to upgrade to next level
 * 
 * @example
 * const cost = calculateUpgradeCost(1);
 * // Returns: { metal: 1500, energy: 750, level: 2 }
 */
export function calculateUpgradeCost(currentLevel: number): UpgradeCost {
  if (currentLevel < FACTORY_UPGRADE.MIN_LEVEL || currentLevel >= FACTORY_UPGRADE.MAX_LEVEL) {
    throw new Error(`Cannot upgrade from level ${currentLevel}`);
  }
  
  const targetLevel = currentLevel + 1;
  const metal = Math.floor(FACTORY_UPGRADE.BASE_METAL_COST * Math.pow(FACTORY_UPGRADE.COST_MULTIPLIER, targetLevel));
  const energy = Math.floor(FACTORY_UPGRADE.BASE_ENERGY_COST * Math.pow(FACTORY_UPGRADE.COST_MULTIPLIER, targetLevel));
  
  return {
    metal,
    energy,
    level: targetLevel
  };
}

/**
 * Calculate total cumulative cost to reach a specific level from Level 1
 * Useful for displaying total investment or planning upgrade paths
 * 
 * @param targetLevel - Target factory level (2-10)
 * @returns Total cost from Level 1 to target level
 * 
 * @example
 * const totalCost = calculateCumulativeCost(10);
 * // Returns: { metal: 169000, energy: 84500, level: 10 }
 */
export function calculateCumulativeCost(targetLevel: number): UpgradeCost {
  if (targetLevel < FACTORY_UPGRADE.MIN_LEVEL + 1 || targetLevel > FACTORY_UPGRADE.MAX_LEVEL) {
    throw new Error(`Invalid target level: ${targetLevel}`);
  }
  
  let totalMetal = 0;
  let totalEnergy = 0;
  
  for (let level = FACTORY_UPGRADE.MIN_LEVEL; level < targetLevel; level++) {
    const cost = calculateUpgradeCost(level);
    totalMetal += cost.metal;
    totalEnergy += cost.energy;
  }
  
  return {
    metal: totalMetal,
    energy: totalEnergy,
    level: targetLevel
  };
}

/**
 * Calculate factory statistics for a given level
 * 
 * @param level - Factory level (1-10)
 * @returns Maximum slots and regeneration rate
 * 
 * @example
 * const stats = getFactoryStats(5);
 * // Returns: { level: 5, maxSlots: 20, regenRate: 1.5 }
 */
export function getFactoryStats(level: number): FactoryStats {
  if (level < FACTORY_UPGRADE.MIN_LEVEL || level > FACTORY_UPGRADE.MAX_LEVEL) {
    throw new Error(`Invalid factory level: ${level}`);
  }
  
  const maxSlots = FACTORY_UPGRADE.BASE_SLOTS + ((level - 1) * FACTORY_UPGRADE.SLOTS_PER_LEVEL);
  const regenRate = FACTORY_UPGRADE.BASE_REGEN_RATE + ((level - 1) * FACTORY_UPGRADE.REGEN_PER_LEVEL);
  
  // Combat bonuses: 5% per level (Level 10 = 50% bonus)
  const strengthBonus = level * 5;
  const defenseBonus = level * 5;
  
  return {
    level,
    maxSlots,
    regenRate,
    strengthBonus,
    defenseBonus
  };
}

/**
 * Get maximum slots for a factory at a given level
 * 
 * @param level - Factory level (1-10)
 * @returns Maximum slot capacity
 * 
 * @example
 * const maxSlots = getMaxSlots(10);
 * // Returns: 28 (10 + 9×2)
 */
export function getMaxSlots(level: number): number {
  return FACTORY_UPGRADE.BASE_SLOTS + ((level - 1) * FACTORY_UPGRADE.SLOTS_PER_LEVEL);
}

/**
 * Get regeneration rate for a factory at a given level
 * 
 * @param level - Factory level (1-10)
 * @returns Slots regenerated per hour
 * 
 * @example
 * const regenRate = getRegenRate(10);
 * // Returns: 791.67 (416.67 + 9×41.67)
 */
export function getRegenRate(level: number): number {
  return FACTORY_UPGRADE.BASE_REGEN_RATE + ((level - 1) * FACTORY_UPGRADE.REGEN_PER_LEVEL);
}

/**
 * Get defense rating for a factory at a given level
 * 
 * EXPONENTIAL SCALING FORMULA:
 * - Level 1: 1,000 (accessible to all players - needed for first factory)
 * - Level 2+: (level - 1)² × 50,000 (exponential growth)
 * 
 * Creates strategic progression:
 * - Level 1: 1,000 defense (anyone can capture for building capability)
 * - Level 2: 50,000 defense (requires ~50K strength for 90% success)
 * - Level 5: 650,000 defense (requires ~650K strength)
 * - Level 10: 3,650,000 defense (requires ~3M+ strength - end-game challenge)
 * 
 * @param level - Factory level (1-10)
 * @returns Defense rating
 * 
 * @example
 * getFactoryDefense(1);  // Returns: 1,000
 * getFactoryDefense(5);  // Returns: 650,000 (4² × 50,000 + base offset)
 * getFactoryDefense(10); // Returns: 3,650,000 (9² × 50,000 + base offset)
 */
export function getFactoryDefense(level: number): number {
  if (level < FACTORY_UPGRADE.MIN_LEVEL || level > FACTORY_UPGRADE.MAX_LEVEL) {
    throw new Error(`Invalid factory level: ${level}`);
  }
  
  // Level 1 is special - very low defense for accessibility
  if (level === 1) {
    return 1000;
  }
  
  // Level 2+: Exponential scaling
  // Formula: (level - 1)² × 50,000
  const exponent = level - 1;
  return exponent * exponent * 50000;
}

/**
 * Check if player can upgrade a factory (level and affordability)
 * 
 * @param factory - Factory to check
 * @param playerMetal - Player's current metal resources
 * @param playerEnergy - Player's current energy resources
 * @returns Object with canUpgrade flag and reason if false
 * 
 * @example
 * const check = canUpgradeFactory(factory, player.resources.metal, player.resources.energy);
 * if (!check.canUpgrade) {
 *   console.log(check.reason);
 * }
 */
export function canUpgradeFactory(
  factory: Factory,
  playerMetal: number,
  playerEnergy: number
): { canUpgrade: boolean; reason?: string } {
  // Check if already at max level
  if (factory.level >= FACTORY_UPGRADE.MAX_LEVEL) {
    return {
      canUpgrade: false,
      reason: 'Factory is already at maximum level (10)'
    };
  }
  
  // Calculate upgrade cost
  const cost = calculateUpgradeCost(factory.level);
  
  // Check if player can afford
  if (playerMetal < cost.metal) {
    return {
      canUpgrade: false,
      reason: `Insufficient metal (need ${cost.metal}, have ${playerMetal})`
    };
  }
  
  if (playerEnergy < cost.energy) {
    return {
      canUpgrade: false,
      reason: `Insufficient energy (need ${cost.energy}, have ${playerEnergy})`
    };
  }
  
  return { canUpgrade: true };
}

/**
 * Get upgrade progress percentage for a factory
 * Based on cumulative cost invested vs total cost to max level
 * 
 * @param factory - Factory to check
 * @returns Percentage complete (0-100)
 * 
 * @example
 * const progress = getUpgradeProgress(factory);
 * // Returns: 47.3 (for a Level 5 factory)
 */
export function getUpgradeProgress(factory: Factory): number {
  if (factory.level >= FACTORY_UPGRADE.MAX_LEVEL) {
    return 100;
  }
  
  const invested = factory.level === 1 ? 0 : calculateCumulativeCost(factory.level);
  const totalToMax = calculateCumulativeCost(FACTORY_UPGRADE.MAX_LEVEL);
  
  const investedAmount = typeof invested === 'number' ? 0 : invested.metal + invested.energy;
  const totalAmount = totalToMax.metal + totalToMax.energy;
  
  return Math.round((investedAmount / totalAmount) * 100);
}

/**
 * Format factory level for display
 * 
 * @param level - Factory level (1-10)
 * @returns Formatted string (e.g., "Level 5/10")
 * 
 * @example
 * const display = formatFactoryLevel(7);
 * // Returns: "Level 7/10"
 */
export function formatFactoryLevel(level: number): string {
  return `Level ${level}/${FACTORY_UPGRADE.MAX_LEVEL}`;
}

/**
 * Format upgrade cost for display
 * 
 * @param cost - Upgrade cost object
 * @returns Formatted string (e.g., "1,500 M + 750 E")
 * 
 * @example
 * const cost = calculateUpgradeCost(5);
 * const display = formatUpgradeCost(cost);
 * // Returns: "11,391 M + 5,695 E"
 */
export function formatUpgradeCost(cost: UpgradeCost): string {
  return `${cost.metal.toLocaleString()} M + ${cost.energy.toLocaleString()} E`;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Cost Formula: Exponential scaling ensures meaningful progression
 *    - Early levels are affordable (1.5K for Level 2)
 *    - Late levels are expensive (76K for Level 10)
 *    - Total investment to max is significant (~169K + 84K)
 * 
 * 2. Stats Formula: Linear scaling provides predictable growth
 *    - Slots: +2 per level (10 → 30)
 *    - Regen: +0.1/hour per level (1.0 → 2.0)
 *    - Level 10 factory produces nearly 2x faster
 * 
 * 3. Strategic Implications:
 *    - Players must choose which factories to upgrade
 *    - Max 10 factories creates scarcity
 *    - Abandon feature allows repositioning
 *    - High-level factories are valuable assets
 * 
 * 4. Future Considerations:
 *    - Could add level requirements (player rank, time)
 *    - Could add special bonuses at certain levels (5, 10)
 *    - Could add factory specializations (STR/DEF focus)
 *    - Could add downgrade option (recover partial cost)
 */
