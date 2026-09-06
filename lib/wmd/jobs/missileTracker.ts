/**
 * @file lib/wmd/jobs/missileTracker.ts
 * @created 2025-10-22
 * @updated 2026-09-06 (FID-20260906-002 G4-G6) — real damage engine, target fix, lazy tick
 * @overview Missile Flight Tracker Background Job
 *
 * OVERVIEW:
 * Processes in-flight missiles whose impactAt has passed: attempts defense
 * interception via the TARGET clan's batteries, applies doc-faithful damage
 * (design doc §160-176: units/factories/resources with 5% crit), records
 * notifications + admin alerts, and broadcasts real-time results.
 *
 * GREEN design notes (FID-20260906-002):
 * - G5: damage and interception use missile.targetId (the launch route persists
 *   the target username). The old code passed missile.ownerClanId — the missile
 *   would have "hit" the attacker's own clan.
 * - W9: batteries use the IDLE/COOLDOWN/DAMAGED vocabulary written by
 *   defenseService; interception consumes IDLE batteries and sets COOLDOWN.
 * - G4: damage follows the design doc distribution — 70% units, 20% factories,
 *   10% resources, 5% crit doubles all percentages.
 * - G6: `processDueMissiles()` is the framework-free core; the server-side
 *   scheduler keeps its interval, and WMD routes call `ensureWmdJobsTicked()`
 *   so impacts fire even where server.ts never runs (Vercel).
 *
 * Dependencies: Drizzle ORM, WebSocket handlers, notificationService
 */

import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  missiles,
  wmdDefenseBatteries,
  wmdAdminAlerts,
} from '@/lib/db/schema/wmd';
import { players } from '@/lib/db/schema/players';
import { factories } from '@/lib/db/schema/factories';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';
import { WARHEAD_CONFIGS, isValidWarheadType, type WarheadType } from '@/types/wmd';
import {
  WMDEventType,
  NotificationPriority,
  NotificationScope,
} from '@/types/wmd';
import { createWMDNotification } from '@/lib/wmd/notificationService';
import { generateId } from '@/lib/utils';
import type { MissileDamageRecord } from '@/types/wmd';

type Database = typeof db;

/** Doc §160-176 distribution: share of destructive effect per damage class. */
const DAMAGE_SHARE = { units: 0.7, factories: 0.2, resources: 0.1 } as const;
/** Doc: 5% critical hit doubles all damage percentages. */
const CRIT_CHANCE = 0.05;
const CRIT_MULTIPLIER = 2;

function calculateDamagePercent(warheadType: WarheadType): number {
  const config = WARHEAD_CONFIGS[warheadType];
  if (!config) return 0;

  const baseDamagePercent = config.damage.primaryPercent;
  const randomFactor = 0.95 + Math.random() * 0.1;

  return Math.floor(baseDamagePercent * randomFactor);
}

/**
 * G5: interception consults the TARGET clan's IDLE batteries (the vocabulary
 * defenseService actually writes — nothing ever wrote 'OPERATIONAL').
 */
async function attemptInterception(
  _db: Database,
  targetClanId: string | null,
  missileWarhead: WarheadType
): Promise<{ intercepted: boolean; batteryId?: string }> {
  if (!targetClanId) return { intercepted: false };

  const batteries = await db
    .select()
    .from(wmdDefenseBatteries)
    .where(and(
      eq(wmdDefenseBatteries.clanId, targetClanId),
      eq(wmdDefenseBatteries.status, 'IDLE'),
    ));

  if (batteries.length === 0) {
    return { intercepted: false };
  }

  let totalChance = 0;
  for (const battery of batteries) {
    totalChance += Number(battery.interceptChance) || 0;
  }

  // Warhead stealth reduces effective interception (doc: intercept difficulty).
  const difficulty = WARHEAD_CONFIGS[missileWarhead]?.interceptDifficulty ?? 0;
  totalChance = Math.min(Math.max(0, totalChance - difficulty), 0.95);

  const roll = Math.random();

  if (roll < totalChance) {
    // The first battery takes the shot and enters cooldown (W9 vocabulary).
    const battery = batteries[0];
    const now = new Date();
    await db
      .update(wmdDefenseBatteries)
      .set({ status: 'COOLDOWN', updatedAt: now })
      .where(eq(wmdDefenseBatteries.id, battery.id));

    return { intercepted: true, batteryId: battery.batteryId };
  }

  return { intercepted: false };
}

