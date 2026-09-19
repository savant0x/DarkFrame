/**
 * @file app/api/factory/build-unit/route.ts
 * @created 2025-10-17
 * @rewritten 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
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
import { UnitType, UNIT_CONFIGS, Factory } from '@/types';
import { applySlotRegeneration, hasEnoughSlots, consumeSlots } from '@/lib/slotRegenService';
import { getBonusStack, assertHolderMayTransact } from '@/lib/flagBonusService';
import { getMaxSlots } from '@/lib/factoryUpgradeService';
import { awardXP, XPAction } from '@/lib/xpService';
import { trackUnitBuilt } from '@/lib/statTrackingService';
import { getPlayerDoctrineBonuses } from '@/lib/specializationService';
import { withRequestLogging, createRouteLogger } from '@/lib';

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

    // 6. Get factory data (pg-native domain loader)
    const factory = (await db
      .select()
      .from(factories)
      .where(and(eq(factories.x, factoryX), eq(factories.y, factoryY)))
      .limit(1)) as unknown as Factory[];

    if (factory.length === 0) {
      log.warn('Factory not found', { username, factoryX, factoryY });
      return NextResponse.json(
        { success: false, message: 'Factory not found at specified coordinates' },
        { status: 404 }
      );
    }

    // 7. Verify ownership
    if (factory[0].owner !== username) {
      log.warn('Factory ownership violation', { username, factoryOwner: factory[0].owner, factoryX, factoryY });
      return NextResponse.json(
        { success: false, message: 'You do not own this factory' },
        { status: 403 }
      );
    }

    // 8. Apply slot regeneration
    const regeneratedFactory = applySlotRegeneration(factory[0]);
    // FID-072: capacity is DERIVED from level, never the stored `slots`
    // column — that column went stale on every pre-072 upgrade (written only
    // at creation), so building enforced L1 capacity on upgraded factories
    // while the status panel showed the true (derived) capacity.
    regeneratedFactory.slots = getMaxSlots(regeneratedFactory.level || 1);

    // 9. Check slot availability
    if (!hasEnoughSlots(regeneratedFactory, totalSlotCost)) {
      const available = Math.max(0, regeneratedFactory.slots - regeneratedFactory.usedSlots);
      log.warn('Insufficient factory slots', { username, needed: totalSlotCost, available });
      return NextResponse.json(
        {
          success: false,
          message: `Not enough slots available. Need ${totalSlotCost}, have ${available}`,
          availableSlots: available
        },
        { status: 400 }
      );
    }

    // 10. Get player data (direct pg read over the flat resource columns)
    const [player] = await db
      .select({
        units: players.units,
        resourcesMetal: players.resourcesMetal,
        resourcesEnergy: players.resourcesEnergy,
        totalStrength: players.totalStrength,
        totalDefense: players.totalDefense,
      })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    if (!player) {
      log.warn('Player not found for factory build', { username });
      return NextResponse.json(
        { success: false, message: 'Player not found' },
        { status: 404 }
      );
    }

    // 11. Check resource availability
    if (player.resourcesMetal < totalMetalCost || player.resourcesEnergy < totalEnergyCost) {
      log.warn('Insufficient resources for factory build', {
        username,
        metalNeeded: totalMetalCost,
        metalHave: player.resourcesMetal,
        energyNeeded: totalEnergyCost,
        energyHave: player.resourcesEnergy
      });
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient resources. Need ${totalMetalCost} metal and ${totalEnergyCost} energy`,
          required: { metal: totalMetalCost, energy: totalEnergyCost },
          available: { metal: player.resourcesMetal, energy: player.resourcesEnergy }
        },
        { status: 400 }
      );
    }

    // 12. Calculate gains and the single new (quantity-folded) unit entry
    const strGained = unitConfig.strength * quantity;
    const defGained = unitConfig.defense * quantity;
    const newTotalStrength = (player.totalStrength || 0) + strGained;
    const newTotalDefense = (player.totalDefense || 0) + defGained;

    // 14. Update player (deduct resources, add units, update totals) — direct
    // drizzle/pg. FID-20260909-032 §5-G: the Mongo `$push: { units: { $each } }`
    // operand was persisted VERBATIM by the legacy seam path (one junk
    // `{$each:[…]}` blob element instead of N units — the live corruption
    // repaired by scripts/repair-units-each-blob.ts). Here the domain shape is
    // explicit: one quantity-folded PlayerUnit entry appended via jsonb ||.
    const builtAt = new Date();
    const newUnitEntry = {
      id: `${username}-${builtAt.getTime()}-infantry`,
      unitId: unitType,
      unitType,
      name: unitConfig.name,
      category: (unitConfig.defense > 0 && !unitConfig.strength ? 'DEF' : 'STR') as 'STR' | 'DEF',
      rarity: 'common' as const,
      strength: unitConfig.strength,
      defense: unitConfig.defense,
      quantity,
      createdAt: builtAt,
      // FID-20260909-032 §H: factory provenance so per-factory production
      // investment is reconstructible by /api/factory/list.
      producedAt: { x: factoryX, y: factoryY },
    };

    const playerUpdated = await db
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
      log.error('Failed to deduct resources', new Error('Player update failed'), { username });
      return NextResponse.json(
        { success: false, message: 'Failed to deduct resources' },
        { status: 500 }
      );
    }

    // 15. Update factory (consume slots, update last regen time)
    const updatedFactory = consumeSlots(regeneratedFactory, totalSlotCost);
    await db
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

    // 16. Track units built for achievements (+ doctrine-matching mastery XP —
    // FID-20260914-008 Phase 2). Factory units are strength-class (T1 Rifleman
    // and kin); the unit's STR/DEF split decides the category.
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
        unitCount: (player.units?.length || 0) + quantity
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
 * 4. Load factory and verify ownership
 * 5. Apply slot regeneration to factory
 * 6. Verify slot availability
 * 7. Load player and verify resource availability
 * 8. Calculate new STR/DEF totals
 * 9. Atomic SQL deltas: deduct resources, append the quantity-folded unit
 *    entry (jsonb ||), bump totals; consume factory slots; $inc investment
 * 10. Return success with comprehensive status
 *
 * ERROR HANDLING:
 * - 401: Not authenticated
 * - 403: Not factory owner (or bearer-restricted flag holder)
 * - 404: Factory or player not found
 * - 400: Invalid inputs, insufficient resources/slots
 * - 500: Database or server errors
 */
