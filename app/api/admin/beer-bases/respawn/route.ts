/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-25 (FID-20251025-001: Smart Beer Base Spawning + Admin Integration)
 * 🎯 OVERVIEW:
 * Beer Base Respawn Admin Endpoint
 * 
 * Allows administrators to manually trigger Beer Base respawn.
 * Uses the NEW Beer Base service (player documents with isSpecialBase flag).
 * 
 * POST /api/admin/beer-bases/respawn
 * Rate Limited: 30 req/hour (admin bot management)
 * - Requires admin access (isAdmin: true)
 * - Returns count of Beer Bases created
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { manualBeerBaseRespawn } from '@/lib/beerBaseService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('AdminBeerBaseRespawnAPI');
  const endTimer = log.time('beer-base-respawn');

  try {
    // Admin authentication check
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    // Trigger manual Beer Base respawn using NEW service
    const result = await manualBeerBaseRespawn();

    if (!result.success) {
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Beer Base respawn failed',
      });
    }

    log.info('Beer bases respawned successfully', {
      removed: result.removed,
      spawned: result.spawned,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      count: result.spawned,
      removed: result.removed,
      message: `Respawned ${result.spawned} Beer Bases (removed ${result.removed} old ones)`
    });

  } catch (error) {
    log.error('Failed to respawn beer bases', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Uses NEW Beer Base service (player documents with isSpecialBase: true)
 * - Removes all existing Beer Bases and spawns fresh ones
 * - Smart spawning: Analyzes active player levels to spawn appropriate tiers
 * - Respects Beer Base config from gameConfig collection
 * - Admin can trigger at any time (not just Sunday 4 AM)
 * 
 * 🔐 SECURITY:
 * - Admin-only access (isAdmin: true required)
 * - Validates user authentication
 * - Rate limited to prevent abuse
 * 
 * 🚀 FUTURE ENHANCEMENTS:
 * - Preview mode (show what would be spawned without spawning)
 * - Partial respawn (spawn only deficit, don't delete existing)
 * - Tier-specific respawn (respawn only certain power tiers)
 * - Scheduled respawn trigger (admin can schedule future respawns)
 */
