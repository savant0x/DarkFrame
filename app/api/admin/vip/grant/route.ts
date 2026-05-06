/**
 * @file app/api/admin/vip/grant/route.ts
 * @created 2025-10-19
 * @updated 2026-05-03 — Migrated to Supabase
 * @overview Admin API - Grant VIP status to user
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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

    log.debug('VIP grant request', { 
      username: validated.username, 
      days: validated.days 
    });

    const supabase = createServiceClient();
    
    const { data: user, error: findError } = await supabase
      .from('players')
      .select('username')
      .eq('username', validated.username)
      .single();

    if (findError || !user) {
      log.warn('User not found for VIP grant', { username: validated.username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'User not found'
      });
    }

    const now = new Date();
    const expirationDate = new Date(now.getTime() + validated.days * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from('players')
      .update({
        is_vip: true,
        vip_expiration: expirationDate.toISOString(),
        vip_last_updated: now.toISOString(),
      })
      .eq('username', validated.username);

    if (updateError) {
      log.error('Failed to grant VIP', new Error('Database update failed'), { 
        username: validated.username 
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to grant VIP'
      });
    }

    log.info('VIP granted successfully', { 
      username: validated.username, 
      days: validated.days,
      expiresAt: expirationDate.toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `VIP granted to ${validated.username} for ${validated.days} days`,
      expiresAt: expirationDate.toISOString()
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
