/**
 * @file app/api/admin/vip/list/route.ts
 * @created 2025-10-19
 * @updated 2026-05-15 — Fixed auth bypass: use requireAdminAuth instead of self-check
 * @overview Admin API - List all users with VIP status
 */

import { requireAdminAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/vip/list');
  const endTimer = log.time('list-vip-users');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    
    const { data: users, error } = await supabase
      .from('players')
      .select('username, email, is_vip, vip_expiration, created_at')
      .eq('is_vip', true)
      .order('username');

    if (error) throw error;

    log.info('VIP users list retrieved', {
      vipUsers: (users || []).length,
    });

    return NextResponse.json({
      success: true,
      users: (users || []).map(user => ({
        username: user.username,
        email: user.email,
        vip: user.is_vip || false,
        vipExpiration: user.vip_expiration || null,
        createdAt: user.created_at || null
      }))
    });

  } catch (error) {
    log.error('Failed to fetch users', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
