/**
 * @file app/api/factory/build-unit/route.ts
 * @created 2025-10-17
 * @rewritten 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 * @updated 2026-10-02 (FID-20261002-011 §5.5: regen + slot reservation on locked
 *            rows in one FID-002 transaction, owner's balance multiplier, explicit clock)
 * @overview API endpoint for building units at factories
 *
 * OVERVIEW:
 * Allows players to build military units at factories they own. Validates resource costs,
 * applies slot regeneration, consumes factory slots, creates unit, and updates player
 * totals for STR/DEF tracking.
 *
 * UNIT TYPES:
 * - Rifleman: 200M/100E, STR 5
 * - Scout: 150M/150E, STR 3
 * - Bunker: 200M/100E, DEF 5
 * - Barrier: 150M/150E, DEF 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { logFactory } from '@/lib/activityLogger';
import { authenticateRequest } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { factories, players } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { UnitType, UNIT_CONFIGS, TIER_UNLOCK_REQUIREMENTS, UnitTier, isTierAdmissible, Factory } from '@/types';
import { applySlotRegeneration, hasEnoughSlots, consumeSlots, getSlotRegenBalanceMultiplier } from '@/lib/slotRegenService';
import { getBonusStack, assertHolderMayTransact } from '@/lib/flagBonusService';
import { getMaxSlots } from '@/lib/factoryUpgradeService';
import { awardXP, XPAction } from '@/lib/xpService';
import { trackUnitBuilt } from '@/lib/statTrackingService';
import { getPlayerDoctrineBonuses } from '@/lib/specializationService';
import { canonicalPlayerUnitFromConfig } from '@/lib/armyService';
import { withRequestLogging, createRouteLogger } from '@/lib';
import { withTransactionRetry } from '@/lib/db/treasuryLock';

interface BuildUnitRequest {
  factoryX: number;
  factoryY: number;
  unitType: UnitType;
  quantity?: number; // Number of units to build (default: 1)
}

/**
 * POST /api/factory/build-unit
 * Build military units at a factory
 *
 * @body factoryX - Factory X coordinate
 * @body factoryY - Factory Y coordinate
 * @body unitType - Type of unit to build (RIFLEMAN/SCOUT/BUNKER/BARRIER)
 * @body quantity - Number of units to build (optional, default: 1)
 */
