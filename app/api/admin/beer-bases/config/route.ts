/**
 * @file app/api/admin/beer-bases/config/route.ts
 * @created 2025-10-25
 * @overview Beer Base Configuration Admin Endpoint
 * 
 * OVERVIEW:
 * Allows administrators to view and update Beer Base system configuration.
 * Controls spawn rates, resource multipliers, respawn schedule, and enable/disable.
 * 
 * GET  /api/admin/beer-bases/config - View current config
 * POST /api/admin/beer-bases/config - Update config
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { getBeerBaseConfig, updateBeerBaseConfig, BeerBaseConfig } from '@/lib/beerBaseService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/**
 * GET /api/admin/beer-bases/config
 * Returns current Beer Base configuration
 * 
 * Response:
 * {
 *   success: true,
 *   config: {
 *     spawnRateMin: 5,
 *     spawnRateMax: 10,
 *     resourceMultiplier: 3,
 *     respawnDay: 0,
 *     respawnHour: 4,
 *     enabled: true
 *   }
 * }
 */
export const GET = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('AdminBeerBaseConfigGetAPI');
  const endTimer = log.time('get-beer-base-config');

  try {
    // Admin authentication check
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    // Get current config
    const config = await getBeerBaseConfig();

    log.info('Beer Base config retrieved', {
      adminUser: user.username,
      enabled: config.enabled,
      spawnRate: `${config.spawnRateMin}-${config.spawnRateMax}%`,
    });

    return NextResponse.json({
      success: true,
      config,
    });

  } catch (error) {
    log.error('Failed to get Beer Base config', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/admin/beer-bases/config
 * Updates Beer Base configuration
 * 
 * Request body:
 * {
 *   spawnRateMin?: number,    // 0-100 (percentage)
 *   spawnRateMax?: number,    // 0-100 (percentage)
 *   resourceMultiplier?: number, // 1-20 (multiplier)
 *   respawnDay?: number,      // 0-6 (0=Sunday)
 *   respawnHour?: number,     // 0-23 (hour)
 *   enabled?: boolean         // true/false
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Beer Base config updated",
 *   config: { ... }
 * }
 */
export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('AdminBeerBaseConfigPostAPI');
  const endTimer = log.time('post-beer-base-config');

  try {
    // Admin authentication check
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const updates: Partial<BeerBaseConfig> = {};

    // Validate and sanitize inputs
    if (body.spawnRateMin !== undefined) {
      const val = Number(body.spawnRateMin);
      if (isNaN(val) || val < 0 || val > 100) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'spawnRateMin must be between 0 and 100',
        });
      }
      updates.spawnRateMin = val;
    }

    if (body.spawnRateMax !== undefined) {
      const val = Number(body.spawnRateMax);
      if (isNaN(val) || val < 0 || val > 100) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'spawnRateMax must be between 0 and 100',
        });
      }
      updates.spawnRateMax = val;
    }

    if (body.resourceMultiplier !== undefined) {
      const val = Number(body.resourceMultiplier);
      if (isNaN(val) || val < 1 || val > 20) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'resourceMultiplier must be between 1 and 20',
        });
      }
      updates.resourceMultiplier = val;
    }

    if (body.respawnDay !== undefined) {
      const val = Number(body.respawnDay);
      if (isNaN(val) || val < 0 || val > 6) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'respawnDay must be between 0 (Sunday) and 6 (Saturday)',
        });
      }
      updates.respawnDay = val;
    }

    if (body.respawnHour !== undefined) {
      const val = Number(body.respawnHour);
      if (isNaN(val) || val < 0 || val > 23) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'respawnHour must be between 0 and 23',
        });
      }
      updates.respawnHour = val;
    }

    if (body.enabled !== undefined) {
      updates.enabled = Boolean(body.enabled);
    }

    // Variety Settings (FID-20251025-001)
    if (body.varietyEnabled !== undefined) {
      updates.varietyEnabled = Boolean(body.varietyEnabled);
    }

    if (body.minWeakPercent !== undefined) {
      const val = Number(body.minWeakPercent);
      if (isNaN(val) || val < 0 || val > 100) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'minWeakPercent must be between 0 and 100',
        });
      }
      updates.minWeakPercent = val;
    }

    if (body.minMediumPercent !== undefined) {
      const val = Number(body.minMediumPercent);
      if (isNaN(val) || val < 0 || val > 100) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'minMediumPercent must be between 0 and 100',
        });
      }
      updates.minMediumPercent = val;
    }

    if (body.minStrongPercent !== undefined) {
      const val = Number(body.minStrongPercent);
      if (isNaN(val) || val < 0 || val > 100) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'minStrongPercent must be between 0 and 100',
        });
      }
      updates.minStrongPercent = val;
    }

    if (body.minElitePercent !== undefined) {
      const val = Number(body.minElitePercent);
      if (isNaN(val) || val < 0 || val > 100) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'minElitePercent must be between 0 and 100',
        });
      }
      updates.minElitePercent = val;
    }

    if (body.maxSameTierPercent !== undefined) {
      const val = Number(body.maxSameTierPercent);
      if (isNaN(val) || val < 0 || val > 100) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'maxSameTierPercent must be between 0 and 100',
        });
      }
      updates.maxSameTierPercent = val;
    }

    // Dynamic Schedules (FID-20251025-003)
    if (body.schedulesEnabled !== undefined) {
      updates.schedulesEnabled = Boolean(body.schedulesEnabled);
    }

    // Validate min <= max if both provided
    if (updates.spawnRateMin !== undefined || updates.spawnRateMax !== undefined) {
      const currentConfig = await getBeerBaseConfig();
      const newMin = updates.spawnRateMin ?? currentConfig.spawnRateMin;
      const newMax = updates.spawnRateMax ?? currentConfig.spawnRateMax;
      
      if (newMin > newMax) {
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, {
          message: 'spawnRateMin cannot be greater than spawnRateMax',
        });
      }
    }

    // Update config
    await updateBeerBaseConfig(updates);

    // Get updated config
    const config = await getBeerBaseConfig();

    log.info('Beer Base config updated', {
      adminUser: user.username,
      updates: Object.keys(updates),
      newConfig: config,
    });

    return NextResponse.json({
      success: true,
      message: 'Beer Base configuration updated successfully',
      config,
    });

  } catch (error) {
    log.error('Failed to update Beer Base config', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * ADMIN CONTROLS:
 * - spawnRateMin/Max: Controls what % of bots become Beer Bases (default 5-10%)
 * - resourceMultiplier: Boost loot rewards (default 3x, range 1-20x)
 * - respawnDay: Day of week for weekly respawn (0=Sunday, 6=Saturday)
 * - respawnHour: Hour of day for weekly respawn (0-23, default 4 AM)
 * - enabled: Master switch to enable/disable Beer Base spawning
 * 
 * VALIDATION:
 * - All numeric inputs validated for safe ranges
 * - Min/max spawn rates validated for logical order
 * - Changes immediately affect next spawn cycle
 * 
 * INTEGRATION:
 * - Config stored in gameConfig collection (type: 'beerBase')
 * - Used by beerBaseService.ts for all spawning logic
 * - Admin panel can read/write via this API
 * 
 * FUTURE ENHANCEMENTS:
 * - Per-tier spawn rate controls
 * - Custom power tier distributions
 * - Scheduled respawn overrides
 * - Event-based Beer Base bonuses
 */
