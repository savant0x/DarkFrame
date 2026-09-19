/**
 * Factory Upgrade API Endpoint
 * Created: 2025-10-17
 * Rewritten: 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * POST endpoint for upgrading a player-owned factory. Validates ownership,
 * level constraints, resource availability, and applies exponential cost
 * formula. Upgrades factory level and increases max slots/regen rate.
 *
 * REQUEST BODY:
 * {
 *   "factoryX": number,      // Factory X coordinate
 *   "factoryY": number       // Factory Y coordinate
 * }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Factory upgraded to Level X",
 *   "factory": Factory,      // Updated factory data
 *   "cost": UpgradeCost,     // Resources spent
 *   "newStats": { "maxSlots": number, "regenRate": number },
 *   "playerResources": { "metal": number, "energy": number }
 * }
 *
 * VALIDATION:
 * - User must be authenticated
 * - Factory must exist at coordinates
 * - Factory must be owned by user
 * - Factory must be below max level (10)
 * - Player must have sufficient resources
 *
 * COST FORMULA:
 * Metal = 1000 × (1.5^nextLevel)
 * Energy = 500 × (1.5^nextLevel)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logFactory } from '@/lib/activityLogger';
import { verifyAuth } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { factories, players } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import {
  calculateUpgradeCost,
  getFactoryStats,
  canUpgradeFactory,
  getFactoryDefense,
  getMaxSlots,
  getProductionRate,
  FACTORY_UPGRADE
} from '@/lib/factoryUpgradeService';
import { Factory } from '@/types/game.types';
import { awardXP, XPAction } from '@/lib/xpService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  FactoryUpgradeSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.factoryBuild);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('FactoryUpgradeAPI');
  const endTimer = log.time('upgradeFactory');

  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated factory upgrade attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const username = authResult.username;

    // Parse and validate request body
    const body = await request.json();
    const validated = FactoryUpgradeSchema.parse(body);

    log.debug('Factory upgrade request', {
      username,
      factoryX: validated.factoryX,
      factoryY: validated.factoryY
    });

    // Find the factory (direct pg read)
    const factoryRows = (await db
      .select()
      .from(factories)
      .where(and(eq(factories.x, validated.factoryX), eq(factories.y, validated.factoryY)))
      .limit(1)) as unknown as Factory[];

    if (factoryRows.length === 0) {
      log.warn('Factory not found', {
        username,
        x: validated.factoryX,
        y: validated.factoryY
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Factory not found at these coordinates'
      });
    }
    const factory = factoryRows[0];

    // Verify ownership
    if (factory.owner !== username) {
      log.warn('Factory ownership violation', {
        username,
        owner: factory.owner,
        location: `(${validated.factoryX}, ${validated.factoryY})`
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'You do not own this factory'
      });
    }

    // Initialize level if missing (backwards compatibility)
    const currentLevel = factory.level || 1;

    // Check if already at max level
    if (currentLevel >= FACTORY_UPGRADE.MAX_LEVEL) {
      log.warn('Factory already at max level', {
        username,
        currentLevel,
        maxLevel: FACTORY_UPGRADE.MAX_LEVEL
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: `Factory is already at maximum level (${FACTORY_UPGRADE.MAX_LEVEL})`
      });
    }

    // Get player's current resources (direct pg read over flat columns)
    const [player] = await db
      .select({
        resourcesMetal: players.resourcesMetal,
        resourcesEnergy: players.resourcesEnergy,
      })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    const playerMetal = player.resourcesMetal || 0;
    const playerEnergy = player.resourcesEnergy || 0;

    // Calculate upgrade cost
    const upgradeCost = calculateUpgradeCost(currentLevel);

    // Check if player can afford upgrade
    const affordabilityCheck = canUpgradeFactory(
      { ...factory, level: currentLevel },
      playerMetal,
      playerEnergy
    );

    if (!affordabilityCheck.canUpgrade) {
      log.warn('Insufficient resources for upgrade', {
        username,
        cost: upgradeCost,
        playerResources: { metal: playerMetal, energy: playerEnergy }
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: affordabilityCheck.reason || 'Cannot upgrade factory',
        cost: upgradeCost,
        playerResources: { metal: playerMetal, energy: playerEnergy }
      });
    }

    // Calculate new stats for next level
    const newLevel = currentLevel + 1;
    const newStats = getFactoryStats(newLevel);

    // Perform atomic update: deduct resources and upgrade factory
    const now = new Date();

    // Update player resources (SQL delta — composes under concurrency)
    const playerUpdated = await db
      .update(players)
      .set({
        resourcesMetal: sql`${players.resourcesMetal} - ${upgradeCost.metal}`,
        resourcesEnergy: sql`${players.resourcesEnergy} - ${upgradeCost.energy}`,
      })
      .where(eq(players.username, username))
      .returning({ username: players.username });

    if (playerUpdated.length === 0) {
      log.error('Failed to deduct resources', new Error('Database update failed'), { username });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to deduct resources'
      });
    }

    // FID-072: write the FULL stat block for the new level. The old write
    // set only touched level+defense, leaving the `slots` column (used as
    // build-unit's enforcement source) and productionRate frozen at L1 — the
    // "Factory Status shows base metrics" bug. Capacity rises without
    // touching usedSlots (only the ceiling moves).
    const factoryUpdated = await db
      .update(factories)
      .set({
        level: newLevel,
        defense: getFactoryDefense(newLevel),
        slots: getMaxSlots(newLevel),
        productionRate: String(getProductionRate(newLevel)),
        lastSlotRegen: now, // Reset regen timer for new rate
        // FID-20260909-032 §7: exact lifetime investment at write time.
        investedMetal: sql`${factories.investedMetal} + ${upgradeCost.metal}`,
        investedEnergy: sql`${factories.investedEnergy} + ${upgradeCost.energy}`,
      })
      .where(and(eq(factories.x, validated.factoryX), eq(factories.y, validated.factoryY)))
      .returning({ x: factories.x });

    if (factoryUpdated.length === 0) {
      // Rollback: refund resources
      await db
        .update(players)
        .set({
          resourcesMetal: sql`${players.resourcesMetal} + ${upgradeCost.metal}`,
          resourcesEnergy: sql`${players.resourcesEnergy} + ${upgradeCost.energy}`,
        })
        .where(eq(players.username, username));

      log.error('Failed to upgrade factory', new Error('Database update failed'), {
        username,
        factoryLocation: `(${validated.factoryX}, ${validated.factoryY})`
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to upgrade factory'
      });
    }

    // Fetch updated factory
    const updatedFactoryRows = (await db
      .select()
      .from(factories)
      .where(and(eq(factories.x, validated.factoryX), eq(factories.y, validated.factoryY)))
      .limit(1)) as unknown as Factory[];

    // Fetch updated player resources
    const [updatedPlayer] = await db
      .select({
        resourcesMetal: players.resourcesMetal,
        resourcesEnergy: players.resourcesEnergy,
      })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    // Award XP for factory upgrade
    const xpResult = await awardXP(username, XPAction.FACTORY_UPGRADE);

    // FID-20260909-029 §2.4: anti-cheat telemetry (was: logger defined,
    // never wired). Logging failures are swallowed inside the logger.
    await logFactory(
      username,
      request.cookies.get('sessionId')?.value || 'unknown',
      true,
      newLevel,
      { x: validated.factoryX, y: validated.factoryY },
      upgradeCost
    );

    log.info('Factory upgraded successfully', {
      username,
      newLevel,
      factoryLocation: `(${validated.factoryX}, ${validated.factoryY})`,
      cost: upgradeCost
    });

    return NextResponse.json({
      success: true,
      message: `Factory upgraded to Level ${newLevel}!`,
      factory: updatedFactoryRows[0],
      cost: upgradeCost,
      newStats: {
        maxSlots: newStats.maxSlots,
        regenRate: newStats.regenRate
      },
      playerResources: {
        metal: updatedPlayer?.resourcesMetal || 0,
        energy: updatedPlayer?.resourcesEnergy || 0
      },
      xpAwarded: xpResult.xpAwarded,
      levelUp: xpResult.levelUp,
      newLevel: xpResult.newLevel
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Factory upgrade validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Factory upgrade error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. Atomic Updates:
 *    - Player resources deducted first (SQL delta)
 *    - Factory level incremented second
 *    - Rollback on factory update failure
 *
 * 2. Backwards Compatibility:
 *    - Treats missing level field as Level 1
 *    - Allows gradual migration of existing factories
 *
 * 3. Slot Management:
 *    - Max capacity increases automatically (formula-based)
 *    - Current slots unchanged (player keeps existing slots)
 *    - Regen timer reset for new regeneration rate
 *
 * 4. Error Handling:
 *    - Clear error messages for each validation failure
 *    - Returns cost and player resources on affordability errors
 *    - Rollback mechanism prevents partial updates
 *
 * 5. Response Data:
 *    - Includes updated factory with new level
 *    - Shows cost paid and new stats preview
 *    - Returns updated player resources for UI refresh
 */
