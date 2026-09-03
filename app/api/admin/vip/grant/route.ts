/**
 * @file app/api/admin/vip/grant/route.ts
 * @created 2025-10-19
 * @overview Admin API - Grant VIP status to user
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
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

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminVIPGrant);

export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  const log = createRouteLogger('AdminVIPGrantAPI');
  const endTimer = log.time('grantVIP');
  
  try {
    const body = await request.json();
    const validated = GrantVIPSchema.parse(body);

    // TODO: Add admin authentication check
    // const adminUsername = request.headers.get('x-admin-username');
    // if (!await isAdmin(adminUsername)) {
    //   return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    // }

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

    // TODO: Log VIP grant in analytics
    // await logVIPGrant({ username, days, grantedBy: adminUsername, grantedAt: new Date() });

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