export const POST = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('FactoryBuildUnitAPI');
  const endTimer = log.time('buildFactoryUnit');

  try {
    // FID-20260904-005 §5.1: real session auth. The prior code read the session cookie
    // but treated the JWT STRING as the username — lookups could never succeed.
    const auth = await authenticateRequest(request);
    if (!auth) {
      log.warn('Unauthenticated factory build attempt');
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const username = auth.username;

    // 2. Parse request body
    const body: BuildUnitRequest = await request.json();
    const { factoryX, factoryY, unitType, quantity = 1 } = body;

    log.debug('Factory unit build request', { username, factoryX, factoryY, unitType, quantity });

    // 3. Validate inputs
    if (!factoryX || !factoryY || !unitType) {
      log.warn('Missing required fields', { username, factoryX, factoryY, unitType });
      return NextResponse.json(
        { success: false, message: 'Missing required fields: factoryX, factoryY, unitType' },
        { status: 400 }
      );
    }

    if (!Object.values(UnitType).includes(unitType)) {
      log.warn('Invalid unit type', { username, unitType });
      return NextResponse.json(
        { success: false, message: `Invalid unit type. Must be one of: ${Object.values(UnitType).join(', ')}` },
        { status: 400 }
      );
    }

    // FID-20260906-001 §5.5 enforcement gap: the HOLDER_RESTRICTIONS list and
    // the bearer's own flag panel both claim unit building is blocked, but this
    // route (the in-game factory build panel's endpoint) never implemented the
    // gate — only /api/player/build-unit did. Same 403 shape as the other gates
    // so UI surfaces the real reason.
    const flagStack = await getBonusStack(username);
    const flagGate = assertHolderMayTransact(flagStack, 'build-unit');
    if (!flagGate.ok) {
      log.info('Bearer restriction: factory build-unit blocked', { username });
      return NextResponse.json({ success: false, message: flagGate.reason }, { status: 403 });
    }

    if (quantity < 1 || quantity > 100) {
      log.warn('Invalid quantity', { username, quantity });
      return NextResponse.json(
        { success: false, message: 'Quantity must be between 1 and 100' },
        { status: 400 }
      );
    }

    // 4. Get unit configuration
    const unitConfig = UNIT_CONFIGS[unitType];
    // FID-20260914-008 Phase 1: doctrine cost discounts apply here (one of the
    // three converged cost seams). Ceil+1 floor keeps every charge ≥ 1.
    const doctrine = await getPlayerDoctrineBonuses(username);
    const totalMetalCost = Math.max(1, Math.ceil(unitConfig.metalCost * quantity * doctrine.metalCostMul));
    const totalEnergyCost = Math.max(1, Math.ceil(unitConfig.energyCost * quantity * doctrine.energyCostMul));
    const totalSlotCost = unitConfig.slotCost * quantity;

    // 6–15 (FID-20261002-011 §5.5): regeneration, slot reservation, the player
    // debit/credit and the factory write run against LOCKED rows inside ONE
    // FID-20261002-002 transaction. The previous flow regenerated in memory
    // against an unlocked snapshot and wrote the factory after the player —
    // the hourly regen job or a concurrent build could interleave and the
    // reservation could overwrite a consumed snapshot. Lock order: player row
    // first, then the factory asset.
    const builtAt = new Date();
    const buildOutcome = await withTransactionRetry(`factoryBuildUnit(${username})`, () =>
      db.transaction(async (tx): Promise<
        | { ok: false; status: 400 | 403 | 404 | 500; message: string; availableSlots?: number; required?: { metal: number; energy: number }; available?: { metal: number; energy: number } }
        | {
            ok: true;
            strGained: number;
            defGained: number;
            newTotalStrength: number;
            newTotalDefense: number;
            updatedFactory: Factory;
            unitCount: number;
          }
      > => {
        const [player] = await tx
          .select({
            units: players.units,
            resourcesMetal: players.resourcesMetal,
            resourcesEnergy: players.resourcesEnergy,
            totalStrength: players.totalStrength,
            totalDefense: players.totalDefense,
            level: players.level,
            unlockedTiers: players.unlockedTiers,
          })
          .from(players)
          .where(eq(players.username, username))
          .limit(1)
          .for('update');

        if (!player) {
          return { ok: false, status: 404, message: 'Player not found' };
        }

        const [factoryRow] = await tx
          .select()
          .from(factories)
          .where(and(eq(factories.x, factoryX), eq(factories.y, factoryY)))
          .limit(1)
          .for('update');

        if (!factoryRow) {
          return { ok: false, status: 404, message: 'Factory not found at specified coordinates' };
        }

        if (factoryRow.owner !== username) {
          return { ok: false, status: 403, message: 'You do not own this factory' };
        }

        // FID-20261002-004 §5.2 (R3): the tier gate this route never had —
        // core-roster units require the PERMANENT tier unlock (players.
        // unlockedTiers) AND its level, re-verified against the LOCKED player
        // row. SPEC/PRESTIGE units keep their own doctrine/achievement gates.
        // This kills the level-1/RP-zero Tier-5-Titan build at the server.
        const lockedTiers = player.unlockedTiers && player.unlockedTiers.length > 0
          ? player.unlockedTiers
          : [UnitTier.Tier1];
        if (!isTierAdmissible(unitType, player.level || 1, lockedTiers)) {
          const tierReq = TIER_UNLOCK_REQUIREMENTS[unitConfig.tier];
          return {
            ok: false,
            status: 403,
            message: `Tier ${unitConfig.tier} is not unlocked (requires the permanent tier unlock: ${tierReq.rp} RP · level ${tierReq.level}+)`,
          };
        }

        // 8. Apply slot regeneration at the OWNER'S balance multiplier with an
        // explicit clock (FID-20261002-011 §5.3): one effective rate shared by
        // job/build/status/list — critical-balance owners regenerate at 0.85×.
        const balanceMultiplier = getSlotRegenBalanceMultiplier(player.totalStrength, player.totalDefense);
        const regeneratedFactory = applySlotRegeneration(factoryRow as unknown as Factory, {
          now: builtAt,
          balanceMultiplier,
        });
        // FID-072: capacity is DERIVED from level, never the stored `slots`
        // column — that column went stale on every pre-072 upgrade (written only
        // at creation), so building enforced L1 capacity on upgraded factories
        // while the status panel showed the true (derived) capacity.
        regeneratedFactory.slots = getMaxSlots(regeneratedFactory.level || 1);

        // 9. Check slot availability
        if (!hasEnoughSlots(regeneratedFactory, totalSlotCost)) {
          const available = Math.max(0, regeneratedFactory.slots - regeneratedFactory.usedSlots);
          return {
            ok: false,
            status: 400,
            message: `Not enough slots available. Need ${totalSlotCost}, have ${available}`,
            availableSlots: available,
          };
        }

        // 11. Check resource availability against the LOCKED player row
        if (player.resourcesMetal < totalMetalCost || player.resourcesEnergy < totalEnergyCost) {
          return {
            ok: false,
            status: 400,
            message: `Insufficient resources. Need ${totalMetalCost} metal and ${totalEnergyCost} energy`,
            required: { metal: totalMetalCost, energy: totalEnergyCost },
            available: { metal: player.resourcesMetal, energy: player.resourcesEnergy },
          };
        }

        // 12. Calculate gains and the single new (quantity-folded) unit entry
        const strGained = unitConfig.strength * quantity;
        const defGained = unitConfig.defense * quantity;
        const newTotalStrength = (player.totalStrength || 0) + strGained;
        const newTotalDefense = (player.totalDefense || 0) + defGained;

        // 14. Update player (deduct resources, add units, update totals) —
        // relative SQL deltas so concurrent writers compose (FID-20260909-032
        // §5-G): one quantity-folded PlayerUnit entry appended via jsonb ||.
        // FID-20261002-004 §5.5: canonical minting — blueprint id and canonical
        // unitType stored separately, stack quantity preserved, distinct
        // instance id (two builds in one millisecond can never collide).
        const newUnitEntry = canonicalPlayerUnitFromConfig(unitConfig, quantity, username, {
          x: factoryX,
          y: factoryY,
        });

        const playerUpdated = await tx
          .update(players)
          .set({
            resourcesMetal: sql`${players.resourcesMetal} - ${totalMetalCost}`,
            resourcesEnergy: sql`${players.resourcesEnergy} - ${totalEnergyCost}`,
            units: sql`${players.units} || ${JSON.stringify([newUnitEntry])}::jsonb`,
            totalStrength: sql`${players.totalStrength} + ${strGained}`,
            totalDefense: sql`${players.totalDefense} + ${defGained}`,
          })
          .where(eq(players.username, username))
          .returning({ username: players.username });

        if (playerUpdated.length === 0) {
          return { ok: false, status: 500, message: 'Failed to deduct resources' };
        }

        // 15. Update factory (consume slots, advance the regen checkpoint) on
        // the LOCKED row — the reservation and the regen advance commit with
        // the player write or not at all.
        const updatedFactory = consumeSlots(regeneratedFactory, totalSlotCost);
        await tx
          .update(factories)
          .set({
            usedSlots: updatedFactory.usedSlots,
            lastSlotRegen: updatedFactory.lastSlotRegen,
            // FID-20260909-032 §7: exact lifetime investment at write time —
            // SQL delta so concurrent builds compose instead of last-write-wins.
            investedMetal: sql`${factories.investedMetal} + ${totalMetalCost}`,
            investedEnergy: sql`${factories.investedEnergy} + ${totalEnergyCost}`,
          })
          .where(and(eq(factories.x, factoryX), eq(factories.y, factoryY)));

        return {
          ok: true,
          strGained,
          defGained,
          newTotalStrength,
          newTotalDefense,
          updatedFactory,
          unitCount: (player.units?.length || 0) + quantity,
        };
      })
    );

    if (!buildOutcome.ok) {
      if (buildOutcome.status === 400) {
        log.warn('Factory build refused', { username, message: buildOutcome.message });
      } else {
        log.warn('Factory build failed', { username, status: buildOutcome.status, message: buildOutcome.message });
      }
      return NextResponse.json(
        {
          success: false,
          message: buildOutcome.message,
          ...(buildOutcome.availableSlots !== undefined ? { availableSlots: buildOutcome.availableSlots } : {}),
          ...(buildOutcome.required ? { required: buildOutcome.required, available: buildOutcome.available } : {}),
        },
        { status: buildOutcome.status }
      );
    }

    const { strGained, defGained, newTotalStrength, newTotalDefense, updatedFactory, unitCount } = buildOutcome;

    // 16. Track units built for achievements (+ doctrine-matching mastery XP —
    // FID-20260914-008 Phase 2). Factory units are strength-class (T1 Rifleman
    // and kin); the unit's STR/DEF split decides the category.
    // Post-commit (FID-20261002-002): reward failures cannot retry the build.
    await trackUnitBuilt(
      username,
      quantity,
      unitConfig.strength > 0 && unitConfig.defense === 0 ? 'strength' : unitConfig.defense > 0 && unitConfig.strength === 0 ? 'defense' : undefined
    );

    // 17. Award XP for unit building (5 XP per unit)
    const xpResult = await awardXP(username, XPAction.UNIT_BUILD, quantity);

    log.info('Factory units built successfully', {
      username,
      unitType,
      quantity,
      strGained,
      defGained,
      factoryLocation: { x: factoryX, y: factoryY }
    });

    // FID-20260909-029 §2.4: anti-cheat telemetry (was: logger defined,
    // never wired). Logging failures are swallowed inside the logger.
    await logFactory(
      username,
      request.cookies.get('sessionId')?.value || 'unknown',
      false,
      updatedFactory.level ?? 1,
      { x: factoryX, y: factoryY },
      { metal: totalMetalCost, energy: totalEnergyCost }
    );

    // 18. Return success with updated data
    return NextResponse.json({
      success: true,
      message: `Successfully built ${quantity}x ${unitConfig.name}`,
      unitsBuilt: {
        type: unitType,
        name: unitConfig.name,
        quantity,
        strGained,
        defGained
      },
      resourcesSpent: {
        metal: totalMetalCost,
        energy: totalEnergyCost
      },
      slotsConsumed: totalSlotCost,
      playerTotals: {
        totalStrength: newTotalStrength,
        totalDefense: newTotalDefense,
        unitCount
      },
      factoryStatus: {
        availableSlots: updatedFactory.slots - updatedFactory.usedSlots,
        maxSlots: updatedFactory.slots,
        usedSlots: updatedFactory.usedSlots
      },
      xpAwarded: xpResult.xpAwarded,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel
    });

  } catch (error) {
    log.error('Factory unit build error', error as Error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * BUILD UNIT FLOW:
 *
 * 1. Authenticate user via session cookie
 * 2. Validate request (coordinates, unit type, quantity)
 * 3. Get unit configuration (costs, STR/DEF values)
 * 4. ONE transaction (FID-20261002-002/011): lock player row, lock factory
 *    row, regenerate slots at the owner's balance multiplier with an explicit
 *    clock, verify slots/resources against the locked rows, debit/credit with
 *    relative SQL, consume slots and advance the regen checkpoint
 * 5. Post-commit: achievements, XP, activity log — never retried as payouts
 *
 * ERROR HANDLING:
 * - 401: Not authenticated
 * - 403: Not factory owner (or bearer-restricted flag holder)
 * - 404: Factory or player not found
 * - 400: Invalid inputs, insufficient resources/slots
 * - 500: Database or server errors
 */
