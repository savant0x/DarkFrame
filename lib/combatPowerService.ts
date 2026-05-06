/**
 * @file lib/combatPowerService.ts
 * @overview Pure combat power calculation — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { calculateBalanceEffects } from './balanceService';
import { getDiscoveryBonuses } from './discoveryService';
import { getClanBonuses } from './clanResearchService';

export interface CombatPowerBreakdown {
  rawStrength: number;
  rawDefense: number;
  rawPower: number;
  balanceRatio: number;
  balanceStatus: string;
  balanceMultiplier: number;
  balancedPower: number;
  clanMilitaryBonus: number;
  discoveryBonus: number;
  specializationBonus: number;
  totalCombatMultiplier: number;
  finalCombatPower: number;
}

export async function calculateCombatPower(username: string): Promise<{ combatPower: number; breakdown: CombatPowerBreakdown }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('*').eq('username', username).single();
  if (!player) throw new Error(`Player not found: ${username}`);

  const totalStrength = player.total_strength ?? 0;
  const totalDefense = player.total_defense ?? 0;
  const rawPower = totalStrength + totalDefense;

  const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);
  const balancedPower = balanceEffects.effectivePower;

  let combatMultiplier = 1.0;

  let clanCombatBonus = 0;
  if (player.clan_id) {
    try {
      const { data: clan } = await supabase.from('clans').select('id, name').eq('id', player.clan_id).single();
      if (clan) {
        const bonuses = await getClanBonuses(clan.id);
        clanCombatBonus = ((bonuses.attack || 0) + (bonuses.defense || 0)) / 2;
      }
    } catch { /** clan research unavailable, skip */ }
  }
  combatMultiplier *= (1 + clanCombatBonus / 100);

  let discoveryCombatBonus = 0;
  try {
    const bonuses = await getDiscoveryBonuses(username);
    discoveryCombatBonus = ((bonuses.unitStrength as number) || 0) + ((bonuses.unitDefense as number) || 0) + ((bonuses.damageDealt as number) || 0) + ((bonuses.damageTakenReduction as number) || 0);
  } catch { /** discoveries unavailable, skip */ }
  combatMultiplier *= (1 + discoveryCombatBonus / 100);

  let specializationBonus = 0;
  if (player.spec_doctrine) {
    const d = player.spec_doctrine as string;
    if (d === 'offensive' || d === 'defensive') specializationBonus = 7.5;
    else if (d === 'tactical') specializationBonus = 10;
  }
  combatMultiplier *= (1 + specializationBonus / 100);

  const combatPower = Math.floor(balancedPower * combatMultiplier);

  return {
    combatPower,
    breakdown: {
      rawStrength: totalStrength, rawDefense: totalDefense, rawPower,
      balanceRatio: balanceEffects.ratio, balanceStatus: balanceEffects.status, balanceMultiplier: balanceEffects.powerMultiplier, balancedPower,
      clanMilitaryBonus: clanCombatBonus, discoveryBonus: discoveryCombatBonus, specializationBonus,
      totalCombatMultiplier: combatMultiplier, finalCombatPower: combatPower,
    },
  };
}

export async function calculateBatchCombatPower(usernames: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  for (const u of usernames) {
    try { results.set(u, (await calculateCombatPower(u)).combatPower); }
    catch { results.set(u, 0); }
  }
  return results;
}
