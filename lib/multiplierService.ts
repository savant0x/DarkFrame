/**
 * @file lib/multiplierService.ts
 * @created 2026-05-07
 * @overview Additive multiplier stacking with soft diminishing returns
 *
 * Converts all multiplicative bonuses (VIP, Flag Bearer, Shrine, Balance)
 * to additive stacking with tiered diminishing returns.
 *
 * Tier 1: First +100% → full value (×1.0)
 * Tier 2: Next +100% → 75% value (×0.75)
 * Tier 3: Next +100% → 50% value (×0.50)
 * Tier 4+: Beyond +300% → 10% value per +100% (×0.10)
 */

export interface BonusSource {
  name: string;
  bonusPercent: number; // e.g. 50 for +50%
}

/**
 * Calculate total multiplier from additive bonus sources with diminishing returns.
 *
 * @param bonusSources - Array of bonus sources with their percentage values
 * @returns Final multiplier (e.g. 2.25 for +125% effective bonus)
 *
 * @example
 * // VIP (+50%) + Flag Bearer (+50%) + Shrine (+70%) = +170% raw
 * // Tier 1: 100% × 1.0 = 100%
 * // Tier 2: 70% × 0.75 = 52.5%
 * // Effective: +152.5% → multiplier = 2.525
 * calculateTotalMultiplier([
 *   { name: 'VIP', bonusPercent: 50 },
 *   { name: 'Flag Bearer', bonusPercent: 50 },
 *   { name: 'Shrine', bonusPercent: 70 },
 * ]);
 * // Returns: 2.525
 */
export function calculateTotalMultiplier(bonusSources: BonusSource[]): number {
  const totalRaw = bonusSources.reduce((sum, b) => sum + b.bonusPercent, 0);

  let effective = 0;
  let remaining = totalRaw;

  // Tier 1: First 100% at full value
  const tier1 = Math.min(remaining, 100);
  effective += tier1 * 1.0;
  remaining -= tier1;

  // Tier 2: Next 100% at 75% value
  if (remaining > 0) {
    const tier2 = Math.min(remaining, 100);
    effective += tier2 * 0.75;
    remaining -= tier2;
  }

  // Tier 3: Next 100% at 50% value
  if (remaining > 0) {
    const tier3 = Math.min(remaining, 100);
    effective += tier3 * 0.50;
    remaining -= tier3;
  }

  // Tier 4+: Beyond 300% at 10% value per 100%
  if (remaining > 0) {
    effective += remaining * 0.10;
  }

  return 1 + (effective / 100);
}

/**
 * Get a human-readable breakdown of the multiplier calculation.
 * Used for UI display.
 */
export function getMultiplierBreakdown(bonusSources: BonusSource[]): {
  sources: { name: string; raw: number; effective: number }[];
  totalRaw: number;
  totalEffective: number;
  finalMultiplier: number;
} {
  const totalRaw = bonusSources.reduce((sum, b) => sum + b.bonusPercent, 0);
  const finalMultiplier = calculateTotalMultiplier(bonusSources);

  let remaining = totalRaw;
  const sources = bonusSources.map((source) => {
    const effective = source.bonusPercent; // Each source contributes its full amount to the pool
    return { name: source.name, raw: source.bonusPercent, effective };
  });

  const totalEffective = (finalMultiplier - 1) * 100;

  return { sources, totalRaw, totalEffective, finalMultiplier };
}