/**
 * G4: the real damage engine. Distribution per design doc §160-176:
 *   70% → target's units (proportion of the warhead's primary percent)
 *   20% → factories (production damage, recorded via lastAttackedBy)
 *   10% → resources (share of the primary percent of current stock)
 * 5% crit doubles every percentage.
 */
async function applyDamage(
  _db: Database,
  targetId: string,
  damagePercent: number
): Promise<MissileDamageRecord> {
  const now = new Date();
  const crit = Math.random() < CRIT_CHANCE;
  const effect = crit ? damagePercent * CRIT_MULTIPLIER : damagePercent;

  const unitsShare = effect * DAMAGE_SHARE.units;         // % of units destroyed
  const factoryShare = effect * DAMAGE_SHARE.factories;   // production-damage intensity
  const resourceShare = effect * DAMAGE_SHARE.resources;  // % of stock destroyed

  const targetRows = await db.select().from(players).where(eq(players.username, targetId)).limit(1);
  const target = targetRows[0];
  if (!target) {
    return { unitsDestroyed: 0, factoriesDamaged: 0, resourcesLost: { metal: 0, energy: 0 } };
  }

  // --- Units (70%): destroy unitsShare% of each stack (floor), keeping stacks
  // alive at remainder >= 1. Unit stacks carry `quantity` (battleService reads
  // the same field), so a stack's survivors keep their identity.
  const unitStacks = Array.isArray(target.units) ? [...target.units] : [];
  let unitsDestroyed = 0;
  if (unitStacks.length > 0 && unitsShare > 0) {
    const destroyedFraction = unitsShare / 100;
    const surviving = [];
    for (const stack of unitStacks) {
      const size = Number(stack.quantity ?? 0);
      if (size <= 0) continue;
      const destroyed = Math.min(size, Math.floor(size * destroyedFraction));
      const remaining = size - destroyed;
      unitsDestroyed += destroyed;
      if (remaining > 0) {
        surviving.push({ ...stack, quantity: remaining });
      }
    }
    await db
      .update(players)
      .set({ units: surviving })
      .where(eq(players.username, targetId));
  }

  // --- Factories (20%): damage up to 3 target factories; production resumes via
  // lastSlotRegen — recorded with attacker stamp for forensics (doc: 24-72h
  // downtime is handled by the production regen cycle, not a new job here).
  const factoryRows = await db
    .select()
    .from(factories)
    .where(eq(factories.owner, targetId))
    .limit(3);
  let factoriesDamaged = 0;
  for (const factory of factoryRows) {
    const reduction = Math.min(
      Number(factory.productionRate),
      Math.max(1, Math.floor((Number(factory.productionRate) * factoryShare) / 100))
    );
    await db
      .update(factories)
      .set({
        productionRate: String(Math.max(0, Number(factory.productionRate) - reduction)),
        lastAttackedBy: targetId,
        lastAttackTime: now,
      })
      .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));
    factoriesDamaged += 1;
  }

  // --- Resources (10%): destroy resourceShare% of current (unbanked) stock.
  const metalLost = Math.floor((target.resourcesMetal || 0) * resourceShare / 100);
  const energyLost = Math.floor((target.resourcesEnergy || 0) * resourceShare / 100);
  if (metalLost > 0 || energyLost > 0) {
    await db
      .update(players)
      .set({
        resourcesMetal: Math.max(0, (target.resourcesMetal || 0) - metalLost),
        resourcesEnergy: Math.max(0, (target.resourcesEnergy || 0) - energyLost),
      })
      .where(eq(players.username, targetId));
  }

  return {
    unitsDestroyed,
    factoriesDamaged,
    resourcesLost: { metal: metalLost, energy: energyLost },
  };
}

