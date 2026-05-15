/**
 * @file lib/pvpBurnService.ts
 * @created 2026-05-07
 * @updated 2026-05-08 — Progressive burn rate (FID-20260508-BALANCE-V2)
 * @overview PvP resource destruction — progressive burn on stolen resources
 *
 * When a player attacks another player:
 * - 30% base burn rate (increased from 20%)
 * - Progressive: +0.5% per 10× stockpile above 100K, capped at 40%
 * - Attack costs 1K metal + 1K energy (even on loss)
 * - Destroyed units are permanently removed from economy
 */

const BASE_BURN_RATE = 0.30; // 30% base (up from 20%)
const MAX_BURN_RATE = 0.40; // 40% cap
const ATTACK_COST = { metal: 1000, energy: 1000 };

/**
 * Calculate progressive burn rate based on victim's stockpile.
 * Higher stockpiles face higher burn rates to target whale wallets.
 *
 * @param stockpile - Victim's current resource stockpile
 * @returns Burn rate (0.30 to 0.40)
 */
export function calculateBurnRate(stockpile: number): number {
  if (stockpile <= 100000) return BASE_BURN_RATE;
  const multiplier = Math.floor(Math.log10(stockpile / 100000));
  const progressiveRate = BASE_BURN_RATE + (multiplier * 0.005);
  return Math.min(progressiveRate, MAX_BURN_RATE);
}

export interface PvPAttackResult {
  success: boolean;
  stolen: { metal: number; energy: number };
  burned: { metal: number; energy: number };
  actualGain: { metal: number; energy: number };
  attackCost: { metal: number; energy: number };
  message: string;
  burnRate: number;
}

/**
 * Process attack result with progressive resource burning.
 */
export function processAttackResult(
  stolenMetal: number,
  stolenEnergy: number,
  victimStockpile: number = 0
): PvPAttackResult {
  const burnRate = calculateBurnRate(victimStockpile);

  const burned = {
    metal: Math.floor(stolenMetal * burnRate),
    energy: Math.floor(stolenEnergy * burnRate),
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
    burnRate,
    message: `Gained ${actualGain.metal.toLocaleString()} metal, ${actualGain.energy.toLocaleString()} energy (${burned.metal.toLocaleString()} burned at ${(burnRate * 100).toFixed(0)}%)`,
  };
}

export { BASE_BURN_RATE, MAX_BURN_RATE, ATTACK_COST };
