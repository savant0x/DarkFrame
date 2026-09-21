/**
 * FID-20260919-015 W2: GET /api/shrine/blessings
 *
 * The player's persistent blessing ledger — every boost grant/extension the
 * shrine recorded. The players.shrine_boosts jsonb only ever holds the
 * current expiry per tier; this is the history surface ShrinePanel renders.
 */
import { NextResponse } from 'next/server';

import { verifyAuth } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode
} from '@/lib';
import { getBlessingHistory } from '@/lib/shrineBlessingService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.SHRINE_SACRIFICE);

export const GET = withRequestLogging(rateLimiter(async () => {
  const log = createRouteLogger('ShrineBlessingsAPI');
  try {
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required'
      });
    }

    const blessings = await getBlessingHistory(authResult.username, 20);
    return NextResponse.json({
      success: true,
      blessings: blessings.map((b) => ({
        tier: b.tier,
        yieldBonus: b.yieldBonus,
        expiresAt: b.expiresAt instanceof Date ? b.expiresAt.toISOString() : b.expiresAt,
        createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
      })),
    });
  } catch (error) {
    log.error('Error fetching shrine blessings:', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
