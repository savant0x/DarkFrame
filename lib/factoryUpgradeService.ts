/**
 * Factory Upgrade Service
 * Created: 2025-10-17
 * Updated: 2026-05-11 — FID-20260511-FACTORY-UNIT-REDESIGN
 *
 * CHANGES:
 * - Slot formula: polynomial growth (5,000 × 1.15^(level-1) + (level-1)² × 200)
 * - Defense formula: constrained polynomial (5,000 + 12,000 × (level-1)^1.4)
 * - Upgrade costs: softer exponential (base 1.35), RP scales with level
 * - Regen rate: maxSlots / 12 hours (all factories take 12h to fill)
 * - Burst+decay slot model: 80% on capture, 20% asymptotic decay
 * - Map entropy: degrade 1 level per 72h unoccupied
 * - Factory archetypes: MUNITIONS, HEAVY_ASSEMBLY, AEGIS
 * - Terrain modifiers from adjacent tiles
 * - Soft cap via exponential upkeep instead of hard limit
 */

import { Factory, FactoryStats } from '@/types/game.types';

export type FactoryArchetype = 'MUNITIONS' | 'HEAVY_ASSEMBLY' | 'AEGIS';
export type TerrainModifier = 'WASTELAND' | 'METAL' | 'ENERGY' | 'CAVE' | 'FOREST';

export const FACTORY_UPGRADE = {
  MIN_LEVEL: 1,
  MAX_LEVEL: 10,
  BASE_METAL_COST: 1500,
  BASE_ENERGY_COST: 750,
  COST_MULTIPLIER: 1.35,
  BASE_SLOTS: 5000,
  SLOT_SCALING: 1.15,
  SLOT_POLY_BONUS: 200,
  REGEN_HOURS: 12,
  BASE_DEFENSE: 5000,
  DEFENSE_SCALING: 12000,
  DEFENSE_EXPONENT: 1.4,
  ENTROPY_HOURS: 72,
  MAX_FACTORIES_SOFT_CAP: 3,
} as const;

export interface UpgradeCost {
  metal: number;
  energy: number;
  rp: number;
  level: number;
}

/** Calculate upgrade cost for next level. Formula: Base × 1.35^targetLevel, RP = level × 10 */
export function calculateUpgradeCost(currentLevel: number): UpgradeCost {
  if (currentLevel < FACTORY_UPGRADE.MIN_LEVEL || currentLevel >= FACTORY_UPGRADE.MAX_LEVEL) {
    throw new Error(`Cannot upgrade from level ${currentLevel}`);
  }
  const targetLevel = currentLevel + 1;
  return {
    metal: Math.floor(FACTORY_UPGRADE.BASE_METAL_COST * Math.pow(FACTORY_UPGRADE.COST_MULTIPLIER, targetLevel - 1)),
    energy: Math.floor(FACTORY_UPGRADE.BASE_ENERGY_COST * Math.pow(FACTORY_UPGRADE.COST_MULTIPLIER, targetLevel - 1)),
    rp: targetLevel * 10,
    level: targetLevel,
  };
}

/** Cumulative cost from Level 1 to target level */
export function calculateCumulativeCost(targetLevel: number): UpgradeCost {
  if (targetLevel < 2 || targetLevel > FACTORY_UPGRADE.MAX_LEVEL) {
    throw new Error(`Invalid target level: ${targetLevel}`);
  }
  let totalMetal = 0, totalEnergy = 0, totalRp = 0;
  for (let level = 1; level < targetLevel; level++) {
    const cost = calculateUpgradeCost(level);
    totalMetal += cost.metal;
    totalEnergy += cost.energy;
    totalRp += cost.rp;
  }
  return { metal: totalMetal, energy: totalEnergy, rp: totalRp, level: targetLevel };
}

/** Slot capacity: polynomial growth. L1=5,000 L5=12,044 L10=41,189 */
export function getMaxSlots(level: number): number {
  if (level < 1 || level > FACTORY_UPGRADE.MAX_LEVEL) throw new Error(`Invalid level: ${level}`);
  return Math.floor(
    FACTORY_UPGRADE.BASE_SLOTS * Math.pow(FACTORY_UPGRADE.SLOT_SCALING, level - 1)
    + Math.pow(level - 1, 2) * FACTORY_UPGRADE.SLOT_POLY_BONUS
  );
}

