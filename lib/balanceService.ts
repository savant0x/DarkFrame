/**
 * @file lib/balanceService.ts
 * @created 2025-10-17
 * @overview Army balance calculation and penalty enforcement system
 * 
 * OVERVIEW:
 * Implements multi-layered penalty system for army balance. Players with imbalanced
 * armies (too much STR or too much DEF) suffer penalties to effective power, combat
 * performance, gathering efficiency, and production. Perfect balance is rewarded with
 * bonuses.
 * 
 * BALANCE TIERS:
 * - CRITICAL (ratio < 0.7): 50% power, +30% damage taken, -20% damage dealt, -25% gathering, -15% slots
 * - IMBALANCED (0.7-0.85 or 1.15-1.5): 80% power, +15% damage taken, -10% damage dealt, -10% gathering
 * - BALANCED (0.85-1.15): 100% normal stats
 * - OPTIMAL (0.95-1.05): 110% power, -5% damage taken, +5% damage dealt, +10% gathering
 * 
 * STRATEGIC IMPACT:
 * Forces players to maintain balanced armies for competitive advantage. Heavily
 * imbalanced armies become vulnerable and inefficient.
 */

/**
 * Balance status tiers based on STR/DEF ratio
 */
export type BalanceStatus = 'CRITICAL' | 'IMBALANCED' | 'BALANCED' | 'OPTIMAL';

/**
 * Complete balance effects object with all multipliers and display data
 */
export interface BalanceEffects {
  ratio: number;
  status: BalanceStatus;
  powerMultiplier: number;          // Applied to total power (0.5 to 1.1)
  damageTakenMultiplier: number;    // Multiplier for incoming damage (0.95 to 1.3)
  damageDealtMultiplier: number;    // Multiplier for outgoing damage (0.8 to 1.05)
  gatheringMultiplier: number;      // Applied to resource gathering (0.75 to 1.1)
  slotRegenMultiplier: number;      // Applied to slot regeneration (0.85 to 1.0)
  effectivePower: number;           // Final power after balance multiplier
  warnings: string[];               // Active penalty messages
  bonuses: string[];                // Active bonus messages
  recommendation?: string;          // How to improve balance
}

/**
 * Calculate comprehensive balance effects for a player's army
 * 
 * @param str - Total strength (offensive power)
 * @param def - Total defense (defensive power)
 * @returns Complete BalanceEffects object with all multipliers
 * 
 * @example
 * const effects = calculateBalanceEffects(100, 100);
 * // Returns BALANCED status with 1.0 multipliers
 * 
 * const effects = calculateBalanceEffects(200, 50);
 * // Returns CRITICAL status with severe penalties
 */
export function calculateBalanceEffects(str: number, def: number): BalanceEffects {
  // Handle edge cases
  if (str === 0 && def === 0) {
    return {
      ratio: 1.0,
      status: 'BALANCED',
      powerMultiplier: 1.0,
      damageTakenMultiplier: 1.0,
      damageDealtMultiplier: 1.0,
      gatheringMultiplier: 1.0,
      slotRegenMultiplier: 1.0,
      effectivePower: 0,
      warnings: [],
      bonuses: ['No army built yet']
    };
  }

  // Calculate balance ratio (min/max)
  const ratio = Math.min(str, def) / Math.max(str, def) || 0;
  const totalPower = str + def;
  const strHeavy = str > def;

  // CRITICAL IMBALANCE: ratio < 0.7
  if (ratio < 0.7) {
    const defNeeded = strHeavy ? Math.ceil(str * 0.7 - def) : 0;
    const strNeeded = !strHeavy ? Math.ceil(def * 0.7 - str) : 0;

    return {
      ratio,
      status: 'CRITICAL',
      powerMultiplier: 0.5,
      damageTakenMultiplier: 1.3,
      damageDealtMultiplier: 0.8,
      gatheringMultiplier: 0.75,
      slotRegenMultiplier: 0.85,
      effectivePower: Math.floor(totalPower * 0.5),
      warnings: [
        '❌ VULNERABLE: +30% damage taken in combat',
        '⚔️ Weakened offense: -20% damage dealt to enemies',
        '📉 Low morale: -25% resource gathering efficiency',
        '🏭 Strained production: -15% factory slot regeneration'
      ],
      bonuses: [],
      recommendation: strHeavy
        ? `Build ${defNeeded} more DEF to reach balanced status`
        : `Build ${strNeeded} more STR to reach balanced status`
    };
  }

  // MODERATE IMBALANCE: ratio 0.7-0.85 or 1.15-1.5
  if (ratio < 0.85) {
    const defNeeded = strHeavy ? Math.ceil(str * 0.85 - def) : 0;
    const strNeeded = !strHeavy ? Math.ceil(def * 0.85 - str) : 0;

    return {
      ratio,
      status: 'IMBALANCED',
      powerMultiplier: 0.8,
      damageTakenMultiplier: 1.15,
      damageDealtMultiplier: 0.9,
      gatheringMultiplier: 0.9,
      slotRegenMultiplier: 1.0,
      effectivePower: Math.floor(totalPower * 0.8),
      warnings: [
        '⚠️ Exposed: +15% damage taken in combat',
        '⚔️ Inefficient offense: -10% damage dealt',
        '📊 Reduced efficiency: -10% resource gathering'
      ],
      bonuses: [],
      recommendation: strHeavy
        ? `Build ${defNeeded} more DEF for balanced army`
        : `Build ${strNeeded} more STR for balanced army`
    };
  }

  // OPTIMAL BALANCE: ratio 0.95-1.05
  if (ratio >= 0.95 && ratio <= 1.05) {
    return {
      ratio,
      status: 'OPTIMAL',
      powerMultiplier: 1.1,
      damageTakenMultiplier: 0.95,
      damageDealtMultiplier: 1.05,
      gatheringMultiplier: 1.1,
      slotRegenMultiplier: 1.0,
      effectivePower: Math.floor(totalPower * 1.1),
      warnings: [],
      bonuses: [
        '⭐ Perfect synergy: +10% effective power',
        '🛡️ Coordinated defense: -5% damage taken',
        '⚔️ Tactical advantage: +5% damage dealt',
        '📈 High morale: +10% gathering efficiency'
      ],
      recommendation: 'Perfect balance! Maintain this ratio for maximum effectiveness.'
    };
  }

  // BALANCED: ratio 0.85-1.15
  return {
    ratio,
    status: 'BALANCED',
    powerMultiplier: 1.0,
    damageTakenMultiplier: 1.0,
    damageDealtMultiplier: 1.0,
    gatheringMultiplier: 1.0,
    slotRegenMultiplier: 1.0,
    effectivePower: totalPower,
    warnings: [],
    bonuses: ['✅ Balanced army - No penalties or bonuses'],
    recommendation: ratio < 0.95
      ? 'Build slightly more DEF for OPTIMAL status'
      : 'Build slightly more STR for OPTIMAL status'
  };
}

