import { NextRequest, NextResponse } from 'next/server';
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
  ErrorCode,
  logger
} from '@/lib';
import { ZodError } from 'zod';
import { requireAuth } from '@/lib/authMiddleware';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.TIER_UNLOCK);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('TierUnlockAPI');
  const endTimer = log.time('unlockTier');

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const body = await request.json();
    const validated = UnlockTierSchema.parse(body);

    log.debug('Tier unlock request', { username, tier: validated.tier });

    if (validated.tier === 1) {
      log.debug('Attempt to unlock Tier 1', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Tier 1 is already unlocked by default'
      });
    }

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const status = await getTierUnlockStatus(username);

    return NextResponse.json({
      success: true,
      tiers: status.availableTiers,
      playerLevel: status.playerLevel,
      currentRP: status.currentRP,
      unlockedTiers: status.unlockedTiers,
    });

  } catch (error) {
    logger.error('Get tier status error:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}
