/**
 * @file lib/combatPowerService.ts
 * @created 2025-10-25
 * @overview Pure combat power calculation - only factors that directly affect battle outcomes
 * 
 * OVERVIEW:
 * Calculates a player's true combat effectiveness based ONLY on factors that affect battles.
 * Excludes economic, progression, and territorial factors to provide accurate combat rankings.
 * 
 * COMBAT POWER FORMULA:
 * Combat Power = (STR + DEF) × balanceMultiplier × combatBonusMultipliers
 * 
 * INCLUDED FACTORS:
 * - Base Stats: totalStrength + totalDefense (from units owned)
 * - Balance Multiplier: 0.5× (critical) to 1.1× (optimal) based on STR/DEF ratio
 * - Clan Military Research: Attack/defense bonuses from military tech tree
 * - Combat Discoveries: Ancient technologies that boost unit STR/DEF or damage
 * - Specialization: Combat doctrine bonuses (Offensive/Defensive/Tactical)
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

import { connectToDatabase } from './mongodb';
import type { Player } from '@/types/game.types';
import type { Clan } from '@/types/clan.types';
import { calculateBalanceEffects } from './balanceService';
import { getDiscoveryBonuses } from './discoveryService';
import { getClanBonuses } from './clanResearchService';

/**
 * Combat power breakdown for transparency
 */
export interface CombatPowerBreakdown {
  // Base stats
  rawStrength: number;
  rawDefense: number;
  rawPower: number;
  
  // Balance effects
  balanceRatio: number;
  balanceStatus: string;
  balanceMultiplier: number;
  balancedPower: number;
  
  // Combat bonuses (% multipliers)
  clanMilitaryBonus: number;
  discoveryBonus: number;
  specializationBonus: number;
  totalCombatMultiplier: number;
  
  // Final result
  finalCombatPower: number;
}

/**
 * Calculate player's pure combat power
 * 
 * Only includes factors that directly affect combat outcomes.
 * Excludes economic, progression, and territorial bonuses.
 * 
 * @param username - Player username
 * @returns Combat power rating and detailed breakdown
 * 
 * @example
 * const result = await calculateCombatPower('FAME');
 * // result.combatPower: 8250
 * // result.breakdown.balanceStatus: 'OPTIMAL'
 * // result.breakdown.totalCombatMultiplier: 1.5
 */
export async function calculateCombatPower(username: string): Promise<{
  combatPower: number;
  breakdown: CombatPowerBreakdown;
}> {
  const db = await connectToDatabase();
  const player = await db.collection<Player>('players').findOne({ username });
  
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
  // STEP 2: Balance Multiplier (0.5× to 1.1×)
  // Critical game mechanic - imbalanced armies are weak!
  // ============================================================
  const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);
  const balancedPower = balanceEffects.effectivePower;
  
  // ============================================================
  // STEP 3: Combat Bonus Multipliers
  // ============================================================
  let combatMultiplier = 1.0;
  
  // 3A. Clan Military Research (attack/defense bonuses ONLY)
  let clanCombatBonus = 0;
  if (player.clanName) {
    try {
      const clan = await db.collection<Clan>('clans').findOne({ name: player.clanName });
      if (clan?.research?.unlockedTechs && clan.research.unlockedTechs.length > 0) {
        const bonuses = await getClanBonuses(clan._id ?? clan.name);
        // Only include attack and defense bonuses (military research)
        const attackBonus = bonuses.attack || 0;
        const defenseBonus = bonuses.defense || 0;
        clanCombatBonus = (attackBonus + defenseBonus) / 2; // Average combat bonus
      }
    } catch (error) {
      // Clan research not available, continue without bonus
      console.warn(`Could not fetch clan bonuses for ${username}:`, error);
    }
  }
  combatMultiplier *= (1 + clanCombatBonus / 100);
  
  // 3B. Discovery Combat Bonuses (ancient technologies)
  // Only include: unitStrength, unitDefense, damageDealt, damageTakenReduction
  let discoveryCombatBonus = 0;
  try {
    const discoveryBonuses = await getDiscoveryBonuses(username);
    discoveryCombatBonus = (
      (discoveryBonuses.unitStrength || 0) +
      (discoveryBonuses.unitDefense || 0) +
      (discoveryBonuses.damageDealt || 0) +
      (discoveryBonuses.damageTakenReduction || 0)
    );
  } catch (error) {
    // Discoveries not available, continue without bonus
    console.warn(`Could not fetch discovery bonuses for ${username}:`, error);
  }
  combatMultiplier *= (1 + discoveryCombatBonus / 100);
  
  // 3C. Specialization Combat Bonuses
  // Offensive: +15% STR, Defensive: +15% DEF, Tactical: +10% both
  let specializationBonus = 0;
  if (player.specialization?.doctrine) {
    const doctrine = player.specialization.doctrine;
    if (doctrine === 'offensive') {
      // +15% STR = ~7.5% average when considering both STR and DEF
      specializationBonus = 7.5;
    } else if (doctrine === 'defensive') {
      // +15% DEF = ~7.5% average
      specializationBonus = 7.5;
    } else if (doctrine === 'tactical') {
      // +10% both STR and DEF = 10% total
      specializationBonus = 10;
    }
  }
  combatMultiplier *= (1 + specializationBonus / 100);
  
  // ============================================================
  // STEP 4: Final Combat Power Calculation
  // ============================================================
  const combatPower = Math.floor(balancedPower * combatMultiplier);
  
  return {
    combatPower,
    breakdown: {
      // Base stats
      rawStrength: totalStrength,
      rawDefense: totalDefense,
      rawPower: rawPower,
      
      // Balance adjustment
      balanceRatio: balanceEffects.ratio,
      balanceStatus: balanceEffects.status,
      balanceMultiplier: balanceEffects.powerMultiplier,
      balancedPower: balancedPower,
      
      // Combat bonuses (as percentages)
      clanMilitaryBonus: clanCombatBonus,
      discoveryBonus: discoveryCombatBonus,
      specializationBonus: specializationBonus,
      totalCombatMultiplier: combatMultiplier,
      
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
 * BALANCE IMPACT:
 * The balance multiplier (0.5× to 1.1×) is the most critical factor.
 * A player with 10,000 raw power but critical imbalance (0.5×) has only 5,000 combat power.
 * A player with 5,000 raw power but optimal balance (1.1×) has 5,500 combat power.
 * This encourages strategic army composition over pure unit spam.
 * 
 * FUTURE ENHANCEMENTS:
 * - Cache combat power calculations (5-minute TTL)
 * - Add combat power history tracking for trend analysis
 * - Implement "Power Rating Change" notifications when bonuses unlock
 * - Add "Combat Power Simulator" to preview changes before committing resources
 */
