/**
 * @file app/api/player/build-unit/route.ts
 * @created 2025-10-17
 * @updated 2026-10-02 (FID-20261002-011 §5.5: player build distribution uses the
 *            SAME slot accounting as the factory seam — derived capacity,
 *            regeneration at the owner's balance multiplier, reservations on
 *            locked rows inside one transaction)
 * @overview API endpoint for building units from the unit factory
 * 
 * OVERVIEW:
 * Handles unit building requests from the unit factory interface.
 * Validates resources, unlock status, and slot capacity before creating units.
 * Updates player's unit array and total STR/DEF stats.
 * 
 * Endpoints:
 * - POST: Build unit(s) by spending resources
 * - GET: Fetch available units and player unlock status
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { players as playersTable, factories as factoriesTable } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getPlayer } from '@/lib/playerService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getBonusStack, assertHolderMayTransact } from '@/lib/flagBonusService';
import { UNIT_BLUEPRINTS } from '@/types/units.types';
import { getPlayerDoctrineBonuses } from '@/lib/specializationService';
import {
  UNIT_CONFIGS,
  TIER_UNLOCK_REQUIREMENTS,
  UnitTier,
  isTierAdmissible,
  resolveCanonicalUnitType,
} from '@/types';
import { canonicalPlayerUnitFromConfig } from '@/lib/armyService';
import { Factory } from '@/types';
import { applySlotRegeneration, getSlotRegenBalanceMultiplier } from '@/lib/slotRegenService';
import { getMaxSlots } from '@/lib/factoryUpgradeService';
import { withTransactionRetry } from '@/lib/db/treasuryLock';
import { 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  BuildUnitSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.buildUnit);

/**
 * GET /api/player/build-unit
 * Fetches available units and player's unlock status
 */
