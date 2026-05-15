/**
 * @file lib/resourceDecayService.ts
 * @created 2026-05-07
 * @updated 2026-05-08 — Tiered progressive decay (FID-20260508-BALANCE-V2)
 * @overview Resource decay (rot) — tiered progressive decay on stored resources
 *
 * Prevents infinite hoarding. Progressive tiers ensure small stockpiles
 * are safe while large hoards face meaningful pressure.
 *
 * Tiered brackets:
 * - 0 – 500K: No decay
 * - 500K – 5M: 0.5% daily
 * - 5M – 25M: 1.0% daily
 * - 25M+: 2.0% daily
 * No hard cap — large stockpiles feel real pressure.
 */

interface DecayBracket {
  min: number;
  max: number;
  rate: number;
}

const DECAY_BRACKETS: DecayBracket[] = [
  { min: 0, max: 500000, rate: 0 },
  { min: 500000, max: 5000000, rate: 0.005 },
  { min: 5000000, max: 25000000, rate: 0.01 },
  { min: 25000000, max: Infinity, rate: 0.02 },
];

/**
 * Calculate resource decay for a stored amount using tiered brackets.
 */
export function calculateResourceDecay(storedAmount: number): number {
  if (storedAmount <= 500000) return 0;

  let totalDecay = 0;
  let remaining = storedAmount;

  for (const bracket of DECAY_BRACKETS) {
    if (remaining <= bracket.min) break;
    const taxableInBracket = Math.min(remaining, bracket.max) - bracket.min;
    if (taxableInBracket > 0) {
      totalDecay += Math.floor(taxableInBracket * bracket.rate);
    }
  }

  return totalDecay;
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

export { DECAY_BRACKETS };
