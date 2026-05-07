/**
 * @file lib/staminaService.ts
 * @created 2026-05-07
 * @overview Stamina system — soft diminishing returns on daily actions
 *
 * Players have a daily action counter. As they perform more actions,
 * their efficiency decreases in tiers. Never hits zero (25% floor).
 * Resets daily.
 */

const STAMINA_TIERS = [
  { threshold: 2000, efficiency: 1.0 },
  { threshold: 3000, efficiency: 0.75 },
  { threshold: 4000, efficiency: 0.50 },
  { threshold: Infinity, efficiency: 0.25 },
];

/**
 * Get stamina efficiency based on actions performed today.
 * @param actionsToday - Number of actions performed today
 * @returns Efficiency multiplier (0.25 to 1.0)
 */
export function getStaminaEfficiency(actionsToday: number): number {
  for (const tier of STAMINA_TIERS) {
    if (actionsToday < tier.threshold) return tier.efficiency;
  }
  return 0.25; // Floor
}

/**
 * Get the current stamina tier info for UI display.
 */
export function getStaminaTier(actionsToday: number): {
  tier: number;
  efficiency: number;
  nextThreshold: number | null;
  actionsUntilNext: number | null;
} {
  for (let i = 0; i < STAMINA_TIERS.length; i++) {
    if (actionsToday < STAMINA_TIERS[i].threshold) {
      return {
        tier: i + 1,
        efficiency: STAMINA_TIERS[i].efficiency,
        nextThreshold: STAMINA_TIERS[i].threshold,
        actionsUntilNext: STAMINA_TIERS[i].threshold - actionsToday,
      };
    }
  }
  return { tier: STAMINA_TIERS.length, efficiency: 0.25, nextThreshold: null, actionsUntilNext: null };
}

/**
 * Get daily stamina reset date string.
 */
export function getDailyStaminaReset(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}
