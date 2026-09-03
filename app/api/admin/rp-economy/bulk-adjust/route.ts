/**
 * @file app/api/admin/rp-economy/bulk-adjust/route.ts
 * @created 2025-10-20
 * @overview API endpoint for bulk RP adjustments
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { awardRP, spendRP } from '@/lib/researchPointService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

/**
 * POST /api/admin/rp-economy/bulk-adjust
 * Bulk adjust player RP balance (add or remove)
 */
export const POST = withRequestLogging(postRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/bulk-adjust');
  const endTimer = log.time('bulk-adjust-rp');

  try {
    // Verify admin authentication
    const adminUser = await getAuthenticatedUser();
    if (!adminUser?.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const body = await request.json();
    const { username, amount, reason, adminUsername } = body;

    if (!username || amount === 0 || !reason) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username, amount, and reason required');
    }

    let result;
    
    if (amount > 0) {
      // Add RP
      result = await awardRP(
        username,
        amount,
        'admin',
        `${reason} (by ${adminUsername || adminUser.username})`,
        { adminUser: adminUsername || adminUser.username }
      );
    } else {
      // Remove RP
      result = await spendRP(
        username,
        Math.abs(amount),
        `${reason} (by ${adminUsername || adminUser.username})`
      );
    }

    if (!result.success) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, result.message);
    }

    log.info('RP adjustment completed', {
      username,
      amount,
      newBalance: result.newBalance,
      adminUser: adminUsername || adminUser.username,
    });

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      message: `Successfully adjusted ${username}'s RP by ${amount}`
    });

  } catch (error) {
    log.error('Failed to adjust RP', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
