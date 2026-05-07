/**
 * @file lib/resourceDecayService.ts
 * @created 2026-05-07
 * @overview Resource decay (rot) — slow decay on stored resources above threshold
 *
 * Prevents infinite hoarding. Only applies to resources above 1M threshold.
 * 0.25% daily decay on amount above threshold, max 250K decay per day.
 */

const DECAY_CONFIG = {
  threshold: 1000000,     // 1M — no decay below this
  rate: 0.0025,           // 0.25% daily decay on amount above threshold
  maxDecayPerDay: 250000, // Max 250K decay per day
};

/**
 * Calculate resource decay for a stored amount.
 */
export function calculateResourceDecay(storedAmount: number): number {
  if (storedAmount <= DECAY_CONFIG.threshold) return 0;
  const excess = storedAmount - DECAY_CONFIG.threshold;
  const decay = Math.floor(excess * DECAY_CONFIG.rate);
  return Math.min(decay, DECAY_CONFIG.maxDecayPerDay);
}

/**
 * Apply daily decay to a player's resources.
 * Returns the amounts to deduct.
 */
export function applyDailyDecay(player: { resources_metal: number; resources_energy: number }): {
  metalDecay: number;
  energyDecay: number;
} {
  return {
    metalDecay: calculateResourceDecay(player.resources_metal),
    energyDecay: calculateResourceDecay(player.resources_energy),
  };
}

export { DECAY_CONFIG };
