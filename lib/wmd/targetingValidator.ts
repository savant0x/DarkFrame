/**
 * @file lib/wmd/targetingValidator.ts
 * @created 2025-10-22
 * @overview WMD Targeting Validator - Range and Target Validation
 * 
 * OVERVIEW:
 * Validates missile targeting including range, eligibility, and restrictions.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { WarheadType } from '@/types/wmd';

export interface TargetingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate missile targeting
 */
export async function validateTargeting(
  launcherId: string,
  targetId: string,
  warheadType: WarheadType
): Promise<TargetingValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Self-targeting check
  if (launcherId === targetId) {
    errors.push('Cannot target yourself');
  }
  
  // Get target data
  const target = await getPlayerData(targetId);
  if (!target) {
    errors.push('Target not found');
    return { isValid: false, errors, warnings };
  }
  
  // Protection check
  if (target.protectionUntil && new Date(target.protectionUntil) > new Date()) {
    errors.push('Target is under protection');
  }
  
  // Level check
  if (target.level < 10) {
    errors.push('Target must be at least level 10');
  }
  
  // Clan check
  const launcher = await getPlayerData(launcherId);
  if (launcher && launcher.clan_id && launcher.clan_id === target.clan_id) {
    errors.push('Cannot attack own clan members');
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Get warhead maximum range
 */
export function getWarheadMaxRange(warheadType: WarheadType): number {
  const rangeMap: Partial<Record<WarheadType, number>> = {
    [WarheadType.TACTICAL]: 50,
    [WarheadType.STRATEGIC]: 150,
    [WarheadType.NEUTRON]: 100,
    [WarheadType.CLUSTER]: 75,
    [WarheadType.CLAN_BUSTER]: 500,
  };
  return rangeMap[warheadType] || 50;
}

/**
 * Get player data
 */
async function getPlayerData(playerId: string): Promise<any> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('username', playerId)
      .single();
    return data;
  } catch (error) {
    return null;
  }
}
