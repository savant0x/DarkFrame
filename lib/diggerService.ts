/**
 * @file lib/diggerService.ts
 * @created 2026-05-07
 * @overview Digger bonus calculation with exponential decay and guaranteed drops
 *
 * Replaces the old linear DIGGER_TIERS system with exponential decay:
 * Bonus = M × (1 - e^(-C×x))
 * where M = 200% cap, C = 0.008 decay constant, x = digger count
 *
 * Also implements guaranteed digger mechanic: every 75 cave explorations,
 * a digger is guaranteed to drop (anti-bad-luck).
 */

// Exponential decay constants
const DIGGER_BONUS_CAP = 200; // 200% max bonus (asymptote)
const DIGGER_DECAY_CONSTANT = 0.008;

// Guaranteed digger interval
const GUARANTEED_DIGGER_INTERVAL = 150; // Every 150 caves, guaranteed digger (increased from 75)

// Drop rate constants (reduced from old 30% → 1.5%)
const CAVE_DROP_RATE = 0.015; // 1.5% base drop rate (down from 2.5%)
const DIGGER_DROP_CHANCE = 0.20; // 20% of drops are diggers (down from 65%)
const TRADEABLE_DROP_CHANCE = 0.80; // 80% of drops are tradeable (up from 35%)

export interface DiggerDropResult {
  isDigger: boolean;
  isGuaranteed: boolean;
  newCavesSinceLast: number;
}

/**
 * Calculate total digger bonus using exponential decay formula.
 * Bonus approaches but never exceeds 200%.
 *
 * Formula: bonus = M × (1 - e^(-C×x))
 * @param diggerCount - Number of active diggers
 * @returns Bonus percentage (e.g. 150 for +150%)
 *
 * @example
 * getDiggerBonus(0);   // 0%
 * getDiggerBonus(10);  // ~14.8%
 * getDiggerBonus(50);  // ~65.9%
 * getDiggerBonus(100); // ~110.9%
 * getDiggerBonus(200); // ~155.3%
 * getDiggerBonus(500); // ~196.7% (approaching 200% cap)
 */
export function getDiggerBonus(diggerCount: number): number {
  if (diggerCount <= 0) return 0;
  return Math.floor(
    DIGGER_BONUS_CAP * (1 - Math.exp(-DIGGER_DECAY_CONSTANT * diggerCount)) * 100
  ) / 100;
}

/**
 * Roll for a digger drop with guaranteed drop mechanic.
 *
 * @param cavesSinceLastDigger - Number of caves explored since last digger
 * @returns DiggerDropResult with whether digger dropped and new counter
 */
export function rollDiggerDrop(cavesSinceLastDigger: number): DiggerDropResult {
  const newCount = cavesSinceLastDigger + 1;

  // Guaranteed digger every N caves
  if (newCount >= GUARANTEED_DIGGER_INTERVAL) {
    return { isDigger: true, isGuaranteed: true, newCavesSinceLast: 0 };
  }

  // Normal roll: 2.5% base drop rate, 20% of drops are diggers
  const roll = Math.random();
  const isDigger = roll < CAVE_DROP_RATE * DIGGER_DROP_CHANCE;

  return {
    isDigger,
    isGuaranteed: false,
    newCavesSinceLast: isDigger ? 0 : newCount,
  };
}

/**
 * Get the expected diggers per 12-hour full sweep.
 * Used for UI display and balancing.
 *
 * @param totalCaves - Total cave tiles on map (default 1800)
 * @returns Expected number of diggers per full sweep
 */
export function getExpectedDiggersPerSweep(totalCaves: number = 1350): number {
  // Normal drops: caves × dropRate × diggerChance
  const normalDiggers = totalCaves * CAVE_DROP_RATE * DIGGER_DROP_CHANCE;
  // Guaranteed drops: caves / interval
  const guaranteedDiggers = totalCaves / GUARANTEED_DIGGER_INTERVAL;
  return Math.round((normalDiggers + guaranteedDiggers) * 10) / 10;
}

export { CAVE_DROP_RATE, DIGGER_DROP_CHANCE, TRADEABLE_DROP_CHANCE, GUARANTEED_DIGGER_INTERVAL };