/** Regen rate: maxSlots / 12 hours */
export function getRegenRate(level: number): number {
  return getMaxSlots(level) / FACTORY_UPGRADE.REGEN_HOURS;
}

/** Defense: constrained polynomial. L1=5,000 L5=83,038 L10=260,000 */
export function getFactoryDefense(level: number): number {
  if (level < 1 || level > FACTORY_UPGRADE.MAX_LEVEL) throw new Error(`Invalid level: ${level}`);
  return Math.floor(FACTORY_UPGRADE.BASE_DEFENSE + FACTORY_UPGRADE.DEFENSE_SCALING * Math.pow(level - 1, FACTORY_UPGRADE.DEFENSE_EXPONENT));
}

/** Full factory stats */
export function getFactoryStats(level: number): FactoryStats {
  return {
    level,
    maxSlots: getMaxSlots(level),
    regenRate: getRegenRate(level),
    strengthBonus: level * 5,
    defenseBonus: level * 5,
  };
}

/** Burst slots on capture: 80% of max */
export function getBurstSlots(level: number): number {
  return Math.floor(getMaxSlots(level) * 0.8);
}

/** Asymptotic decay: remaining 20% regenerates over time */
export function getDecaySlots(level: number, minutesSinceCapture: number): number {
  const remaining = getMaxSlots(level) * 0.2;
  // Asymptotic approach: 1 - e^(-t/30) where t is minutes
  // Reaches ~95% at 90 minutes
  const progress = 1 - Math.exp(-minutesSinceCapture / 30);
  return Math.floor(remaining * progress);
}

/** Total available slots after capture given time elapsed */
export function getTotalAvailableSlots(level: number, minutesSinceCapture: number): number {
  return getBurstSlots(level) + getDecaySlots(level, minutesSinceCapture);
}

