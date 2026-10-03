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

import { and, eq, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { withTransactionRetry, type TreasuryTx } from '@/lib/db/treasuryLock'; // FID-20261002-006 §5.4
import { calculatePlayerUnitStats } from '@/lib/armyService'; // FID-20261002-006 §5.3 (004 shared reducer)
import { recoverDueCooldownsTx, reserveBatteryShotTx } from '@/lib/wmd/defenseService'; // FID-20261002-007 §5.2/§5.4 (ONE battery state machine)
import type { PlayerUnit } from '@/types/game.types';
import {
  missiles,
  wmdDefenseBatteries,
  wmdAlerts,
} from '@/lib/db/schema/wmd';
import { AlertSeverity, AlertStatus, AlertType, type WmdAlertData } from '@/lib/wmd/admin/alert.types';
import { players } from '@/lib/db/schema/players';
import { clans } from '@/lib/db/schema/clans'; // FID-20260919-018: consequence clan names
import { factories } from '@/lib/db/schema/factories';
import { applyClanWMDConsequences } from '@/lib/wmd/clanConsequencesService'; // FID-20260919-018
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';
import { WARHEAD_CONFIGS, isValidWarheadType, type WarheadType } from '@/types/wmd';
import {
  WMDEventType,
  NotificationPriority,
  NotificationScope,
} from '@/types/wmd';
import { createWMDNotification } from '@/lib/wmd/notificationService';
import { notifyPlayer } from '@/lib/playerNotification';
import { generateId } from '@/lib/utils';
import { shouldRecordAlert } from '@/lib/wmd/admin/alertConfigService';
import type { MissileDamageRecord } from '@/types/wmd';

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
 * FID-20261002-006 §5.2: a target army with corrupt quantities/stats is an
 * INTEGRITY FAILURE, never silently dropped assets. The impact transaction
 * throws this before any write; the tracker records the failure explicitly
 * (admin alert + terminal zero-damage detonation) instead of guessing losses.
 */
export class ArmyIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArmyIntegrityError';
  }
}

/**
 * FID-20261002-006 §5.1 — representation-independent proportional unit losses.
 *
 * The old engine floored `quantity × fraction` PER STACK, so a 100-singleton
 * army lost zero units where one 100-stack lost 17 — destruction depended on
 * how the same army happened to be represented. Now:
 *
 *  1. `destroyedFraction` is normalized to [0, 1] AFTER the critical/share
 *     calculation (over-100% crits total the army, never corrupt it).
 *  2. Equivalent units are grouped by canonical type AND per-copy stats
 *     (unitId/unitType/name/category/rarity/strength/defense) — different-stat
 *     variants stay distinct groups, so tier composition keeps its weighting.
 *  3. `floor(group total × fraction)` is computed ONCE per group, then the
 *     removals are distributed across the group's entries in stable instance
 *     (array) order — splitting, merging or reordering equivalent stacks
 *     cannot alter deaths or total surviving power.
 *  4. Surviving entries keep their instance identity, metadata and positive
 *     integral quantities; zero-quantity entries are removed.
 *
 * Pure over its inputs; every write happens in the caller's transaction.
 * Production caller: applyDamageTx (the processDueMissiles impact path).
 */
