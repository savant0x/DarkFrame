/**
 * @file lib/wmd/targetingValidator.ts
 * @created 2025-10-22
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview WMD Targeting Validator
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema/players';
import { WarheadType } from '@/types/wmd';

export interface TargetingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateTargeting(
  launcherId: string,
  targetId: string,
  _warheadType: WarheadType
): Promise<TargetingValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (launcherId === targetId) {
    errors.push('Cannot target yourself');
  }
  
  const target = await getPlayerData(targetId);
  if (!target) {
    errors.push('Target not found');
    return { isValid: false, errors, warnings };
  }
  
  if (target.protectionUntil && new Date(target.protectionUntil) > new Date()) {
    errors.push('Target is under protection');
  }
  
  if (target.level < 10) {
    errors.push('Target must be at least level 10');
  }
  
  const launcher = await getPlayerData(launcherId);
  if (launcher && launcher.clanId && launcher.clanId === target.clanId) {
    errors.push('Cannot attack own clan members');
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}

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

/** The real shape stored in the `players` table. */
type PlayerRow = typeof players.$inferSelect;

async function getPlayerData(playerId: string): Promise<PlayerRow | null> {
  try {
    const result = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    return result[0] || null;
  } catch {
    return null;
  }
}
