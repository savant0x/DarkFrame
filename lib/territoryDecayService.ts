/**
 * @file lib/territoryDecayService.ts
 * @created 2026-05-07
 * @overview Territory decay — uncontested territory slowly reverts to neutral
 *
 * Prevents map stagnation without forced resets.
 * 14-day grace period after capture, then 5% daily chance to revert.
 */

const TERRITORY_DECAY_CONFIG = {
  gracePeriodDays: 14,     // No decay for 14 days after capture
  decayCheckInterval: 24,  // Check every 24 hours
  revertChance: 0.05,      // 5% chance per check after grace period
};

/**
 * Check if a territory should decay.
 * @param capturedAt - ISO timestamp when territory was captured
 * @returns true if territory should revert to neutral
 */
export function checkTerritoryDecay(capturedAt: string | Date): boolean {
  const captureTime = new Date(capturedAt).getTime();
  const daysSinceCapture = (Date.now() - captureTime) / (1000 * 60 * 60 * 24);

  if (daysSinceCapture < TERRITORY_DECAY_CONFIG.gracePeriodDays) return false;

  return Math.random() < TERRITORY_DECAY_CONFIG.revertChance;
}

/**
 * Get days until decay can start for a territory.
 */
export function getDaysUntilDecay(capturedAt: string | Date): number {
  const captureTime = new Date(capturedAt).getTime();
  const daysSinceCapture = (Date.now() - captureTime) / (1000 * 60 * 60 * 24);
  return Math.max(0, TERRITORY_DECAY_CONFIG.gracePeriodDays - daysSinceCapture);
}

export { TERRITORY_DECAY_CONFIG };
