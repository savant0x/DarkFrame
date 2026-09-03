/**
 * @file lib/wmd/damageCalculator.ts
 * @created 2025-10-22
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview WMD Damage Calculator
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wmdDefenseBatteries } from '@/lib/db/schema/wmd';
import { WarheadType } from '@/types/wmd';

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

export async function calculateMissileDamage(
  warheadType: WarheadType,
  targetPlayerId: string,
  defensePenetration: number = 0
): Promise<{ baseDamage: number; finalDamage: number; defenseMitigation: number; splashRadius: number }> {
  const baseDamage = getWarheadBaseDamage(warheadType);
  const splashRadius = getWarheadSplashRadius(warheadType);
  const defenseStrength = await getDefenseStrength(targetPlayerId);
  const defenseMitigation = Math.min(0.8, defenseStrength / 1000) - defensePenetration;
  const finalMitigation = Math.max(0, defenseMitigation);
  const finalDamage = Math.floor(baseDamage * (1 - finalMitigation));
  return { baseDamage, finalDamage, defenseMitigation: Math.floor(baseDamage * finalMitigation), splashRadius };
}

async function getDefenseStrength(_playerId: string): Promise<number> {
  try {
    const batteries = await db.select().from(wmdDefenseBatteries).where(eq(wmdDefenseBatteries.status, 'OPERATIONAL'));
    let totalStrength = 0;
    for (const battery of batteries) {
      totalStrength += (Number(battery.interceptChance) || 50);
    }
    return totalStrength;
  } catch {
    return 0;
  }
}
