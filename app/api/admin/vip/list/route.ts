/**
 * @file app/api/admin/vip/list/route.ts
 * @created 2025-10-19
 * @updated 2026-05-03 — Migrated to Supabase
 * @overview Admin API - List all users with VIP status
 */

import { requireAuth } from '@/lib/authMiddleware';
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
    const { searchParams } = request.nextUrl;
    const username = searchParams.get('username');
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }
    
    const { data: users, error } = await supabase
      .from('players')
      .select('username, email, is_vip, vip_expiration, created_at')
      .order('username');

    if (error) throw error;

    const vipUsers = (users || []).filter(u => u.is_vip);

    log.info('VIP users list retrieved', {
      totalUsers: (users || []).length,
      vipUsers: vipUsers.length,
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
