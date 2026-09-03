/**
 * @file app/api/tier/unlock/route.ts
 * @created 2025-10-17
 * @overview API endpoint for unlocking unit tiers with Research Points
 * 
 * OVERVIEW:
 * POST endpoint for spending RP to unlock higher unit tiers. Validates player
 * level requirements, RP availability, and prevents duplicate unlocks.
 * 
 * REQUEST BODY:
 * {
 *   "tier": number  // Tier to unlock (2-5, Tier 1 is always unlocked)
 * }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Tier 2 unlocked! You can now build advanced units.",
 *   "tierUnlocked": 2,
 *   "rpSpent": 5,
 *   "rpRemaining": 0,
 *   "unlockedTiers": [1, 2]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { unlockTier, getTierUnlockStatus } from '@/lib/tierUnlockService';
import { UnitTier } from '@/types';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  UnlockTierSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.TIER_UNLOCK);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('TierUnlockAPI');
  const endTimer = log.time('unlockTier');

  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated tier unlock attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required'
      });
    }

    const username = authResult.username;

    // Parse and validate request body
    const body = await request.json();
    const validated = UnlockTierSchema.parse(body);

    log.debug('Tier unlock request', { username, tier: validated.tier });

    // Tier 1 is always unlocked
    if (validated.tier === 1) {
      log.debug('Attempt to unlock Tier 1', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Tier 1 is already unlocked by default'
      });
    }

    // Attempt to unlock tier
    const result = await unlockTier(username, validated.tier as UnitTier);

    if (!result.success) {
      log.debug('Tier unlock failed', { 
        username, 
        tier: validated.tier, 
        reason: result.message 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: result.message
      });
    }

    log.info('Tier unlocked successfully', { 
      username, 
      tier: validated.tier,
      rpSpent: result.rpSpent,
      rpRemaining: result.rpRemaining
    });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Tier unlock validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Tier unlock error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * GET /api/tier/unlock
 * Get player's tier unlock status
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const username = authResult.username;

    // Get tier unlock status
    const status = await getTierUnlockStatus(username);

    return NextResponse.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Get tier status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching tier status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
