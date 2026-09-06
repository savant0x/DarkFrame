/**
 * @file app/api/admin/vip/grant/route.ts
 * @created 2025-10-19
 * @overview Admin API - Grant VIP status to user
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
  GrantVIPSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';
import { requireAdmin } from '@/lib/authMiddleware';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminVIPGrant);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminVIPGrantAPI');
  const endTimer = log.time('grantVIP');
  
  try {
    // FID-20260904-005 §5.1: admin-only (TODO placeholder removed).
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const body = await request.json();
    const validated = GrantVIPSchema.parse(body);

    log.debug('VIP grant request', { 
      username: validated.username, 
      days: validated.days 
    });

    const userRecord = await db.select().from(players).where(eq(players.username, validated.username)).limit(1);
    if (!userRecord || userRecord.length === 0) {
      log.warn('User not found for VIP grant', { username: validated.username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'User not found'
      });
    }

    const now = Date.now();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const expirationTime = new Date(now + (validated.days * millisecondsPerDay));

    await db.update(players)
      .set({
        vip: 1,
        vipExpiration: expirationTime
      })
      .where(eq(players.username, validated.username));

    // FID-20260905-001 B3: real audit row (was a TODO — money-adjacent action with no trail).
    // mod_log.id's $defaultFn supplies the 24-char PK; action ≤ varchar(50).
    await db.insert(modLog).values({
      moderatorId: adminAuth.username.slice(0, 20),
      action: 'VIP_GRANT',
      targetId: validated.username.slice(0, 24),
      reason: `VIP granted for ${validated.days} day(s)`,
      details: JSON.stringify({ days: validated.days, expiresAt: expirationTime.toISOString() }),
      createdAt: new Date(),
    });

    log.info('VIP granted successfully', { 
      username: validated.username, 
      days: validated.days,
      expiresAt: expirationTime.toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `VIP granted to ${validated.username} for ${validated.days} days`,
      expiresAt: expirationTime.toISOString()
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('VIP grant validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Error granting VIP', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
