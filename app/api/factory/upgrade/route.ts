/**
 * Factory Upgrade API Endpoint
 * Created: 2025-10-17
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
 *   "newStats": {
 *     "maxSlots": number,
 *     "regenRate": number
 *   },
 *   "playerResources": {
 *     "metal": number,
 *     "energy": number
 *   }
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
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { Factory } from '@/types';
import {
  calculateUpgradeCost,
  getFactoryStats,
  getMaxSlots,
  canUpgradeFactory,
  getFactoryDefense,
  FACTORY_UPGRADE
} from '@/lib/factoryUpgradeService';
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
    // Parse and validate request body
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const body = await request.json();
    const validated = FactoryUpgradeSchema.parse(body);

    log.debug('Factory upgrade request', { 
      username, 
      factoryX: validated.factoryX, 
      factoryY: validated.factoryY 
    });

    const supabase = createServiceClient();

    // Find the factory
    const { data: factory, error: factoryError } = await supabase
      .from('factories')
      .select('*')
      .eq('x', validated.factoryX)
      .eq('y', validated.factoryY)
      .single();

    if (factoryError || !factory) {
      log.warn('Factory not found', { 
        username, 
        x: validated.factoryX, 
        y: validated.factoryY 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Factory not found at these coordinates'
      });
    }

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
    const currentLevel = (factory.level as number) || 1;

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

    // Get player's current resources
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('resources_metal, resources_energy')
      .eq('username', username)
      .single();

    if (playerError || !player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    const playerMetal = (player.resources_metal as number) || 0;
    const playerEnergy = (player.resources_energy as number) || 0;

    // Calculate upgrade cost
    const upgradeCost = calculateUpgradeCost(currentLevel);

    // Check if player can afford upgrade
    const affordabilityCheck = canUpgradeFactory(
      { ...factory, level: currentLevel } as unknown as Factory,
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
    const now = new Date().toISOString();

    // Update player resources
    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        resources_metal: playerMetal - upgradeCost.metal,
        resources_energy: playerEnergy - upgradeCost.energy
      })
      .eq('username', username);

    if (playerUpdateError) {
      log.error('Failed to deduct resources', new Error('Database update failed'), { username });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to deduct resources'
      });
    }

    // Update factory level and stats
    const { error: factoryUpdateError } = await supabase
      .from('factories')
      .update({
        level: newLevel,
        slots: getMaxSlots(newLevel),
        defense: getFactoryDefense(newLevel),
        last_slot_regen: now
      })
      .eq('x', validated.factoryX)
      .eq('y', validated.factoryY);

    if (factoryUpdateError) {
      // Rollback: refund resources
      await supabase
        .from('players')
        .update({
          resources_metal: playerMetal,
          resources_energy: playerEnergy
        })
        .eq('username', username);

      log.error('Failed to upgrade factory', new Error('Database update failed'), { 
        username, 
        factoryLocation: `(${validated.factoryX}, ${validated.factoryY})` 
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to upgrade factory'
      });
    }

    // Fetch updated factory
    const { data: updatedFactory } = await supabase
      .from('factories')
      .select('*')
      .eq('x', validated.factoryX)
      .eq('y', validated.factoryY)
      .single();

    // Fetch updated player resources
    const { data: updatedPlayer } = await supabase
      .from('players')
      .select('resources_metal, resources_energy')
      .eq('username', username)
      .single();

    // Award XP for factory upgrade
    const xpResult = await awardXP(username, XPAction.FACTORY_UPGRADE);

    log.info('Factory upgraded successfully', { 
      username, 
      newLevel, 
      factoryLocation: `(${validated.factoryX}, ${validated.factoryY})`,
      cost: upgradeCost 
    });

    return NextResponse.json({
      success: true,
      message: `Factory upgraded to Level ${newLevel}!`,
      factory: updatedFactory,
      cost: upgradeCost,
      newStats: {
        maxSlots: newStats.maxSlots,
        regenRate: newStats.regenRate
      },
      playerResources: {
        metal: (updatedPlayer?.resources_metal as number) || 0,
        energy: (updatedPlayer?.resources_energy as number) || 0
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
 *    - Player resources deducted first
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