/**
 * Apply balance effects to combat damage taken
 * 
 * @param incomingDamage - Base damage before balance modifier
 * @param balanceEffects - Player's balance effects
 * @returns Modified damage with balance multiplier applied
 * 
 * @example
 * const effects = calculateBalanceEffects(200, 50); // Critical imbalance
 * const damage = applyBalanceToCombat(100, effects);
 * // Returns 130 (100 * 1.3 = +30% damage taken)
 */
export function applyBalanceToDamageTaken(
  incomingDamage: number,
  balanceEffects: BalanceEffects
): number {
  return Math.floor(incomingDamage * balanceEffects.damageTakenMultiplier);
}

/**
 * Apply balance effects to combat damage dealt
 * 
 * @param outgoingDamage - Base damage before balance modifier
 * @param balanceEffects - Player's balance effects
 * @returns Modified damage with balance multiplier applied
 * 
 * @example
 * const effects = calculateBalanceEffects(200, 50); // Critical imbalance
 * const damage = applyBalanceToDamageDealt(100, effects);
 * // Returns 80 (100 * 0.8 = -20% damage dealt)
 */
export function applyBalanceToDamageDealt(
  outgoingDamage: number,
  balanceEffects: BalanceEffects
): number {
  return Math.floor(outgoingDamage * balanceEffects.damageDealtMultiplier);
}

/**
 * Apply balance effects to resource gathering
 * 
 * @param baseAmount - Resources gathered before balance modifier
 * @param balanceEffects - Player's balance effects
 * @returns Modified amount with balance multiplier applied
 * 
 * @example
 * const effects = calculateBalanceEffects(200, 50); // Critical imbalance
 * const resources = applyBalanceToGathering(1000, effects);
 * // Returns 750 (1000 * 0.75 = -25% gathering)
 */
export function applyBalanceToGathering(
  baseAmount: number,
  balanceEffects: BalanceEffects
): number {
  return Math.floor(baseAmount * balanceEffects.gatheringMultiplier);
}

/**
 * Apply balance effects to factory slot regeneration
 * 
 * @param baseSlots - Slots to regenerate before balance modifier
 * @param balanceEffects - Player's balance effects
 * @returns Modified slots with balance multiplier applied
 * 
 * @example
 * const effects = calculateBalanceEffects(200, 50); // Critical imbalance
 * const slots = applyBalanceToSlotRegen(10, effects);
 * // Returns 8 (10 * 0.85 = -15% slot regen)
 */
export function applyBalanceToSlotRegen(
  baseSlots: number,
  balanceEffects: BalanceEffects
): number {
  return Math.floor(baseSlots * balanceEffects.slotRegenMultiplier);
}

/**
 * Get balance status icon for UI display
 */
export function getBalanceStatusIcon(status: BalanceStatus): string {
  switch (status) {
    case 'CRITICAL': return '❌';
    case 'IMBALANCED': return '⚠️';
    case 'BALANCED': return '✅';
    case 'OPTIMAL': return '⭐';
  }
}

/**
 * Get balance status color for UI display
 */
export function getBalanceStatusColor(status: BalanceStatus): string {
  switch (status) {
    case 'CRITICAL': return 'text-red-500';
    case 'IMBALANCED': return 'text-yellow-500';
    case 'BALANCED': return 'text-green-500';
    case 'OPTIMAL': return 'text-yellow-400';
  }
}

/**
 * Format balance ratio as percentage string
 */
export function formatBalanceRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
// 
// BALANCE PHILOSOPHY:
// The balance system creates strategic depth by punishing extreme
// specialization and rewarding balanced armies. Players must make
// trade-offs between pure offense/defense and overall effectiveness.
//
// PENALTY ESCALATION:
// - Critical imbalance (< 0.7 ratio): Severe multi-layered penalties
// - Moderate imbalance: Noticeable but manageable penalties
// - Balanced: Neutral baseline performance
// - Optimal: Significant bonuses rewarding perfect balance
//
// FUTURE EXTENSIONS:
// - Add balance requirements for specific attacks (e.g., raids need balanced army)
// - Implement dynamic penalties based on enemy balance
// - Add balance-based achievements and rewards
// - Create balance history tracking for analytics
//
// ============================================================
// END OF FILE
// ============================================================
