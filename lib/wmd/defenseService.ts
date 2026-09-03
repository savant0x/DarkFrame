/**
 * @file lib/wmd/defenseService.ts
 * @created 2025-10-22
 * @overview WMD Defense Service - Clan Treasury Integrated
 * 
 * OVERVIEW:
 * Handles defense battery deployment and interception mechanics.
 * ALL costs deducted from CLAN TREASURY with equal cost sharing among members.
 * 
 * Features:
 * - Battery deployment via clan bank funding
 * - Battery repairs funded by clan treasury
 * - Interception attempts
 * - Defense status tracking
 * 
 * Clan Treasury Integration:
 * - All battery purchases deducted from clan bank (NOT player resources)
 * - Repair costs paid from clan treasury
 * - Per-member cost calculated: totalCost / memberCount
 * - Minimum 3 clan members required (prevents solo WMD)
 * - Transaction transparency (shows per-member contribution)
 * 
 * Dependencies:
 * - /types/wmd for defense types
 * - clanTreasuryWMDService for funding validation/deduction
 * - Drizzle ORM for persistence
 */

import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wmdDefenseBatteries, wmdInterceptions } from '@/lib/db/schema/wmd';
import {
  BatteryType,
  BatteryStatus,
  InterceptionResult,
  BATTERY_CONFIGS,
} from '@/types/wmd';
import {
  validateClanWMDFunds,
  deductWMDCost,
  WMDPurchaseType,
} from './clanTreasuryWMDService';

/**
 * Deploy a defense battery (clan treasury funded)
 */
export async function deployBattery(
  playerId: string,
  playerUsername: string,
  clanId: string,
  batteryType: BatteryType
): Promise<{ success: boolean; message: string; batteryId?: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const batteryConfig = BATTERY_CONFIGS[batteryType];
    
    if (!batteryConfig) {
      return { success: false, message: 'Invalid battery type' };
    }
    
    const validation = await validateClanWMDFunds(clanId, batteryConfig.cost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    const deduction = await deductWMDCost(
      clanId,
      WMDPurchaseType.DEFENSE_BATTERY,
      playerId,
      playerUsername,
      batteryConfig.cost,
      `${batteryType} Defense Battery Deployment`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    const batteryId = `battery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const battery: typeof wmdDefenseBatteries.$inferInsert = {
      id: `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clanId,
      batteryId,
      status: BatteryStatus.IDLE,
      interceptChance: String(batteryConfig.interceptChance),
      cooldownDuration: batteryConfig.cooldownDuration,
      builtAt: new Date(),
      updatedAt: new Date(),
      repairCompletesAt: null,
    };
    
    await db.insert(wmdDefenseBatteries).values(battery);
    
    console.log(`Battery deployed by ${playerUsername} (Clan: ${clanId}). Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `${batteryType} battery deployed. Clan cost: ${batteryConfig.cost.metal} metal, ${batteryConfig.cost.energy} energy`,
      batteryId,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error deploying battery:', error);
    return { success: false, message: 'Failed to deploy battery' };
  }
}

/**
 * Attempt missile interception
 */
export async function attemptInterception(
  missileId: string,
  defenderId: string
): Promise<{ success: boolean; result: InterceptionResult; message: string }> {
  try {
    const batteriesResult = await db.select()
      .from(wmdDefenseBatteries)
      .where(and(
        eq(wmdDefenseBatteries.clanId, defenderId),
        eq(wmdDefenseBatteries.status, BatteryStatus.IDLE)
      ));
    
    const batteries = batteriesResult.filter(b => {
      const interceptNum = parseFloat(b.interceptChance as string);
      return interceptNum > 0;
    });
    
    if (batteries.length === 0) {
      return {
        success: false,
        result: InterceptionResult.FAILURE,
        message: 'No active defenses available',
      };
    }
    
    for (const battery of batteries) {
      const success = Math.random() < parseFloat(battery.interceptChance ?? '0');
      
      await db.update(wmdDefenseBatteries).set({
        status: BatteryStatus.COOLDOWN,
        updatedAt: new Date(),
      }).where(eq(wmdDefenseBatteries.id, battery.id));
      
      if (success) {
        await db.insert(wmdInterceptions).values({
          id: `wi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          interceptionId: `intercept_${Date.now()}`,
          missileId,
          defenderId,
          batteryId: battery.batteryId,
          result: InterceptionResult.SUCCESS,
          timestamp: new Date(),
        });
        
        return {
          success: true,
          result: InterceptionResult.SUCCESS,
          message: 'Missile intercepted!',
        };
      }
    }
    
    return {
      success: false,
      result: InterceptionResult.FAILURE,
      message: 'All interception attempts failed',
    };
  } catch (error) {
    console.error('Error attempting interception:', error);
    return {
      success: false,
      result: InterceptionResult.MALFUNCTION,
      message: 'Interception system malfunction',
    };
  }
}

