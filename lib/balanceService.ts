/**
 * @file lib/balanceService.ts
 * @created 2025-10-17
 * @updated 2026-05-08 — Continuous scaling formula (FID-20260508-BALANCE-V2)
 * @overview Army balance calculation and penalty enforcement system
 *
 * OVERVIEW:
 * Implements multi-layered penalty system for army balance. Players with imbalanced
 * armies (too much STR or too much DEF) suffer penalties to effective power, combat
 * performance, gathering efficiency, and production.
 *
 * CHANGED: Replaced hard threshold tiers with continuous scaling formula.
 * This eliminates the 37% power cliff at ratio 0.85 while still rewarding
 * balanced armies and penalizing extreme specialization.
 *
 * CONTINUOUS FORMULA:
 * powerMultiplier = 0.5 + 0.6 × ratio
 * damageDealtMultiplier = 0.8 + 0.25 × ratio
 * damageTakenMultiplier = 1.30 - 0.35 × ratio
 * gatheringMultiplier = 0.75 + 0.35 × ratio
 * slotRegenMultiplier = 0.85 + 0.15 × ratio
 *
 * At ratio 0.0 (all one type): 50% power, 1.30x dmg taken, 0.80x dmg dealt
 * At ratio 0.5 (2:1 split): 80% power, 1.125x dmg taken, 0.925x dmg dealt
 * At ratio 1.0 (perfect): 110% power, 0.95x dmg taken, 1.05x dmg dealt
 */

export type BalanceStatus = 'CRITICAL' | 'IMBALANCED' | 'BALANCED' | 'OPTIMAL';

export interface BalanceEffects {
  ratio: number;
  status: BalanceStatus;
  powerMultiplier: number;
  damageTakenMultiplier: number;
  damageDealtMultiplier: number;
  gatheringMultiplier: number;
  slotRegenMultiplier: number;
  effectivePower: number;
  warnings: string[];
  bonuses: string[];
  recommendation?: string;
}

/**
 * Calculate comprehensive balance effects using continuous scaling.
 *
 * @param str - Total strength (offensive power)
 * @param def - Total defense (defensive power)
 * @returns Complete BalanceEffects object with all multipliers
 */
export function calculateBalanceEffects(str: number, def: number): BalanceEffects {
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

  const ratio = Math.min(str, def) / Math.max(str, def) || 0;
  const totalPower = str + def;
  const strHeavy = str > def;

  // Continuous scaling formulas
  const powerMultiplier = 0.5 + 0.6 * ratio;
  const damageDealtMultiplier = 0.8 + 0.25 * ratio;
  const damageTakenMultiplier = 1.30 - 0.35 * ratio;
  const gatheringMultiplier = 0.75 + 0.35 * ratio;
  const slotRegenMultiplier = 0.85 + 0.15 * ratio;
  const effectivePower = Math.floor(totalPower * powerMultiplier);

  // Determine status for UI display
  let status: BalanceStatus;
  if (ratio < 0.5) status = 'CRITICAL';
  else if (ratio < 0.7) status = 'IMBALANCED';
  else if (ratio < 0.95) status = 'BALANCED';
  else status = 'OPTIMAL';

  const warnings: string[] = [];
  const bonuses: string[] = [];
  let recommendation: string | undefined;

  if (ratio < 0.7) {
    const defNeeded = strHeavy ? Math.ceil(str * 0.7 - def) : 0;
    const strNeeded = !strHeavy ? Math.ceil(def * 0.7 - str) : 0;
    warnings.push(`⚠️ Imbalanced: ${((1 - powerMultiplier) * 100).toFixed(0)}% power reduction`);
    if (damageTakenMultiplier > 1.05) warnings.push(`🛡️ Excess damage taken: +${((damageTakenMultiplier - 1) * 100).toFixed(0)}%`);
    if (damageDealtMultiplier < 0.95) warnings.push(`⚔️ Reduced offense: -${((1 - damageDealtMultiplier) * 100).toFixed(0)}% damage dealt`);
    if (gatheringMultiplier < 0.95) warnings.push(`📉 Reduced gathering: -${((1 - gatheringMultiplier) * 100).toFixed(0)}%`);
    recommendation = strHeavy
      ? `Build ${defNeeded} more DEF for better balance`
      : `Build ${strNeeded} more STR for better balance`;
  } else if (ratio >= 0.95) {
    bonuses.push('⭐ Optimal balance: +10% effective power');
    bonuses.push(`🛡️ Coordinated defense: -${((1 - damageTakenMultiplier) * 100).toFixed(0)}% damage taken`);
    bonuses.push(`⚔️ Tactical advantage: +${((damageDealtMultiplier - 1) * 100).toFixed(0)}% damage dealt`);
    bonuses.push(`📈 High morale: +${((gatheringMultiplier - 1) * 100).toFixed(0)}% gathering efficiency`);
    recommendation = 'Perfect balance! Maintain this ratio for maximum effectiveness.';
  } else {
    bonuses.push('✅ Balanced army — no significant penalties');
    recommendation = ratio < 0.95
      ? 'Build slightly more of the weaker type for OPTIMAL status'
      : 'Build slightly more of the weaker type for OPTIMAL status';
  }

  return {
    ratio,
    status,
    powerMultiplier,
    damageTakenMultiplier,
    damageDealtMultiplier,
    gatheringMultiplier,
    slotRegenMultiplier,
    effectivePower,
    warnings,
    bonuses,
    recommendation
  };
}

export function applyBalanceToDamageTaken(incomingDamage: number, balanceEffects: BalanceEffects): number {
  return Math.floor(incomingDamage * balanceEffects.damageTakenMultiplier);
}

export function applyBalanceToDamageDealt(outgoingDamage: number, balanceEffects: BalanceEffects): number {
  return Math.floor(outgoingDamage * balanceEffects.damageDealtMultiplier);
}

export function applyBalanceToGathering(baseAmount: number, balanceEffects: BalanceEffects): number {
  return Math.floor(baseAmount * balanceEffects.gatheringMultiplier);
}

export function applyBalanceToSlotRegen(baseSlots: number, balanceEffects: BalanceEffects): number {
  return Math.floor(baseSlots * balanceEffects.slotRegenMultiplier);
}

export function getBalanceStatusIcon(status: BalanceStatus): string {
  switch (status) {
    case 'CRITICAL': return '❌';
    case 'IMBALANCED': return '⚠️';
    case 'BALANCED': return '✅';
    case 'OPTIMAL': return '⭐';
  }
}

export function getBalanceStatusColor(status: BalanceStatus): string {
  switch (status) {
    case 'CRITICAL': return 'text-red-500';
    case 'IMBALANCED': return 'text-yellow-500';
    case 'BALANCED': return 'text-green-500';
    case 'OPTIMAL': return 'text-yellow-400';
  }
}

export function formatBalanceRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