export function applyProportionalUnitLosses(
  units: PlayerUnit[],
  destroyedFractionRaw: number
): { survivors: PlayerUnit[]; destroyed: number } {
  if (!Number.isFinite(destroyedFractionRaw)) {
    throw new ArmyIntegrityError(`destroyedFraction must be finite (got ${String(destroyedFractionRaw)})`);
  }
  const destroyedFraction = Math.min(Math.max(destroyedFractionRaw, 0), 1);

  // Validate EVERY entry through the domain boundary BEFORE any planning —
  // corrupt arrays fail explicitly, they are not quietly skipped.
  for (const entry of units) {
    const q = Number(entry.quantity);
    if (!Number.isFinite(q) || !Number.isInteger(q) || q <= 0) {
      throw new ArmyIntegrityError(
        `Unit entry ${String(entry.id ?? entry.unitId)} has corrupt quantity ${String(entry.quantity)}`
      );
    }
    if (!Number.isFinite(Number(entry.strength)) || !Number.isFinite(Number(entry.defense))) {
      throw new ArmyIntegrityError(
        `Unit entry ${String(entry.id ?? entry.unitId)} has corrupt per-copy stats (${String(entry.strength)}/${String(entry.defense)})`
      );
    }
  }

  if (destroyedFraction === 0 || units.length === 0) {
    return { survivors: [...units], destroyed: 0 };
  }

  // Group equivalent units by canonical type AND per-copy stats.
  const groups = new Map<string, { total: number; indices: number[] }>();
  units.forEach((entry, index) => {
    const key = [
      entry.unitId,
      entry.unitType,
      entry.name,
      entry.category,
      entry.rarity,
      entry.strength,
      entry.defense,
    ].join('\u0000');
    const group = groups.get(key);
    if (group) {
      group.total += entry.quantity;
      group.indices.push(index);
    } else {
      groups.set(key, { total: entry.quantity, indices: [index] });
    }
  });

  const survivors = units.map((entry) => ({ ...entry }));
  let destroyed = 0;
  for (const group of groups.values()) {
    // ONE floor per equivalent-stat group — the representation fix (R11).
    let remaining = Math.floor(group.total * destroyedFraction);
    destroyed += remaining;
    // Stable instance ordering: the group's original array order.
    for (const index of group.indices) {
      if (remaining <= 0) break;
      const take = Math.min(survivors[index].quantity, remaining);
      survivors[index] = { ...survivors[index], quantity: survivors[index].quantity - take };
      remaining -= take;
    }
  }

  return { survivors: survivors.filter((entry) => entry.quantity > 0), destroyed };
}

/**
 * G5: interception consults the TARGET clan's IDLE batteries (the vocabulary
 * defenseService actually writes — nothing ever wrote 'OPERATIONAL').
 *
 * FID-20261002-007 §5.2/§5.4: TRANSACTION-AWARE and driven by defenseService's
 * ONE shared battery state machine — due COOLDOWN rows are recovered BEFORE
 * selection (lazy eligibility: the feature works even if the background
 * scheduler is down), and a successful shot reserves the battery through the
 * shared conditional reservation (`reserveBatteryShotTx`), persisting the
 * durable deadline `now + cooldownDuration` milliseconds. A failed reservation
 * (a competing missile consumed the battery first) CANNOT report a successful
 * interception. Batteries are FOR UPDATE-locked, so competing missiles cannot
 * consume one idle battery twice. Runs INSIDE the caller's missile/interception
 * transaction: an interception and its battery cooldown commit (or roll back)
 * together with the missile claim.
 */
async function attemptInterceptionTx(
  tx: TreasuryTx,
  targetClanId: string | null,
  missileWarhead: WarheadType,
  now: Date
): Promise<{ intercepted: boolean; batteryId?: string }> {
  if (!targetClanId) return { intercepted: false };

  // §5.4 lazy eligibility: due cooldowns recover inside this transaction.
  await recoverDueCooldownsTx(tx, targetClanId, now);

  const batteries = await tx
    .select()
    .from(wmdDefenseBatteries)
    .where(and(
      eq(wmdDefenseBatteries.clanId, targetClanId),
      eq(wmdDefenseBatteries.status, 'IDLE'),
    ))
    .for('update');

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
    // The first battery takes the shot. §5.2: the shared conditional
    // reservation persists the shot deadline; zero updated rows (a competing
    // missile consumed it first) refuse the interception rather than claim it.
    const battery = batteries[0];
    const reserved = await reserveBatteryShotTx(
      tx,
      battery.id,
      battery.cooldownDuration ?? 0,
      now,
      now
    );
    if (!reserved) {
      console.warn(`[WMD Jobs] Battery ${battery.batteryId} reservation lost — no interception recorded`);
      return { intercepted: false };
    }

    return { intercepted: true, batteryId: battery.batteryId };
  }

  return { intercepted: false };
}

/**
 * G4: the real damage engine, FID-20261002-006 form. Distribution per design
 * doc §160-176: 70% → units, 20% → factories, 10% → resources.
 *
 * Transaction-aware (§5.4): every read runs on the caller's tx with the asset
 * rows FOR UPDATE-locked, every write commits (or rolls back) WITH the missile
 * claim that requested it. Rolls (damage %, crit) are decided ONCE by the
 * caller before the transaction and passed in — a transaction retry replays
 * the same detonation, it never rerolls the warhead.
 *
 * §5.3: totalStrength/totalDefense are recounted from the resulting army
 * through 004's shared reducer and written WITH units — cached totals can no
 * longer go stale after an impact. Stored per-copy raw stats are preserved
 * (no temporary combat effect is persisted).
 */