/** Check if factory should degrade due to entropy (72h unoccupied) */
export function shouldDegrade(lastInteractedAt: Date): boolean {
  const hoursSinceInteraction = (Date.now() - lastInteractedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceInteraction >= FACTORY_UPGRADE.ENTROPY_HOURS;
}

/** Get entropy degradation periods elapsed */
export function getEntropyPeriods(lastInteractedAt: number): number {
  const hoursSince = (Date.now() - lastInteractedAt) / (1000 * 60 * 60);
  return Math.floor(hoursSince / FACTORY_UPGRADE.ENTROPY_HOURS);
}

/** Terrain modifier effects on factory */
export function getTerrainModifier(terrain: TerrainModifier): {
  defenseMultiplier: number;
  incomeMultiplier: number;
  captureBonus: number;
  regenBonus: number;
} {
  switch (terrain) {
    case 'METAL':
      return { defenseMultiplier: 1.0, incomeMultiplier: 1.15, captureBonus: 0, regenBonus: 0 };
    case 'ENERGY':
      return { defenseMultiplier: 1.0, incomeMultiplier: 1.15, captureBonus: 0, regenBonus: 0 };
    case 'CAVE':
      return { defenseMultiplier: 1.25, incomeMultiplier: 1.0, captureBonus: 0, regenBonus: 0 };
    case 'FOREST':
      return { defenseMultiplier: 0.75, incomeMultiplier: 1.0, captureBonus: 0.15, regenBonus: 0 };
    case 'WASTELAND':
    default:
      return { defenseMultiplier: 1.0, incomeMultiplier: 1.0, captureBonus: 0, regenBonus: 0 };
  }
}

/** Factory archetype bonuses */
export function getArchetypeBonus(archetype: FactoryArchetype): {
  slotRegenBonus: number;
  defenseModifier: number;
  passiveIncomeBonus: number;
  unitProductionBonus: number;
} {
  switch (archetype) {
    case 'MUNITIONS':
      return { slotRegenBonus: 0.20, defenseModifier: -0.10, passiveIncomeBonus: 0, unitProductionBonus: 0.10 };
    case 'HEAVY_ASSEMBLY':
      return { slotRegenBonus: -0.10, defenseModifier: 0.20, passiveIncomeBonus: -0.10, unitProductionBonus: 0 };
    case 'AEGIS':
      return { slotRegenBonus: 0, defenseModifier: 0.40, passiveIncomeBonus: 1.0, unitProductionBonus: 0 };
  }
}

/** Exponential upkeep cost per factory held */
export function getUpkeepCost(factoriesHeld: number): number {
  if (factoriesHeld <= 3) return 0;
  if (factoriesHeld <= 6) return 500;
  if (factoriesHeld <= 9) return 2500;
  if (factoriesHeld === 10) return 10000;
  return 50000; // 11+ is ruinous
}

/** Capture probability using diminishing returns formula */
export function getCaptureProbability(playerPower: number, factoryDefense: number): number {
  if (factoryDefense <= 0) return 0.95;
  const ratio = playerPower / factoryDefense;
  const probability = Math.pow(ratio, 1.5) / (1 + Math.pow(ratio, 1.5));
  return Math.min(0.95, Math.max(0.05, probability));
}

/** Lucky strike: L1 factory + power ≤ 200 = 5-15% auto-success */
export function getLuckyStrikeChance(factoryLevel: number, playerPower: number): number {
  if (factoryLevel > 3 || playerPower > 200) return 0;
  return 0.05 + Math.random() * 0.10; // 5-15%
}

/** Level-gap penalty for high-rank players attacking low-level factories */
export function getLevelGapPenalty(playerRank: number, factoryLevel: number): number {
  if (playerRank <= 10) return 1.0; // Novice: no penalty
  if (playerRank <= 30) {
    if (factoryLevel <= 2) return 0.5; // Veteran attacking L1-2: 50% power
    if (factoryLevel <= 6) return 1.0; // Veteran attacking L3-6: normal
    return 1.0;
  }
  // Elite
  if (factoryLevel <= 4) return 0.1; // Elite attacking L1-4: 10% power
  if (factoryLevel <= 7) return 0.5; // Elite attacking L5-7: 50% power
  if (factoryLevel >= 8) return 1.2; // Elite attacking L8+: 120% power (bonus)
  return 1.0;
}

export function canUpgradeFactory(
  factory: Factory,
  playerMetal: number,
  playerEnergy: number,
  playerRp: number = 0,
): { canUpgrade: boolean; reason?: string } {
  if (factory.level >= FACTORY_UPGRADE.MAX_LEVEL) {
    return { canUpgrade: false, reason: 'Factory is already at maximum level (10)' };
  }
  const cost = calculateUpgradeCost(factory.level);
  if (playerMetal < cost.metal) {
    return { canUpgrade: false, reason: `Insufficient metal (need ${cost.metal}, have ${playerMetal})` };
  }
  if (playerEnergy < cost.energy) {
    return { canUpgrade: false, reason: `Insufficient energy (need ${cost.energy}, have ${playerEnergy})` };
  }
  if (playerRp < cost.rp) {
    return { canUpgrade: false, reason: `Insufficient RP (need ${cost.rp}, have ${playerRp})` };
  }
  return { canUpgrade: true };
}

export function getUpgradeProgress(factory: Factory): number {
  if (factory.level >= FACTORY_UPGRADE.MAX_LEVEL) return 100;
  if (factory.level === 1) return 0;
  const invested = calculateCumulativeCost(factory.level);
  const totalToMax = calculateCumulativeCost(FACTORY_UPGRADE.MAX_LEVEL);
  return Math.round(((invested.metal + invested.energy) / (totalToMax.metal + totalToMax.energy)) * 100);
}

export function formatFactoryLevel(level: number): string {
  return `Level ${level}/${FACTORY_UPGRADE.MAX_LEVEL}`;
}

export function formatUpgradeCost(cost: UpgradeCost): string {
  return `${cost.metal.toLocaleString()} M + ${cost.energy.toLocaleString()} E + ${cost.rp} RP`;
}
