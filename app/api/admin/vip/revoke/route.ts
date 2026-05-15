/**
 * @file app/api/admin/vip/revoke/route.ts
 * @created 2025-10-19
 * @updated 2026-05-03 — Migrated to Supabase
 * @updated 2026-05-15 — Added requireAdmin auth + audit logging
 * @overview Admin API - Revoke VIP status from user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
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

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminVIP);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminVIPRevokeAPI');
  const endTimer = log.time('revokeVIP');
  
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = RevokeVIPSchema.parse(body);

    log.debug('VIP revoke request', { 
      adminUsername: auth.username,
      targetUsername: validated.username 
    });

    const supabase = createServiceClient();
    
    const { data: user, error: findError } = await supabase
      .from('players')
      .select('username')
      .eq('username', validated.username)
      .single();

    if (findError || !user) {
      log.warn('User not found for VIP revoke', { username: validated.username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'User not found'
      });
    }

    const { error: updateError } = await supabase
      .from('players')
      .update({
        is_vip: false,
        vip_expiration: null,
        vip_tier: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
      })
      .eq('username', validated.username);

    if (updateError) {
      log.error('Failed to revoke VIP', new Error('Database update failed'), { 
        username: validated.username 
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to revoke VIP'
      });
    }

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'VIP_REVOKE',
      target: validated.username,
      details: {
        revokedAt: new Date().toISOString(),
      }
    });

    log.info('VIP revoked successfully', { 
      adminUsername: auth.username,
      targetUsername: validated.username 
    });

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
