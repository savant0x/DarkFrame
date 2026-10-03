/**
 * @file lib/combatPowerService.ts
 * @created 2025-10-25
 * @updated 2026-10-02 (FID-20261002-012 §5.1/§5.5 — display/resolver parity)
 * @overview Pure combat power calculation - only factors that directly affect battle outcomes
 *
 * OVERVIEW:
 * Calculates a player's true combat effectiveness based ONLY on factors that affect battles.
 * Excludes economic, progression, and territorial factors to provide accurate combat rankings.
 *
 * COMBAT POWER FORMULA (FID-20261002-012 §5.5):
 *   combatPower = (⌊STR × strEffects⌋ + ⌊DEF × defEffects⌋) × balance.powerMultiplier
 *
 * The STR/DEF effect multipliers come from the ONE composition seam
 * (lib/research/techEffects.composeCombatEffects) — the SAME seam resolveBattle
 * consumes, so display and resolved combat can never disagree again:
 *   - doctrine/mastery: ACTUAL axis weighting via getDoctrineBonuses
 *     (Offensive boosts STR 1.15, Defensive DEF 1.15, Tactical both, each
 *     mastery-amplified — the old fixed 7.5%/10% averages are gone);
 *   - clan military research: attack% on the STR axis, defense% on the DEF
 *     axis (never averaged into one all-purpose multiplier);
 *   - combat discoveries: unitStrength on STR, unitDefense on DEF;
 *   - personal technologies (roleless display convention): tactical-warfare's
 *     +20% on the STR axis, fortification's +15% on the DEF axis.
 *   - Flag-bearer strength is ENCOUNTER state (resolveBattle applies it per
 *     fight) and is deliberately NOT folded into a standing power rating.
 *
 * DAMAGE/critical effects (discovery damageDealt/damageTakenReduction,
 * tactical-warfare crit) do NOT inflate the power number — they are reported
 * separately in the breakdown, per §5.5 ("show damage/critical effects
 * separately instead of inventing an averaged all-purpose combat multiplier").
 *
 * INCLUDED FACTORS:
 * - Base Stats: totalStrength + totalDefense (from units owned)
 * - Balance Multiplier: 0.5× (critical) to 1.1× (optimal) based on STR/DEF ratio
 * - Clan Military Research: Attack/defense bonuses from military tech tree
 * - Combat Discoveries: Ancient technologies that boost unit STR/DEF
 * - Specialization: Combat doctrine bonuses (Offensive/Defensive/Tactical)
 * - Personal technologies: fortification (DEF) / tactical-warfare (STR)
 *
 * EXCLUDED FACTORS (not combat-relevant):
 * - Player level (progression metric, not combat strength)
 * - Factory ownership (temporary/contested, not personal power)
 * - Economic bonuses (harvest speed, bank capacity)
 * - Territory count (strategic value, not combat ability)
 *
 * USAGE:
 * import { calculateCombatPower } from '@/lib/combatPowerService';
 *
 * const { combatPower, breakdown } = await calculateCombatPower('PlayerName');
 * console.log(`Combat Power: ${combatPower}`);
 */

import { db } from './db/connection';
import { players, clans } from './db/schema';
import { eq } from 'drizzle-orm';
import { calculateBalanceEffects } from './balanceService';
import { getDiscoveryBonuses } from './discoveryService';
import { getClanBonuses } from './clanResearchService';
import { getPlayerDoctrineBonuses } from './specializationService';
import {
  composeCombatEffects,
  getPersonalTechCombatEffects,
} from './research/techEffects';

/**
 * Combat power breakdown for transparency.
 *
 * FID-20261002-012: the three invented averaged percentages
 * (clanMilitaryBonus / discoveryBonus / specializationBonus /
 * totalCombatMultiplier) are replaced by the composition seam's actual
 * per-axis multipliers plus the damage/critical effects shown separately.
 */
export interface CombatPowerBreakdown {
  // Base stats
  rawStrength: number;
  rawDefense: number;
  rawPower: number;

  // Effective stats (raw × composed axis multipliers, floored)
  effectiveStrength: number;
  effectiveDefense: number;
  effectiveStrengthMultiplier: number;
  effectiveDefenseMultiplier: number;

  // Damage/critical effects — displayed, never folded into the power number
  damageDealtBonusPct: number;
  damageTakenReductionPct: number;
  criticalChance: number;

  // Balance effects
  balanceRatio: number;
  balanceStatus: string;
  balanceMultiplier: number;
  balancedPower: number;

  // Final result
  finalCombatPower: number;
}

/**
 * Calculate player's pure combat power
 *
 * Only includes factors that directly affect combat outcomes.
 * Excludes economic, progression, and territorial bonuses.
 *
 * Every effect read fails soft to neutral (the same contract as the
 * resolver's stacks) — an unreadable bonus never fails a stats page.
 *
 * @param username - Player username
 * @returns Combat power rating and detailed breakdown
 */