export const GET = withRequestLogging(async (_request: NextRequest) => {
  const log = createRouteLogger('PlayerBuildUnitAPI');
  const endTimer = log.time('fetchUnitData');
  
  try {
    // FID-20260904-005 §5.1: session identity — query username ignored (unit data is
    // per-player; the session user sees their own).
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const username = authUser.username;

    // FID-20260906-001 §5.5: bearer restriction — the Flag Bearer cannot do this while holding.
    const flagStack = await getBonusStack(username);
    const flagGate = assertHolderMayTransact(flagStack, 'build-unit');
    if (!flagGate.ok) {
      return NextResponse.json({ success: false, error: flagGate.reason }, { status: 403 });
    }

    log.debug('Fetching unit data', { username });

    const player = await getPlayer(username);
    if (!player) {
      log.warn('Player not found', { username });
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Calculate which units are unlocked
    const playerLevel = player.level || 1;
    const playerRP = player.researchPoints || 0;

    // FID-20261002-004 §5.2: availability comes from the PERMANENT tier system
    // (isTierUnlocked over players.unlockedTiers) — never from current RP
    // balance versus a blueprint's legacy purchase price. A tier already
    // unlocked stays unlocked after RP is spent elsewhere. Core-roster identity
    // resolves through the canonical mapping (no casts); SPEC/PRESTIGE units
    // keep their own doctrine/achievement gates.
    const unlockedTiers = player.unlockedTiers && player.unlockedTiers.length > 0
      ? player.unlockedTiers
      : [UnitTier.Tier1];

    const unitsWithStatus = Object.values(UNIT_BLUEPRINTS).map(unit => {
      const unitType = resolveCanonicalUnitType(unit.id);
      const config = unitType ? UNIT_CONFIGS[unitType] : null;
      const isUnlocked = !!unitType && isTierAdmissible(unitType, playerLevel, unlockedTiers);
      const tierReq = config ? TIER_UNLOCK_REQUIREMENTS[config.tier] : null;

      return {
        ...unit,
        isUnlocked,
        canonicalUnitType: unitType ?? undefined,
        lockReason: isUnlocked || !tierReq
          ? undefined
          : `Requires the Tier ${config!.tier} unlock (${tierReq.rp} RP · level ${tierReq.level}+)`,
        playerOwned: player.units?.filter((u) => u.unitId === unit.id).length || 0
      };
    });

    // Calculate unit slots: 100 base + (factoryCount * 50) additional slots (total unit capacity)
    const baseSlots = 100;
    const factoryBonus = (player.factoryCount || 0) * 50;
    const totalSlots = baseSlots + factoryBonus;
    const usedSlots = player.units?.length || 0;

    // Calculate factory build slots: Sum of available slots across all owned
    // factories — pg (FID-20260917-016). FID-20261002-011: SAME slot accounting
    // as the factory seam — capacity is DERIVED from level (the stored `slots`
    // column went stale on pre-072 upgrades) and regeneration is applied at the
    // owner's balance multiplier with one shared clock before counting.
    const balanceMultiplier = getSlotRegenBalanceMultiplier(player.totalStrength, player.totalDefense);
    const now = new Date();
    const factories = await db.select({
      x: factoriesTable.x,
      y: factoriesTable.y,
      level: factoriesTable.level,
      usedSlots: factoriesTable.usedSlots,
      lastSlotRegen: factoriesTable.lastSlotRegen,
    }).from(factoriesTable).where(eq(factoriesTable.owner, username));
    
    const factoryBuildSlots = factories.reduce((total: number, factory) => {
      const regenerated = applySlotRegeneration(factory as unknown as Factory, { now, balanceMultiplier });
      const availableInFactory = Math.max(0, getMaxSlots(regenerated.level || 1) - regenerated.usedSlots);
      return total + availableInFactory;
    }, 0);

    log.info('Unit data fetched', { 
      username, 
      unitsCount: unitsWithStatus.length, 
      usedSlots, 
      totalSlots,
      factoryBuildSlots,
      factoryCount: factories.length
    });

    return NextResponse.json({
      success: true,
      units: unitsWithStatus,
      playerStats: {
        level: playerLevel,
        researchPoints: playerRP,
        resources: player.resources,
        totalStrength: player.totalStrength || 0,
        totalDefense: player.totalDefense || 0,
        availableSlots: totalSlots,
        usedSlots: usedSlots,
        factoryBuildSlots: factoryBuildSlots // NEW: Total available building slots across all factories
      }
    });
  } catch (error) {
    log.error('Failed to fetch unit data', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch unit data' },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});

/**
 * POST /api/player/build-unit
 * Builds unit(s) by spending resources
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('PlayerBuildUnitAPI');
  const endTimer = log.time('buildUnit');
  
  try {
    // FID-20260904-005 §5.1: session identity — body username ignored.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const body = await request.json();
    const validated = BuildUnitSchema.parse(body);
    const username = authUser.username;

    // FID-20260906-001 §5.5: bearer restriction — the Flag Bearer cannot build
    // units while holding (doc anti-exploit rule).
    const flagStack = await getBonusStack(username);
    const flagGate = assertHolderMayTransact(flagStack, 'build-unit');
    if (!flagGate.ok) {
      return NextResponse.json({ success: false, error: flagGate.reason }, { status: 403 });
    }

    log.debug('Unit build request', { 
      username,
      unitTypeId: validated.unitTypeId, 
      quantity: validated.quantity 
    });

    // Get unit blueprint
    const unitBlueprint = UNIT_BLUEPRINTS[validated.unitTypeId];
    if (!unitBlueprint) {
      log.warn('Invalid unit type', { 
        username: username, 
        unitTypeId: validated.unitTypeId 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Invalid unit type'
      });
    }

    // Get player data with factory count
    const player = await getPlayer(username);
    if (!player) {
      log.warn('Player not found for unit build', { username: username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    // Check unlock status — FID-20261002-004 §5.1/§5.2: canonical identity +
    // PERMANENT tier admission (players.unlockedTiers), never current RP
    // balance against the blueprint's legacy purchase price (an already
    // unlocked tier remains buildable after RP drops). The old checks read the
    // stale blueprint.unlockRequirement — that gate is retired here.
    const playerLevel = player.level || 1;
    const unlockedTiers = player.unlockedTiers && player.unlockedTiers.length > 0
      ? player.unlockedTiers
      : [UnitTier.Tier1];

    // FID-20261002-004 §5.1: resolve through the typed canonical mapping —
    // never cast the blueprint id to UnitType (the R4 defect that let 'titan'
    // miss UNIT_CONFIGS and fall back to a single slot).
    const canonicalUnitType = resolveCanonicalUnitType(unitBlueprint.id);
    const unitConfig = canonicalUnitType ? UNIT_CONFIGS[canonicalUnitType] : null;

    if (!canonicalUnitType || !unitConfig) {
      log.warn('Blueprint has no canonical UnitType mapping', {
        username: username,
        unitTypeId: validated.unitTypeId,
        blueprintId: unitBlueprint.id
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'This unit is not buildable'
      });
    }

    if (!isTierAdmissible(canonicalUnitType, playerLevel, unlockedTiers)) {
      const tierReq = TIER_UNLOCK_REQUIREMENTS[unitConfig.tier];
      log.warn('Tier not unlocked', {
        username: username,
        unitType: canonicalUnitType,
        tier: unitConfig.tier,
        required: tierReq,
        unlockedTiers
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        required: tierReq.rp,
        have: player.researchPoints || 0,
        message: `Tier ${unitConfig.tier} is not unlocked (requires the permanent tier unlock: ${tierReq.rp} RP · level ${tierReq.level}+)`
      });
    }

    // Get all player factories for sequential slot consumption — pg, ordered by
    // composite PK (x, y) for consistent ordering (FID-20260917-016).
    // FID-20261002-011: carry level + lastSlotRegen so availability uses the
    // SAME regeneration accounting as the factory seam.
    const factories = await db.select({
      x: factoriesTable.x,
      y: factoriesTable.y,
      level: factoriesTable.level,
      usedSlots: factoriesTable.usedSlots,
      lastSlotRegen: factoriesTable.lastSlotRegen,
    }).from(factoriesTable).where(eq(factoriesTable.owner, username)).orderBy(factoriesTable.x, factoriesTable.y);

    if (factories.length === 0) {
      log.warn('No factories owned', { username: username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'You must own at least one factory to build units'
      });
    }

    // FID-20261002-011: fail-fast availability preview uses derived capacity +
    // regeneration at the owner's balance multiplier (authoritative re-check
    // runs on the locked rows inside the transaction below).
    const previewMultiplier = getSlotRegenBalanceMultiplier(player.totalStrength, player.totalDefense);
    const previewNow = new Date();
    const totalFactoryBuildSlots = factories.reduce((total: number, factory) => {
      const regenerated = applySlotRegeneration(factory as unknown as Factory, { now: previewNow, balanceMultiplier: previewMultiplier });
      const availableInFactory = Math.max(0, getMaxSlots(regenerated.level || 1) - regenerated.usedSlots);
      return total + availableInFactory;
    }, 0);

    if (validated.quantity > totalFactoryBuildSlots) {
      log.warn('Insufficient factory build slots', { 
        username: username, 
        available: totalFactoryBuildSlots, 
        needed: validated.quantity 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: `Insufficient factory slots (${totalFactoryBuildSlots} available, ${validated.quantity} needed)`
      });
    }

    // Calculate total cost — FID-20260914-008 Phase 1: doctrine cost discounts
    // apply here (one of the three converged cost seams). Ceil+1 floor keeps
    // every charge ≥ 1 and prevents zero-cost edge cases on odd multipliers.
    const doctrine = await getPlayerDoctrineBonuses(username);
    const totalMetalCost = Math.max(1, Math.ceil(unitBlueprint.metalCost * validated.quantity * doctrine.metalCostMul));
    const totalEnergyCost = Math.max(1, Math.ceil(unitBlueprint.energyCost * validated.quantity * doctrine.energyCostMul));

    const playerMetal = player.resources?.metal || 0;
    const playerEnergy = player.resources?.energy || 0;

    // Check resources (fail-fast; re-validated against the locked row in-tx)
    if (playerMetal < totalMetalCost) {
      log.warn('Insufficient metal', { 
        username: username, 
        needed: totalMetalCost, 
        have: playerMetal 
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        resourceType: 'metal',
        needed: totalMetalCost,
        have: playerMetal
      });
    }

    if (playerEnergy < totalEnergyCost) {
      log.warn('Insufficient energy', { 
        username: username, 
        needed: totalEnergyCost, 
        have: playerEnergy 
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        resourceType: 'energy',
        needed: totalEnergyCost,
        have: playerEnergy
      });
    }

    // Sequential factory slot consumption logic — FID-20261002-004 §5.1: the
    // canonical slot cost from the derived config; the one-slot fallback that
    // let a Titan build for 1 slot is deleted.
    const slotCostPerUnit = unitConfig.slotCost;

    // Total slot cost across the build — denominator for per-factory investment
    // shares (FID-20260917-016 D3).
    const totalSlotCostForShares = validated.quantity * slotCostPerUnit;

    // FID-20261002-011 §5.5: regeneration + slot reservation run against LOCKED
    // factory rows inside ONE FID-20261002-002 transaction together with the
    // player debit/credit. Lock order: player row first, then the factory
    // assets in composite-PK order. The old flow consumed slots from an
    // unlocked snapshot and wrote the player first — the regen job or a
    // concurrent build could interleave between the availability check and the
    // reservation, and the snapshot `usedSlots` write could clobber it.
    const builtAt = new Date();
    const buildResult = await withTransactionRetry(`playerBuildUnit(${username})`, () =>
      db.transaction(async (tx): Promise<
        | { ok: false; kind: 'insufficient-slots' | 'insufficient-resources' | 'write-failed' | 'tier-locked'; available?: number; needed?: number; resourceType?: 'metal' | 'energy'; neededCost?: number; have?: number; tier?: number; tierRp?: number; tierLevel?: number }
        | {
            ok: true;
            newUnits: Array<Record<string, unknown>>;
            factoriesUsed: number;
            newTotalStrength: number;
            newTotalDefense: number;
          }
      > => {
        // Lock the player row first (lock order: players before assets).
        const [lockedPlayer] = await tx
          .select({
            resourcesMetal: playersTable.resourcesMetal,
            resourcesEnergy: playersTable.resourcesEnergy,
            totalStrength: playersTable.totalStrength,
            totalDefense: playersTable.totalDefense,
            level: playersTable.level,
            unlockedTiers: playersTable.unlockedTiers,
          })
          .from(playersTable)
          .where(eq(playersTable.username, username))
          .limit(1)
          .for('update');

        if (!lockedPlayer) {
          return { ok: false, kind: 'write-failed' };
        }

        // Lock every candidate factory row in composite-PK order.
        const lockedFactories = await tx
          .select()
          .from(factoriesTable)
          .where(eq(factoriesTable.owner, username))
          .orderBy(factoriesTable.x, factoriesTable.y)
          .for('update');

        const balanceMultiplier = getSlotRegenBalanceMultiplier(lockedPlayer.totalStrength, lockedPlayer.totalDefense);
        const now = builtAt;

        // Regenerate every locked factory and compute total availability from
        // the locked rows (derived capacity — FID-20261002-011 slot parity).
        const regeneratedByKey = new Map<string, Factory>();
        let totalAvailable = 0;
        for (const factoryRow of lockedFactories) {
          const regenerated = applySlotRegeneration(factoryRow as unknown as Factory, {
            now,
            balanceMultiplier,
          });
          regeneratedByKey.set(`${factoryRow.x},${factoryRow.y}`, regenerated);
          totalAvailable += Math.max(0, getMaxSlots(regenerated.level || 1) - regenerated.usedSlots);
        }

        if (validated.quantity > totalAvailable) {
          return { ok: false, kind: 'insufficient-slots', available: totalAvailable, needed: validated.quantity };
        }

        // FID-20261002-004 §5.4: re-verify the PERMANENT tier admission against
        // the LOCKED row — a concurrent unlock/spend cannot slip past the
        // pre-transaction gate.
        const lockedTiers = lockedPlayer.unlockedTiers && lockedPlayer.unlockedTiers.length > 0
          ? lockedPlayer.unlockedTiers
          : [UnitTier.Tier1];
        if (!isTierAdmissible(canonicalUnitType, lockedPlayer.level || 1, lockedTiers)) {
          const tierReq = TIER_UNLOCK_REQUIREMENTS[unitConfig.tier];
          return {
            ok: false,
            kind: 'tier-locked' as const,
            tier: unitConfig.tier,
            tierRp: tierReq.rp,
            tierLevel: tierReq.level,
          };
        }

        // Re-validate resources against the LOCKED player row.
        if (lockedPlayer.resourcesMetal < totalMetalCost || lockedPlayer.resourcesEnergy < totalEnergyCost) {
          return {
            ok: false,
            kind: 'insufficient-resources',
            resourceType: lockedPlayer.resourcesMetal < totalMetalCost ? 'metal' : 'energy',
            neededCost: lockedPlayer.resourcesMetal < totalMetalCost ? totalMetalCost : totalEnergyCost,
            have: lockedPlayer.resourcesMetal < totalMetalCost ? lockedPlayer.resourcesMetal : lockedPlayer.resourcesEnergy,
          };
        }

        // Assign units greedily across the regenerated locked factories.
        const newUnits: Array<Record<string, unknown>> = [];
        let remainingUnits = validated.quantity;
        // Track factory slot updates — keyed by the composite PK (x, y); the
        // factories table has no _id column (FID-20260909-023 §3.5). Carries the
        // advanced regen checkpoint and the investedMetal/investedEnergy deltas
        // (FID-20260917-016 D3).
        const factoryUpdates: Array<{ factoryX: number; factoryY: number; newUsedSlots: number; lastSlotRegen: Date; investedMetalDelta: number; investedEnergyDelta: number }> = [];

        for (const factoryRow of lockedFactories) {
          if (remainingUnits <= 0) break;

          const regenerated = regeneratedByKey.get(`${factoryRow.x},${factoryRow.y}`)!;
          const availableInFactory = Math.max(0, getMaxSlots(regenerated.level || 1) - regenerated.usedSlots);
          const unitsToAssignHere = Math.min(remainingUnits, availableInFactory);

          if (unitsToAssignHere > 0) {
            // Create units for this factory — FID-20261002-004 §5.5: canonical
            // minting (blueprint id + canonical unitType stored separately,
            // distinct instance id per entry even within one millisecond).
            for (let i = 0; i < unitsToAssignHere; i++) {
              newUnits.push(
                canonicalPlayerUnitFromConfig(unitConfig, 1, username, {
                  x: factoryRow.x,
                  y: factoryRow.y,
                }) as unknown as Record<string, unknown>,
              );
            }

            // Calculate slots needed using exponential slot cost
            const slotsNeeded = unitsToAssignHere * slotCostPerUnit;

            // Track factory slot update + lifetime investment share
            // (FID-20260917-016 D3: investedMetal/investedEnergy must be maintained
            // at write time per the schema contract — the Mongo path never wrote
            // them; the cost share rides the same update as the slot bump)
            const metalShare = Math.round((totalMetalCost * slotsNeeded) / Math.max(1, totalSlotCostForShares));
            const energyShare = Math.round((totalEnergyCost * slotsNeeded) / Math.max(1, totalSlotCostForShares));
            factoryUpdates.push({
              factoryX: factoryRow.x,
              factoryY: factoryRow.y,
              newUsedSlots: regenerated.usedSlots + slotsNeeded,
              lastSlotRegen: regenerated.lastSlotRegen,
              investedMetalDelta: metalShare,
              investedEnergyDelta: energyShare,
            });

            remainingUnits -= unitsToAssignHere;
          }
        }

        // Calculate new totals — written as relative SQL deltas so concurrent
        // writers compose inside and outside this transaction.
        const strengthGained = unitBlueprint.strength * validated.quantity;
        const defenseGained = unitBlueprint.defense * validated.quantity;
        const newTotalStrength = (lockedPlayer.totalStrength || 0) + strengthGained;
        const newTotalDefense = (lockedPlayer.totalDefense || 0) + defenseGained;

        // Update player in database — pg (FID-20260917-016). N per-unit entries
        // with quantity: 1 (FID-20260909-033 amendment; jsonb || appends every
        // element), resource charge via SQL delta on the real flat columns.
        const updateResult = await tx.update(playersTable).set({
          units: sql`(coalesce(${playersTable.units}, '[]'::jsonb) || ${JSON.stringify(newUnits.map((u) => ({ ...u, quantity: 1 })))}::jsonb)`,
          resourcesMetal: sql`${playersTable.resourcesMetal} - ${totalMetalCost}`,
          resourcesEnergy: sql`${playersTable.resourcesEnergy} - ${totalEnergyCost}`,
          totalStrength: sql`${playersTable.totalStrength} + ${strengthGained}`,
          totalDefense: sql`${playersTable.totalDefense} + ${defenseGained}`,
        }).where(eq(playersTable.username, username)).returning({ username: playersTable.username });

        if (updateResult.length === 0) {
          return { ok: false, kind: 'write-failed' };
        }

        // Per-factory updates over the composite PK (x, y) on the LOCKED rows:
        // reservation + advanced regen checkpoint + investment delta commit
        // with the player write (FID-20260917-016 D3).
        for (const update of factoryUpdates) {
          await tx.update(factoriesTable).set({
            usedSlots: update.newUsedSlots,
            lastSlotRegen: update.lastSlotRegen,
            investedMetal: sql`${factoriesTable.investedMetal} + ${update.investedMetalDelta}`,
            investedEnergy: sql`${factoriesTable.investedEnergy} + ${update.investedEnergyDelta}`,
          }).where(and(eq(factoriesTable.x, update.factoryX), eq(factoriesTable.y, update.factoryY)));
        }

        return {
          ok: true,
          newUnits,
          factoriesUsed: factoryUpdates.length,
          newTotalStrength,
          newTotalDefense,
        };
      })
    );

    if (!buildResult.ok) {
      if (buildResult.kind === 'insufficient-slots') {
        log.warn('Insufficient factory build slots (locked re-check)', {
          username,
          available: buildResult.available,
          needed: buildResult.needed
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Insufficient factory slots (${buildResult.available} available, ${buildResult.needed} needed)`
        });
      }
      if (buildResult.kind === 'insufficient-resources') {
        log.warn('Insufficient resources (locked re-check)', {
          username,
          resourceType: buildResult.resourceType,
          needed: buildResult.neededCost,
          have: buildResult.have
        });
        return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
          resourceType: buildResult.resourceType,
          needed: buildResult.neededCost,
          have: buildResult.have
        });
      }
      if (buildResult.kind === 'tier-locked') {
        log.warn('Tier not unlocked (locked re-check)', {
          username,
          tier: buildResult.tier,
          requiredRp: buildResult.tierRp,
          requiredLevel: buildResult.tierLevel
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Tier ${buildResult.tier} is not unlocked (requires the permanent tier unlock: ${buildResult.tierRp} RP · level ${buildResult.tierLevel}+)`
        });
      }
      log.error('Failed to update player for unit build', new Error('Database update failed'), {
        username: username
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to build units'
      });
    }

    const { newUnits, factoriesUsed, newTotalStrength, newTotalDefense } = buildResult;

    // FID-20260912-070: this route is the unit-factory page's live build path —
    // it never fed the stats tracker, so "Units Built" stayed at 0 forever.
    // FID-20260914-008 Phase 2: passes the blueprint category so doctrine-matching
    // builds earn mastery XP server-side.
    // Post-commit (FID-20261002-002/011): reward failures never retry the build.
    try {
      const { trackUnitBuilt } = await import('@/lib/statTrackingService');
      await trackUnitBuilt(username, validated.quantity, unitBlueprint.category);
    } catch (trackErr) {
      log.warn('Unit-build stat tracking failed (non-fatal)', trackErr instanceof Error ? trackErr : new Error(String(trackErr)));
    }

    log.info('Units built successfully', { 
      username: username, 
      unitType: unitBlueprint.name, 
      quantity: validated.quantity, 
      strengthGained: unitBlueprint.strength * validated.quantity,
      defenseGained: unitBlueprint.defense * validated.quantity,
      factoriesUsed
    });

    // Calculate new factory build slots after updates
    const newFactoryBuildSlots = totalFactoryBuildSlots - validated.quantity;

    // Return success with updated data
    return NextResponse.json({
      success: true,
      message: `Successfully built ${validated.quantity}x ${unitBlueprint.name}!`,
      unitsBuilt: newUnits,
      costPaid: {
        metal: totalMetalCost,
        energy: totalEnergyCost
      },
      newStats: {
        totalStrength: newTotalStrength,
        totalDefense: newTotalDefense,
        resources: {
          metal: playerMetal - totalMetalCost,
          energy: playerEnergy - totalEnergyCost
        },
        usedSlots: (player.units?.length || 0) + validated.quantity,
        availableSlots: (100 + ((player.factoryCount || 0) * 50)),
        factoryBuildSlots: newFactoryBuildSlots
      },
      statsGained: {
        strength: unitBlueprint.strength * validated.quantity,
        defense: unitBlueprint.defense * validated.quantity
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Unit build validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Unit build error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// Implementation Notes:
// - Validates unlock requirements (RP + level)
// - Checks resource availability and slot capacity
// - Creates multiple unit instances for quantity > 1
// - Updates totalStrength/totalDefense immediately
// - FID-20261002-011: same slot accounting as the factory seam — derived
//   capacity, owner-balance regeneration, locked-row reservations
// ============================================================
