/**
 * @file lib/wmd/damageCalculator.ts
 * @created 2025-10-22
 * @overview WMD Damage Calculator - Warhead Damage Calculations
 * 
 * OVERVIEW:
 * Calculates missile damage for different warhead types. Production-ready
 * damage calculation logic with defense mitigation and splash effects.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { WarheadType } from '@/types/wmd';

/**
 * Calculate base damage for warhead type
 */
export function getWarheadBaseDamage(warheadType: WarheadType): number {
  const damageMap: Partial<Record<WarheadType, number>> = {
    [WarheadType.TACTICAL]: 50000,
    [WarheadType.STRATEGIC]: 250000,
    [WarheadType.NEUTRON]: 150000,
    [WarheadType.CLUSTER]: 100000,
    [WarheadType.CLAN_BUSTER]: 5000000,
  };
  return damageMap[warheadType] || 50000;
}

/**
 * Calculate splash radius
 */
export function getWarheadSplashRadius(warheadType: WarheadType): number {
  const radiusMap: Partial<Record<WarheadType, number>> = {
    [WarheadType.TACTICAL]: 1,
    [WarheadType.STRATEGIC]: 3,
    [WarheadType.NEUTRON]: 2,
    [WarheadType.CLUSTER]: 5,
    [WarheadType.CLAN_BUSTER]: 10,
  };
  return radiusMap[warheadType] || 1;
}

/**
 * Calculate total missile damage with defense mitigation
 */
export async function calculateMissileDamage(
  warheadType: WarheadType,
  targetPlayerId: string,
  defensePenetration: number = 0
): Promise<{
  baseDamage: number;
  finalDamage: number;
  defenseMitigation: number;
  splashRadius: number;
}> {
  const baseDamage = getWarheadBaseDamage(warheadType);
  const splashRadius = getWarheadSplashRadius(warheadType);
  
  const defenseStrength = await getDefenseStrength(targetPlayerId);
  const defenseMitigation = Math.min(0.8, defenseStrength / 1000) - defensePenetration;
  const finalMitigation = Math.max(0, defenseMitigation);
  
  const finalDamage = Math.floor(baseDamage * (1 - finalMitigation));
  
  return {
    baseDamage,
    finalDamage,
    defenseMitigation: Math.floor(baseDamage * finalMitigation),
    splashRadius,
  };
}

/**
 * Get player's total defense strength
 */
async function getDefenseStrength(playerId: string): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data: batteries } = await supabase
      .from('wmd_defense_batteries')
      .select('*')
      .eq('owner_id', playerId)
      .eq('status', 'active');
    
    if (!batteries) return 0;
    
    let totalStrength = 0;
    for (const battery of batteries) {
      totalStrength += (battery.interception_range || 50) * 1;
    }
    
    return totalStrength;
  } catch (error) {
    return 0;
  }
}
