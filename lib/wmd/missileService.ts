/**
 * @file lib/wmd/missileService.ts
 * @created 2025-10-22
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview WMD Missile Service - Clan Treasury Integrated
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { missiles } from '@/lib/db/schema/wmd';

/** The real shape stored in the `missiles` table. */
type MissileRow = typeof missiles.$inferSelect;

import {
  MissileStatus,
  WarheadType,
  WARHEAD_CONFIGS,
  MissileComponent,
  COMPONENT_COSTS,
} from '@/types/wmd';
import {
  validateClanWMDFunds,
  deductWMDCost,
  WMDPurchaseType,
} from './clanTreasuryWMDService';

export async function createMissile(
  playerId: string,
  playerUsername: string,
  clanId: string,
  warheadType: WarheadType
): Promise<{ success: boolean; message: string; missileId?: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const warheadConfig = WARHEAD_CONFIGS[warheadType];
    
    if (!warheadConfig) {
      return { success: false, message: 'Invalid warhead type' };
    }
    
    const initialCost = warheadConfig.cost;
    
    const validation = await validateClanWMDFunds(clanId, initialCost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    const deduction = await deductWMDCost(
      clanId,
      WMDPurchaseType.MISSILE_COMPONENT,
      playerId,
      playerUsername,
      initialCost,
      `${warheadType} Missile Creation`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    const missileId = `missile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const missile: typeof missiles.$inferInsert = {
      id: missileId,
      missileId: missileId,
      ownerId: playerId,
      ownerClanId: clanId,
      warheadType,
      status: MissileStatus.ASSEMBLING,
      componentsWarhead: 0,
      componentsPropulsion: 0,
      componentsGuidance: 0,
      componentsPayload: 0,
      componentsStealth: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.insert(missiles).values(missile);
    
    console.log(`Missile created by ${playerUsername} (Clan: ${clanId}). Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `${warheadType} missile created. Clan cost: ${initialCost.metal} metal, ${initialCost.energy} energy`,
      missileId,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error creating missile:', error);
    return { success: false, message: 'Failed to create missile' };
  }
}

export async function assembleComponent(
  missileId: string,
  component: MissileComponent,
  playerId: string,
  playerUsername: string
): Promise<{ success: boolean; message: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const missileResult = await db.select().from(missiles).where(eq(missiles.id, missileId)).limit(1);
    const missile = missileResult[0];
    
    if (!missile) {
      return { success: false, message: 'Missile not found' };
    }
    
    const componentMap: Record<MissileComponent, 'componentsWarhead' | 'componentsPropulsion' | 'componentsGuidance' | 'componentsPayload' | 'componentsStealth'> = {
      [MissileComponent.WARHEAD]: 'componentsWarhead',
      [MissileComponent.PROPULSION]: 'componentsPropulsion',
      [MissileComponent.GUIDANCE]: 'componentsGuidance',
      [MissileComponent.PAYLOAD]: 'componentsPayload',
      [MissileComponent.STEALTH]: 'componentsStealth',
    };
    
    const componentColumn = componentMap[component];
    if (missile[componentColumn]) {
      return { success: false, message: 'Component already assembled' };
    }
    
    const componentConfig = COMPONENT_COSTS[component];
    const warheadConfig = WARHEAD_CONFIGS[missile.warheadType as WarheadType];
    
    if (!warheadConfig) {
      return { success: false, message: 'Invalid warhead type' };
    }
    
    const componentCost = {
      metal: Math.floor(componentConfig.baseCost.metal * Math.pow(componentConfig.tierMultiplier, warheadConfig.tier - 1)),
      energy: Math.floor(componentConfig.baseCost.energy * Math.pow(componentConfig.tierMultiplier, warheadConfig.tier - 1)),
    };
    
    if (!missile.ownerClanId) {
      return { success: false, message: 'Missile has no owning clan' };
    }
    const validation = await validateClanWMDFunds(missile.ownerClanId, componentCost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    const deduction = await deductWMDCost(
      missile.ownerClanId,
      WMDPurchaseType.MISSILE_COMPONENT,
      playerId,
      playerUsername,
      componentCost,
      `${component} component for ${missile.warheadType} missile`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    await db.update(missiles).set({
      [componentColumn]: 1,
      updatedAt: new Date(),
    }).where(eq(missiles.id, missileId));
    
    const updatedResult = await db.select().from(missiles).where(eq(missiles.id, missileId)).limit(1);
    const updatedMissile = updatedResult[0];
    if (updatedMissile) {
      const allReady = 
        updatedMissile.componentsWarhead === 1 &&
        updatedMissile.componentsPropulsion === 1 &&
        updatedMissile.componentsGuidance === 1 &&
        updatedMissile.componentsPayload === 1 &&
        updatedMissile.componentsStealth === 1;
      
      if (allReady) {
        await db.update(missiles).set({
          status: MissileStatus.READY,
          completedAt: new Date(),
        }).where(eq(missiles.id, missileId));
      }
    }
    
    console.log(`Component ${component} assembled by ${playerUsername}. Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `${component} component assembled. Clan cost: ${componentCost.metal} metal, ${componentCost.energy} energy`,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error assembling component:', error);
    return { success: false, message: 'Failed to assemble component' };
  }
}

export async function launchMissile(
  missileId: string,
  targetId: string,
  launchedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    const missileResult = await db.select().from(missiles).where(eq(missiles.id, missileId)).limit(1);
    const missile = missileResult[0];
    
    if (!missile) {
      return { success: false, message: 'Missile not found' };
    }
    
    if (missile.status !== MissileStatus.READY) {
      return { success: false, message: 'Missile not ready for launch' };
    }
    
    const warheadConfig = WARHEAD_CONFIGS[missile.warheadType as WarheadType];
    const flightTime = warheadConfig.flightTime;
    const impactAt = new Date(Date.now() + flightTime);
    
    await db.update(missiles).set({
      status: MissileStatus.LAUNCHED,
      targetId,
      launchedBy,
      launchedAt: new Date(),
      impactAt,
      flightTime,
      updatedAt: new Date(),
    }).where(eq(missiles.id, missileId));
    
    return {
      success: true,
      message: `Missile launched. Impact in ${Math.floor(flightTime / 1000 / 60)} minutes`,
    };
  } catch (error) {
    console.error('Error launching missile:', error);
    return { success: false, message: 'Failed to launch missile' };
  }
}

export async function getPlayerMissiles(ownerId: string): Promise<MissileRow[]> {
  try {
    return await db.select().from(missiles).where(eq(missiles.ownerId, ownerId)).orderBy(desc(missiles.createdAt));
  } catch (error) {
    console.error('Error fetching missiles:', error);
    return [];
  }
}

export async function dismantleMissile(missileId: string): Promise<{ success: boolean; message: string }> {
  try {
    const existing = await db.select().from(missiles).where(eq(missiles.id, missileId)).limit(1);
    if (existing.length === 0) {
      return { success: false, message: 'Missile not found' };
    }
    
    await db.delete(missiles).where(eq(missiles.id, missileId));
    
    return {
      success: true,
      message: 'Missile dismantled',
    };
  } catch (error) {
    console.error('Error dismantling missile:', error);
    return { success: false, message: 'Failed to dismantle missile' };
  }
}
