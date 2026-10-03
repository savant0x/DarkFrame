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

import { eq, desc, and, lte, isNotNull, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { TreasuryTx } from '@/lib/db/treasuryLock';
import { wmdDefenseBatteries, wmdInterceptions } from '@/lib/db/schema/wmd';
import { generateId } from '@/lib/utils'; // FID-20260919-017: 23-char PKs that fit varchar(24)
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
 * FID-20260919-017: the reader the interception log never had. defenderId is
 * the intercepting player.
 */
export async function getDefenderInterceptions(
  playerId: string,
  limit: number = 25
): Promise<Array<typeof wmdInterceptions.$inferSelect>> {
  try {
    return await db
      .select()
      .from(wmdInterceptions)
      .where(eq(wmdInterceptions.defenderId, playerId))
      .orderBy(desc(wmdInterceptions.timestamp))
      .limit(limit);
  } catch (error) {
    console.error('Error getting interception history:', error);
    return [];
  }
}

/**
 * FID-20261002-007 §5.4 — the ONE due-recovery predicate shared by the
 * scheduled completer and the lazy eligibility path: a battery returns to IDLE
 * when it is COOLDOWN and its persisted shot deadline has passed. Status/deadline
 * predicates make the transition idempotent and non-destructive: a paid-repair
 * (DAMAGED), upgrade or later shot can never be overwritten, and repeated
 * sweeps do not reset anything (COOLDOWN rows with a FUTURE deadline are
 * untouched). Returns the recovered battery ids.
 */
export function dueCooldownRecoveryPredicate(clanId?: string | null): SQL {
  const conditions = [
    eq(wmdDefenseBatteries.status, BatteryStatus.COOLDOWN),
    isNotNull(wmdDefenseBatteries.cooldownUntil),
    lte(wmdDefenseBatteries.cooldownUntil, sql`NOW()`),
  ];
  if (clanId) conditions.push(eq(wmdDefenseBatteries.clanId, clanId));
  return and(...conditions) as SQL;
}

/**
 * Transaction-aware core of §5.4: recover every due COOLDOWN battery (all
 * clans, or one clan) on the caller's transaction. Used by the missile-tracker
 * impact transaction (lazy eligibility) and wrapped by
 * `recoverDueCooldownBatteries` for non-tx callers.
 */
export async function recoverDueCooldownsTx(
  tx: TreasuryTx | typeof db,
  clanId?: string | null,
  now: Date = new Date()
): Promise<Array<{ id: string; batteryId: string }>> {
  const recovered = await tx
    .update(wmdDefenseBatteries)
    .set({ status: BatteryStatus.IDLE, cooldownUntil: null, updatedAt: now })
    .where(dueCooldownRecoveryPredicate(clanId))
    .returning({ id: wmdDefenseBatteries.id, batteryId: wmdDefenseBatteries.batteryId });
  return recovered;
}

/** Non-tx wrapper: due-recovery sweep for read/eligibility refresh paths. */
export async function recoverDueCooldownBatteries(
  clanId?: string | null,
  now: Date = new Date()
): Promise<Array<{ id: string; batteryId: string }>> {
  return recoverDueCooldownsTx(db, clanId, now);
}

/**
 * FID-20261002-007 §5.2 — the ONE battery-shot state transition both live
 * interception paths share: IDLE→COOLDOWN reserved CONDITIONALLY (the row must
 * still be IDLE under the lock — competing missiles cannot consume one idle
 * battery twice) and the deadline persisted as `now + cooldownDuration`
 * milliseconds. A failed reservation (zero updated rows) reports failure —
 * the caller cannot count a battery it did not actually consume.
 * The shot time and duration are caller-supplied so a transaction retry
 * replays the same reservation instead of extending it.
 */
export async function reserveBatteryShotTx(
  tx: TreasuryTx,
  batteryRowId: string,
  cooldownDurationMs: number,
  shotTime: Date,
  now: Date = new Date()
): Promise<boolean> {
  const reserved = await tx
    .update(wmdDefenseBatteries)
    .set({
      status: BatteryStatus.COOLDOWN,
      // The durable deadline: shot time + the battery's OWN configured duration.
      cooldownUntil: new Date(shotTime.getTime() + cooldownDurationMs),
      updatedAt: now,
    })
    .where(and(eq(wmdDefenseBatteries.id, batteryRowId), eq(wmdDefenseBatteries.status, BatteryStatus.IDLE)))
    .returning({ id: wmdDefenseBatteries.id });
  return reserved.length > 0;
}

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
 * Attempt missile interception (the defense POST path — the second live
 * writer, FID-20261002-007 R13).
 *
 * §5.4: due COOLDOWN batteries are recovered BEFORE selection, so the manual
 * path works even if the background scheduler is down (lazy eligibility).
 * §5.2: every shot goes through the shared conditional reservation
 * (`reserveBatteryShotTx`) — the battery must still be IDLE under the lock
 * and the deadline is persisted as now + the battery's own cooldownDuration.
 * A lost reservation (competing missile took the battery) does NOT count as a
 * shot and never reports a successful interception.
 */
export async function attemptInterception(
  missileId: string,
  defenderId: string
): Promise<{ success: boolean; result: InterceptionResult; message: string }> {
  try {
    // §5.4 lazy eligibility: recover due cooldowns before selecting batteries.
    await recoverDueCooldownBatteries(defenderId);

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
      // §5.2 shared transition: conditional IDLE→COOLDOWN with the persisted
      // deadline. A competing missile that consumed this battery first leaves
      // zero updated rows — skip to the next battery instead of double-firing.
      const reserved = await db.transaction((tx) =>
        reserveBatteryShotTx(tx, battery.id, battery.cooldownDuration ?? 0, new Date())
      );
      if (!reserved) continue;
      
      const success = Math.random() < parseFloat(battery.interceptChance ?? '0');
      
      if (success) {
        await db.insert(wmdInterceptions).values({
          // FID-20260919-017: varchar(24) PK — `wi_<ts>_<rand>` (26 chars)
          // overflowed it, so a SUCCESSFUL interception threw and the route
          // returned 500. generateId() is 23 chars.
          id: generateId(),
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
 *
 * FID-20261002-007 §5.4: the read refresh applies due recovery first —
 * idempotent (status/deadline predicates), never resets a future shot
 * deadline, so the panel sees recovered batteries even between scheduler runs.
 */
export async function getPlayerBatteries(
  ownerId: string
): Promise<Array<typeof wmdDefenseBatteries.$inferSelect>> {
  try {
    await recoverDueCooldownBatteries(ownerId);
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