/** S5: every launch leaves an admin-alert trail for the admin panel. */
async function recordAdminAlert(
  missileId: string,
  launcherId: string,
  targetId: string,
  warheadType: WarheadType,
  damage: MissileDamageRecord | null,
  intercepted: boolean
): Promise<void> {
  await db.insert(wmdAdminAlerts).values({
    id: generateId(),
    type: 'MISSILE_LAUNCH',
    severity: intercepted ? 'MEDIUM' : 'HIGH',
    status: 'OPEN',
    title: `WMD launch: ${warheadType} → ${targetId}`,
    message: intercepted
      ? `Missile ${missileId} launched by ${launcherId} was intercepted by ${targetId}'s defenses.`
      : `Missile ${missileId} launched by ${launcherId} detonated on ${targetId}.`,
    details: { missileId, launcherId, targetId, warheadType, intercepted, damage },
    createdAt: new Date(),
  });
}

/**
 * Framework-free core: process every missile whose impact time has passed.
 * Returns the number of missiles handled.
 */
export async function processDueMissiles(): Promise<number> {
  const io = getIO();
  const now = new Date();

  const readyMissiles = await db
    .select()
    .from(missiles)
    .where(and(eq(missiles.status, 'LAUNCHED'), lte(missiles.impactAt, now)));

  if (readyMissiles.length === 0) {
    return 0;
  }

  for (const missile of readyMissiles) {
    try {
      if (!missile.targetId) {
        console.warn(`[WMD Jobs] Missile ${missile.id} has no target; marking detonated with zero damage`);
        await db
          .update(missiles)
          .set({ status: 'DETONATED', completedAt: now, updatedAt: now })
          .where(eq(missiles.id, missile.id));
        continue;
      }
      if (!missile.warheadType || !isValidWarheadType(missile.warheadType)) {
        console.warn(`[WMD Jobs] Missile ${missile.id} has an invalid warhead type; skipping`);
        continue;
      }
      const warhead = missile.warheadType as WarheadType;

      // Target identity: players are username-keyed; the target's clan owns the
      // batteries that attempt interception.
      const targetRows = await db
        .select({ username: players.username, clanId: players.clanId })
        .from(players)
        .where(eq(players.username, missile.targetId))
        .limit(1);
      const target = targetRows[0];

      const targetClanId = target?.clanId ?? null;
      const interceptionResult = await attemptInterception(db, targetClanId, warhead);

      if (interceptionResult.intercepted) {
        await db
          .update(missiles)
          .set({
            status: 'INTERCEPTED',
            interceptedAt: now,
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(missiles.id, missile.id));

        await createWMDNotification(
          WMDEventType.MISSILE_INTERCEPTED,
          NotificationPriority.HIGH,
          NotificationScope.TARGETED,
          missile.ownerId,
          missile.launchedBy ?? missile.ownerId,
          '🛡️ Missile Intercepted',
          `A ${warhead} missile targeting ${target?.username ?? missile.targetId} was intercepted by clan defenses.`,
          { missileId: missile.missileId, warheadType: warhead },
          target?.username ?? missile.targetId,
          target?.username ?? missile.targetId
        );
        await recordAdminAlert(missile.missileId, missile.ownerId, missile.targetId, warhead, null, true);

        if (io) {
          await wmdHandlers.broadcastMissileImpact(io, {
            intercepted: true,
            missileId: missile.missileId,
            launcherId: missile.ownerId,
            launcherName: missile.launchedBy ?? missile.ownerId,
            targetId: missile.targetId,
            targetName: target?.username ?? missile.targetId,
            warheadType: warhead,
            interceptedBy: 'Clan Defense Battery',
            damageDealt: 0,
          });
        }

        console.log(`[WMD Jobs] Missile ${missile.id} intercepted by ${missile.targetId}'s clan`);
        continue;
      }

      // Detonation: real damage against the TARGET (G5), doc-faithful split (G4).
      const damagePercent = calculateDamagePercent(warhead);
      const damageResult = await applyDamage(db, missile.targetId, damagePercent);

      const damageRecord: MissileDamageRecord = {
        unitsDestroyed: damageResult.unitsDestroyed,
        factoriesDamaged: damageResult.factoriesDamaged,
        resourcesLost: damageResult.resourcesLost,
      };

      await db
        .update(missiles)
        .set({
          status: 'DETONATED',
          damageDealt: damageRecord,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(missiles.id, missile.id));

      await createWMDNotification(
        WMDEventType.MISSILE_IMPACTED,
        NotificationPriority.CRITICAL,
        'TARGETED' as never,
        missile.ownerId,
        missile.launchedBy ?? missile.ownerId,
        '💥 Nuclear Impact',
        `A ${warhead} missile from ${missile.launchedBy ?? missile.ownerId} detonated on ${target?.username ?? missile.targetId}: ${damageResult.unitsDestroyed} units destroyed, ${damageResult.factoriesDamaged} factories damaged.`,
        {
          missileId: missile.missileId,
          warheadType: warhead,
          unitsDestroyed: damageResult.unitsDestroyed,
          factoriesDamaged: damageResult.factoriesDamaged,
          metalLost: damageResult.resourcesLost.metal,
          energyLost: damageResult.resourcesLost.energy,
        },
        target?.username ?? missile.targetId,
        target?.username ?? missile.targetId
      );
      await recordAdminAlert(missile.missileId, missile.ownerId, missile.targetId, warhead, damageResult, false);

      if (io) {
        await wmdHandlers.broadcastMissileImpact(io, {
          intercepted: false,
          missileId: missile.missileId,
          launcherId: missile.ownerId,
          launcherName: missile.launchedBy ?? missile.ownerId,
          targetId: missile.targetId,
          targetName: target?.username ?? missile.targetId,
          warheadType: warhead,
          damageDealt: damageResult.unitsDestroyed,
        });
      }

      console.log(
        `[WMD Jobs] Missile ${missile.id} detonated on ${missile.targetId}: ` +
        `${damageResult.unitsDestroyed} units, ${damageResult.factoriesDamaged} factories, ` +
        `${damageResult.resourcesLost.metal}/${damageResult.resourcesLost.energy} resources`
      );
    } catch (missileError) {
      console.error(`[WMD Jobs] Error processing missile ${missile.id}:`, missileError);
    }
  }

  return readyMissiles.length;
}

/** Scheduler entrypoint (server.ts process). */
export async function missileTracker(): Promise<void> {
  try {
    const handled = await processDueMissiles();
    if (handled === 0) {
      console.log('[WMD Jobs] No missiles ready for impact');
    }
  } catch (error) {
    console.error('[WMD Jobs] Error in missile tracker:', error);
  }
}

// ---------------------------------------------------------------------------
// G6: lazy self-tick — WMD routes call ensureWmdJobsTicked() so impacts fire
// even in environments where server.ts (and its intervals) never run.
// ---------------------------------------------------------------------------

const TICK_INTERVAL_MS = 10_000;
const TICK_RETRY_MS = 3_000;
let lastTickAt = 0;
let tickInFlight: Promise<number> | null = null;

export async function ensureWmdJobsTicked(): Promise<void> {
  const now = Date.now();
  if (now - lastTickAt < TICK_INTERVAL_MS) return;
  if (tickInFlight) return;

  // Only commit the backoff timestamp on SUCCESS: a failed tick (e.g. transient
  // pool contention) retries after TICK_RETRY_MS instead of sleeping the full
  // interval with impact processing stalled.
  lastTickAt = now;
  tickInFlight = processDueMissiles()
    .then((handled) => {
      lastTickAt = Date.now();
      return handled;
    })
    .catch((error) => {
      console.error('[WMD Jobs] Lazy tick failed, will retry:', error);
      lastTickAt = Date.now() - TICK_INTERVAL_MS + TICK_RETRY_MS;
      return 0;
    })
    .finally(() => {
      tickInFlight = null;
    });
}