/**
 * Get player's defense batteries
 */
export async function getPlayerBatteries(
  ownerId: string
): Promise<Array<typeof wmdDefenseBatteries.$inferSelect>> {
  try {
    const result = await db.select()
      .from(wmdDefenseBatteries)
      .where(eq(wmdDefenseBatteries.clanId, ownerId))
      .orderBy(desc(wmdDefenseBatteries.builtAt));
    return result;
  } catch (error) {
    console.error('Error fetching batteries:', error);
    return [];
  }
}

/**
 * Repair battery (clan treasury funded)
 */
export async function repairBattery(
  batteryId: string,
  playerId: string,
  playerUsername: string
): Promise<{ success: boolean; message: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const batteryResult = await db.select()
      .from(wmdDefenseBatteries)
      .where(eq(wmdDefenseBatteries.batteryId, batteryId))
      .limit(1);
    
    const battery = batteryResult[0];
    
    if (!battery) {
      return { success: false, message: 'Battery not found' };
    }
    
    const batteryConfig = BATTERY_CONFIGS['Patriot' as BatteryType];
    const defaultCost = batteryConfig?.cost || { metal: 100000, energy: 200000 };
    const damagePercent = 0.5;
    const repairCost = {
      metal: Math.floor(defaultCost.metal * damagePercent * 0.5),
      energy: Math.floor(defaultCost.energy * damagePercent * 0.5),
    };
    
    const validation = await validateClanWMDFunds(battery.clanId, repairCost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    const deduction = await deductWMDCost(
      battery.clanId,
      WMDPurchaseType.DEFENSE_BATTERY,
      playerId,
      playerUsername,
      repairCost,
      `Battery Repair`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    const repairCompletesAt = new Date(Date.now() + 30 * 60 * 1000);
    
    await db.update(wmdDefenseBatteries).set({
      status: BatteryStatus.DAMAGED,
      repairCompletesAt,
      updatedAt: new Date(),
    }).where(eq(wmdDefenseBatteries.batteryId, batteryId));
    
    console.log(`Battery repair started by ${playerUsername}. Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `Battery repair initiated. Clan cost: ${repairCost.metal} metal, ${repairCost.energy} energy`,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error repairing battery:', error);
    return { success: false, message: 'Failed to repair battery' };
  }
}

/**
 * Dismantle battery
 */
export async function dismantleBattery(
  batteryId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const existing = await db.select().from(wmdDefenseBatteries).where(eq(wmdDefenseBatteries.batteryId, batteryId)).limit(1);
    if (existing.length === 0) {
      return { success: false, message: 'Battery not found' };
    }
    
    await db.delete(wmdDefenseBatteries)
      .where(eq(wmdDefenseBatteries.batteryId, batteryId));
    
    return {
      success: true,
      message: 'Battery dismantled',
    };
  } catch (error) {
    console.error('Error dismantling battery:', error);
    return { success: false, message: 'Failed to dismantle battery' };
  }
}