export async function calculateCombatPower(username: string): Promise<{
  combatPower: number;
  breakdown: CombatPowerBreakdown;
}> {
  const [player] = await db.select().from(players).where(eq(players.username, username)).limit(1);

  if (!player) {
    throw new Error(`Player not found: ${username}`);
  }

  // ============================================================
  // STEP 1: Base Combat Stats (STR + DEF)
  // ============================================================
  const totalStrength = player.totalStrength ?? 0;
  const totalDefense = player.totalDefense ?? 0;
  const rawPower = totalStrength + totalDefense;

  // ============================================================
  // STEP 2: Balance Multiplier (0.5× to 1.1×) — from the RAW stats
  // (true army balance, pre-bonus; the resolver computes it the same way).
  // ============================================================
  const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);

  // ============================================================
  // STEP 3: Effect composition through the ONE seam (§5.1) — the same
  // categories resolveBattle applies, minus encounter-only state (flag).
  // ============================================================
  let clanAttackPct = 0;
  let clanDefensePct = 0;
  if (player.clanName || player.clanId) {
    try {
      const clanId = player.clanId ?? undefined;
      if (clanId) {
        const bonuses = await getClanBonuses(clanId);
        clanAttackPct = bonuses.attack || 0;
        clanDefensePct = bonuses.defense || 0;
      } else {
        // Legacy clanName-only rows: resolve by name → id as before.
        const [clan] = await db.select().from(clans).where(eq(clans.name, player.clanName as string)).limit(1);
        if (clan?.id) {
          const bonuses = await getClanBonuses(clan.id);
          clanAttackPct = bonuses.attack || 0;
          clanDefensePct = bonuses.defense || 0;
        }
      }
    } catch (error) {
      // Clan research not available, continue without bonus
      console.warn(`Could not fetch clan bonuses for ${username}:`, error);
    }
  }

  let discovery: Awaited<ReturnType<typeof getDiscoveryBonuses>> | undefined;
  try {
    discovery = await getDiscoveryBonuses(username);
  } catch (error) {
    // Discoveries not available, continue without bonus
    console.warn(`Could not fetch discovery bonuses for ${username}:`, error);
  }

  let doctrine: { strMul: number; defMul: number } | undefined;
  try {
    doctrine = await getPlayerDoctrineBonuses(username);
  } catch {
    // Doctrine not available, continue neutral.
  }

  // Personal technologies — roleless display convention: tactical-warfare's
  // advertised attack boost lands on the STR axis, fortification's advertised
  // base defense on the DEF axis (documented in the catalog's effect copy).
  const techFull = getPersonalTechCombatEffects(player.unlockedTechs);
  const hasFortification = techFull.baseDefensePct > 0;
  const hasTactical = techFull.attackStrPct > 0;
  const tech = {
    attackStrPct: hasTactical ? techFull.attackStrPct : 0,
    defensePct: hasFortification ? techFull.baseDefensePct : 0,
    damageTakenReductionPct: 0, // encounter-scoped (base raids only) — not a standing stat
    critChanceBonus: hasTactical ? techFull.critChanceBonus : 0,
    critDamageMultiplier: hasTactical ? techFull.critDamageMultiplier : 1,
  };

  const effects = composeCombatEffects({
    doctrine,
    clan: { attackPct: clanAttackPct, defensePct: clanDefensePct },
    discovery: discovery
      ? {
          unitStrengthPct: discovery.unitStrength || 0,
          unitDefensePct: discovery.unitDefense || 0,
          damageDealtPct: discovery.damageDealt || 0,
          damageTakenReductionPct: discovery.damageTakenReduction || 0,
        }
      : undefined,
    tech,
  });

  // ============================================================
  // STEP 4: Effective stats + final power (§5.5: contribution from the
  // EFFECTIVE stat sums, weighted per axis — never a fixed average).
  // ============================================================
  const effectiveStrength = Math.floor(totalStrength * effects.strMul);
  const effectiveDefense = Math.floor(totalDefense * effects.defMul);
  const combatPower = Math.floor((effectiveStrength + effectiveDefense) * balanceEffects.powerMultiplier);

  return {
    combatPower,
    breakdown: {
      // Base stats
      rawStrength: totalStrength,
      rawDefense: totalDefense,
      rawPower: rawPower,

      // Effective stats (the resolver's preparation for the same participant)
      effectiveStrength,
      effectiveDefense,
      effectiveStrengthMultiplier: effects.strMul,
      effectiveDefenseMultiplier: effects.defMul,

      // Damage/critical effects shown separately (§5.5)
      damageDealtBonusPct: (effects.damageDealtMul - 1) * 100,
      damageTakenReductionPct: (1 - effects.damageTakenMul) * 100,
      criticalChance: effects.critChance,

      // Balance adjustment
      balanceRatio: balanceEffects.ratio,
      balanceStatus: balanceEffects.status,
      balanceMultiplier: balanceEffects.powerMultiplier,
      balancedPower: balanceEffects.effectivePower,

      // Final result
      finalCombatPower: combatPower
    }
  };
}

/**
 * Calculate combat power for multiple players (batch operation)
 * Useful for leaderboards and ranking systems
 *
 * @param usernames - Array of player usernames
 * @returns Map of username to combat power
 *
 * @example
 * const powers = await calculateBatchCombatPower(['Player1', 'Player2']);
 * // { 'Player1': 5500, 'Player2': 8200 }
 */
export async function calculateBatchCombatPower(
  usernames: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  for (const username of usernames) {
    try {
      const { combatPower } = await calculateCombatPower(username);
      results.set(username, combatPower);
    } catch (error) {
      console.error(`Failed to calculate combat power for ${username}:`, error);
      results.set(username, 0);
    }
  }

  return results;
}

/**
 * FOOTER:
 *
 * DESIGN PHILOSOPHY:
 * Combat power should ONLY reflect factors that affect battle outcomes.
 * Economic bonuses (harvest speed, bank capacity) are intentionally excluded
 * because they don't make you stronger in combat - they just make you richer.
 *
 * DISPLAY/RESOLVER PARITY (FID-20261002-012):
 * This module and resolveBattle consume the SAME composition seam — an effect
 * can never double-apply between display and resolution, and a doctrine's
 * actual STR/DEF weighting (mastery-amplified) is what both show and use.
 *
 * BALANCE IMPACT:
 * The balance multiplier (0.5× to 1.1×) remains the most critical factor,
 * computed from RAW stats exactly as the resolver does.
 */
