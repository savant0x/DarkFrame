/**
 * @file lib/pvpBurnService.ts
 * @created 2026-05-07
 * @overview PvP resource destruction — 20% of stolen resources are permanently burned
 *
 * When a player attacks another player:
 * - 20% of stolen resources are permanently burned (removed from economy)
 * - Attack costs 1K metal + 1K energy (even on loss)
 * - Destroyed units are permanently removed from economy
 */

const BURN_RATE = 0.20; // 20% of stolen resources burned
const ATTACK_COST = { metal: 1000, energy: 1000 };

export interface PvPAttackResult {
  success: boolean;
  stolen: { metal: number; energy: number };
  burned: { metal: number; energy: number };
  actualGain: { metal: number; energy: number };
  attackCost: { metal: number; energy: number };
  message: string;
}

/**
 * Process attack result with resource burning.
 */
export function processAttackResult(
  stolenMetal: number,
  stolenEnergy: number
): PvPAttackResult {
  const burned = {
    metal: Math.floor(stolenMetal * BURN_RATE),
    energy: Math.floor(stolenEnergy * BURN_RATE),
  };

  const actualGain = {
    metal: stolenMetal - burned.metal,
    energy: stolenEnergy - burned.energy,
  };

  return {
    success: true,
    stolen: { metal: stolenMetal, energy: stolenEnergy },
    burned,
    actualGain,
    attackCost: ATTACK_COST,
    message: `Gained ${actualGain.metal.toLocaleString()} metal, ${actualGain.energy.toLocaleString()} energy (${burned.metal.toLocaleString()} burned)`,
  };
}

export { BURN_RATE, ATTACK_COST };
