/**
 * @file lib/toolDurabilityService.ts
 * @created 2026-05-07
 * @overview Auto-farm tool durability system
 *
 * Auto-farm tool has condition (0-100%) that decays with use.
 * Repair costs scale exponentially with degradation.
 */

export type ToolTier = 'basic' | 'advanced' | 'premium' | 'legendary';

export interface ToolStats {
  tier: ToolTier;
  decayRate: number; // % per tile
  speedBonus: number; // multiplier
  repairCostMetal: number;
  repairCostEnergy: number;
}

export interface ToolState {
  tier: ToolTier;
  condition: number; // 0-100
}

const TOOL_STATS: Record<ToolTier, Omit<ToolStats, 'condition'>> = {
  basic:     { tier: 'basic',     decayRate: 0.05, speedBonus: 1.0, repairCostMetal: 50000,  repairCostEnergy: 25000  },
  advanced:  { tier: 'advanced',  decayRate: 0.02, speedBonus: 1.2, repairCostMetal: 200000, repairCostEnergy: 100000 },
  premium:   { tier: 'premium',   decayRate: 0.01, speedBonus: 1.5, repairCostMetal: 500000, repairCostEnergy: 250000 },
  legendary: { tier: 'legendary', decayRate: 0.005, speedBonus: 2.0, repairCostMetal: 2000000, repairCostEnergy: 1000000 },
};

/**
 * Get tool speed multiplier based on condition.
 * Speed scales with condition (soft, never zero).
 */
export function getToolSpeed(tier: ToolTier, condition: number): number {
  const base = TOOL_STATS[tier].speedBonus;
  const conditionMultiplier = Math.max(0.05, condition / 100); // Min 5% speed
  return base * conditionMultiplier;
}

/**
 * Calculate repair cost — scales exponentially with degradation.
 */
export function getRepairCost(tier: ToolTier, currentCondition: number): { metal: number; energy: number } {
  const base = TOOL_STATS[tier];
  const degradation = 100 - currentCondition;
  const multiplier = Math.pow(1 + degradation / 100, 2); // Exponential
  return {
    metal: Math.floor(base.repairCostMetal * multiplier * (degradation / 100)),
    energy: Math.floor(base.repairCostEnergy * multiplier * (degradation / 100)),
  };
}

/**
 * Apply decay after harvesting a tile.
 */
export function applyToolDecay(tier: ToolTier, currentCondition: number, tilesHarvested: number = 1): number {
  const decay = TOOL_STATS[tier].decayRate * tilesHarvested;
  return Math.max(0, currentCondition - decay);
}

export { TOOL_STATS };