async function applyDamageTx(
  tx: TreasuryTx,
  targetId: string,
  destroyedFraction: number,
  factorySharePercent: number,
  resourceSharePercent: number,
  now: Date
): Promise<MissileDamageRecord> {
  // Lock the target row FIRST (002 lock order: player row, then that player's
  // factory rows in deterministic (x, y) order) — the complete target set is
  // read from the locked truth, never a pre-lock snapshot.
  const targetRows = await tx
    .select()
    .from(players)
    .where(eq(players.username, targetId))
    .limit(1)
    .for('update');
  const target = targetRows[0];
  if (!target) {
    return { unitsDestroyed: 0, factoriesDamaged: 0, resourcesLost: { metal: 0, energy: 0 } };
  }

  // --- Units (70%): grouped representation-independent losses; units and the
  // recounted army totals are written TOGETHER on the locked row.
  const unitStacks: PlayerUnit[] = Array.isArray(target.units) ? target.units : [];
  let unitsDestroyed = 0;
  let survivors = unitStacks;
  if (unitStacks.length > 0 && destroyedFraction > 0) {
    const plan = applyProportionalUnitLosses(unitStacks, destroyedFraction);
    survivors = plan.survivors;
    unitsDestroyed = plan.destroyed;
  }
  const totals = calculatePlayerUnitStats(survivors);

  // --- Factories (20%): damage up to 3 target factories under lock; production
  // resumes via lastSlotRegen — recorded with the attacker stamp for forensics.
  const factoryRows = await tx
    .select()
    .from(factories)
    .where(eq(factories.owner, targetId))
    .orderBy(factories.x, factories.y)
    .limit(3)
    .for('update');
  let factoriesDamaged = 0;
  for (const factory of factoryRows) {
    const currentRate = Number(factory.productionRate);
    const reduction = Math.min(
      currentRate,
      Math.max(1, Math.floor((currentRate * factorySharePercent) / 100))
    );
    await tx
      .update(factories)
      .set({
        productionRate: String(Math.max(0, currentRate - reduction)),
        lastAttackedBy: targetId,
        lastAttackTime: now,
      })
      .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));
    factoriesDamaged += 1;
  }

  // --- Resources (10%): destroy resourceShare% of current (unbanked) stock by
  // RELATIVE decrement floored at zero (never an absolute write from a stale
  // snapshot).
  const metalLost = Math.floor((target.resourcesMetal || 0) * resourceSharePercent / 100);
  const energyLost = Math.floor((target.resourcesEnergy || 0) * resourceSharePercent / 100);

  const playerWrite: Record<string, unknown> = {
    units: survivors,
    totalStrength: totals.totalSTR,
    totalDefense: totals.totalDEF,
  };
  if (metalLost > 0) {
    playerWrite.resourcesMetal = sql`GREATEST(0, ${players.resourcesMetal} - ${metalLost})`;
  }
  if (energyLost > 0) {
    playerWrite.resourcesEnergy = sql`GREATEST(0, ${players.resourcesEnergy} - ${energyLost})`;
  }
  await tx.update(players).set(playerWrite as never).where(eq(players.username, targetId));

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
  // FID-20260919-015 W3: severity gate from persisted wmd_config.
  const record = await shouldRecordAlert(intercepted ? 'MEDIUM' : 'HIGH');
  if (!record) return;

  // FID-20260919-016: writes the consolidated wmd_alerts table (the old
  // wmd_admin_alerts was retired). The richer schema also carries missileId as
  // a first-class reference column, so the missile link is no longer buried in
  // the payload. Status uses the AlertStatus vocabulary ('OPEN' → 'ACTIVE').
  await db.insert(wmdAlerts).values({
    id: generateId(),
    type: AlertType.MISSILE_LAUNCH,
    severity: (intercepted ? 'MEDIUM' : 'HIGH') as AlertSeverity,
    status: AlertStatus.ACTIVE,
    title: `WMD launch: ${warheadType} → ${targetId}`,
    message: intercepted
      ? `Missile ${missileId} launched by ${launcherId} was intercepted by ${targetId}'s defenses.`
      : `Missile ${missileId} launched by ${launcherId} detonated on ${targetId}.`,
    missileId,
    data: { missileId, launcherId, targetId, warheadType, intercepted, damage } as unknown as WmdAlertData,
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
      // Narrowed target identity for the transaction closures below (the
      // no-target guard above already returned).
      const targetId = missile.targetId;

      // Target identity: players are username-keyed; the target's clan owns the
      // batteries that attempt interception.
      const targetRows = await db
        .select({ username: players.username, clanId: players.clanId })
        .from(players)
        .where(eq(players.username, missile.targetId))
        .limit(1);
      const target = targetRows[0];

      const targetClanId = target?.clanId ?? null;

      // FID-20261002-006 §5.4: warhead rolls decided ONCE per impact, outside
      // the retrying transaction — only consumed when NOT intercepted.
      const damagePercent = calculateDamagePercent(warhead);
      const crit = Math.random() < CRIT_CHANCE;
      const effect = crit ? damagePercent * CRIT_MULTIPLIER : damagePercent;
      const destroyedFraction = Math.min(Math.max((effect * DAMAGE_SHARE.units) / 100, 0), 1);
      const factoryShare = effect * DAMAGE_SHARE.factories;
      const resourceShare = effect * DAMAGE_SHARE.resources;

      // FID-20261002-007 §5.2: ONE transaction per missile — the missile row is
      // locked and its terminal claim, the battery-shot reservation (when the
      // target's clan intercepts) and every detonation write commit together or
      // not at all. A failed reservation cannot report successful interception;
      // competing missiles cannot consume one idle battery twice.
      type ImpactOutcome =
        | { outcome: 'intercepted'; batteryId?: string }
        | { outcome: 'detonated'; damage: MissileDamageRecord };

      let impact: ImpactOutcome | null;
      try {
        impact = await withTransactionRetry('wmd:impact', () =>
          db.transaction(async (tx): Promise<ImpactOutcome | null> => {
            const [locked] = await tx.select().from(missiles).where(eq(missiles.id, missile.id)).for('update');
            if (!locked || locked.status !== 'LAUNCHED' || !locked.impactAt || locked.impactAt > now) {
              return null; // lost the race or stale sweep
            }
            const interception = await attemptInterceptionTx(tx, targetClanId, warhead, now);
            if (interception.intercepted) {
              const claim = await tx
                .update(missiles)
                .set({
                  status: 'INTERCEPTED',
                  interceptedBy: interception.batteryId ?? 'Clan Defense Battery',
                  interceptedAt: now,
                  completedAt: now,
                  updatedAt: now,
                })
                .where(and(eq(missiles.id, missile.id), eq(missiles.status, 'LAUNCHED')))
                .returning({ id: missiles.id });
              if (claim.length === 0) return null;
              return { outcome: 'intercepted', batteryId: interception.batteryId };
            }
            const damage = await applyDamageTx(tx, targetId, destroyedFraction, factoryShare, resourceShare, now);
            const claim = await tx
              .update(missiles)
              .set({ status: 'DETONATED', damageDealt: damage, completedAt: now, updatedAt: now })
              .where(and(eq(missiles.id, missile.id), eq(missiles.status, 'LAUNCHED')))
              .returning({ id: missiles.id });
            if (claim.length === 0) return null;
            return { outcome: 'detonated', damage };
          })
        );
      } catch (error) {
        if (error instanceof ArmyIntegrityError) {
          const claimed = await db
            .update(missiles)
            .set({
              status: 'DETONATED',
              damageDealt: { unitsDestroyed: 0, factoriesDamaged: 0, resourcesLost: { metal: 0, energy: 0 } },
              completedAt: now,
              updatedAt: now,
            })
            .where(and(eq(missiles.id, missile.id), eq(missiles.status, 'LAUNCHED')))
            .returning({ id: missiles.id });
          if (claimed.length > 0) {
            await db.insert(wmdAlerts).values({
              id: generateId(),
              type: AlertType.SYSTEM_ERROR,
              severity: AlertSeverity.CRITICAL,
              status: AlertStatus.ACTIVE,
              title: `WMD integrity failure: ${warhead} → ${missile.targetId}`,
              message: `Missile ${missile.missileId} detonated but the target army failed validation: ${error.message}. No assets were destroyed; repair the army before further impacts.`,
              missileId: missile.missileId,
              data: { missileId: missile.missileId, targetId: missile.targetId, reason: error.message } as unknown as WmdAlertData,
              createdAt: new Date(),
            });
          }
          continue;
        }
        throw error;
      }

      if (!impact) {
        console.log(`[WMD Jobs] Missile ${missile.id} claim lost — impact already committed elsewhere`);
        continue;
      }

      if (impact.outcome === 'intercepted') {

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
        // FID-20260919-013: the interception must reach the players, not just
        // the audit row — target learns their defense held, launcher learns
        // their missile fell. Dedupe keys make tracker reprocesses idempotent.
        await notifyPlayer({
          systemType: 'wmd_missile_intercepted',
          recipient: missile.targetId,
          title: 'Missile Intercepted',
          body: `An incoming ${warhead} missile was shot down by your clan's defense grid.`,
          icon: '🛡️',
          relatedEntityId: missile.missileId,
          dedupeKey: `missile:${missile.missileId}:intercepted:target`,
        });
        if (missile.ownerId !== missile.targetId) {
          await notifyPlayer({
            systemType: 'wmd_missile_intercepted',
            recipient: missile.ownerId,
            title: 'Missile Intercepted',
            body: `Your ${warhead} missile targeting ${target?.username ?? missile.targetId} was intercepted by clan defenses.`,
            icon: '🛡️',
            relatedEntityId: missile.missileId,
            dedupeKey: `missile:${missile.missileId}:intercepted:owner`,
          });
        }
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

      const damageResult = impact.damage;

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
      // FID-20260919-013: impact notification to the target through the seam
      // (persisted to the System inbox + pushed live); dedupe guards
      // crash-resume reprocessing by the tracker sweep.
      await notifyPlayer({
        systemType: 'wmd_missile_impact',
        recipient: missile.targetId,
        title: 'Nuclear Impact',
        body: `A ${warhead} missile from ${missile.launchedBy ?? missile.ownerId} detonated on ${target?.username ?? missile.targetId}: ${damageResult.unitsDestroyed} units destroyed, ${damageResult.factoriesDamaged} factories damaged.`,
        icon: '💥',
        relatedEntityId: missile.missileId,
        dedupeKey: `missile:${missile.missileId}:impact:target`,
      });
      await recordAdminAlert(missile.missileId, missile.ownerId, missile.targetId, warhead, damageResult, false);

      // FID-20260919-018: post-attack clan consequences — the cooldown, relations
      // ENEMY, retaliation rights, and clan-research penalty the system was built
      // for but never called. Non-fatal: a consequence failure must never abort
      // the impact sweep. The launcher is told through the FID-20260919-013 seam.
      try {
        const launcherClanId = missile.ownerClanId ?? null;
        const targetClanId = target?.clanId ?? null;
        if (launcherClanId) {
          const clanRows = await db
            .select({ id: clans.id, name: clans.name })
            .from(clans)
            .where(
              targetClanId
                ? or(eq(clans.id, launcherClanId), eq(clans.id, targetClanId))
                : eq(clans.id, launcherClanId)
            );
          const nameOf = (id: string | null) =>
            (id ? clanRows.find((c) => c.id === id)?.name : undefined) ?? id ?? 'an unaffiliated target';

          const consequences = await applyClanWMDConsequences(
            launcherClanId,
            nameOf(launcherClanId),
            targetClanId,
            nameOf(targetClanId),
            warhead
          );

          if (consequences.success && consequences.consequencesApplied.length > 0) {
            await notifyPlayer({
              systemType: 'wmd_consequences',
              recipient: missile.ownerId,
              title: 'WMD Consequences',
              body: `Your clan's ${warhead} strike triggered ${consequences.consequencesApplied.length} consequence(s): ${consequences.consequencesApplied.join('; ')}`,
              icon: '⚠️',
              relatedEntityId: missile.missileId,
              dedupeKey: `missile:${missile.missileId}:consequences:launcher`,
            });
          }
        }
      } catch (consequenceError) {
        console.error(`[WMD Jobs] Consequence hook failed for missile ${missile.id}:`, consequenceError);
      }

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
