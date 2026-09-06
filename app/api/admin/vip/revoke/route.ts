/**
 * @file app/api/admin/vip/revoke/route.ts
 * @created 2025-10-19
 * @overview Admin API - Revoke VIP status from user
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players, modLog } from '@/lib/db/schema';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  RevokeVIPSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';
import { requireAdmin } from '@/lib/authMiddleware';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminVIPRevoke);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminVIPRevokeAPI');
  const endTimer = log.time('revokeVIP');
  
  try {
    // FID-20260904-005 §5.1: admin-only (TODO placeholder removed).
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const body = await request.json();
    const validated = RevokeVIPSchema.parse(body);

    log.debug('VIP revoke request', { username: validated.username });

    const userRecord = await db.select().from(players).where(eq(players.username, validated.username)).limit(1);
    if (!userRecord || userRecord.length === 0) {
      log.warn('User not found for VIP revoke', { username: validated.username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'User not found'
      });
    }

    // Remove VIP status - set VIP fields to null instead of $unset
    await db.update(players)
      .set({
        vip: 0,
        vipExpiration: null,
        vipTier: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null
      })
      .where(eq(players.username, validated.username));

    // FID-20260905-001 B3: real audit row (was a TODO — money-adjacent action with no trail).
    await db.insert(modLog).values({
      moderatorId: adminAuth.username.slice(0, 20),
      action: 'VIP_REVOKE',
      targetId: validated.username.slice(0, 24),
      reason: 'VIP revoked by admin',
      createdAt: new Date(),
    });

    log.info('VIP revoked successfully', { username: validated.username });

    return NextResponse.json({
      success: true,
      message: `VIP revoked from ${validated.username}`
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('VIP revoke validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Error revoking VIP', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
