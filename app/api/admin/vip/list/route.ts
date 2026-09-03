/**
 * @file app/api/admin/vip/list/route.ts
 * @created 2025-10-19
 * @overview Admin API - List all users with VIP status
 */

import { NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
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
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const allPlayers = await db.select({
      username: players.username,
      email: players.email,
      vip: players.vip,
      vipExpiration: players.vipExpiration,
      createdAt: players.createdAt,
    }).from(players).orderBy(asc(players.username));

    const vipUsers = allPlayers.filter(u => u.vip === 1);

    log.info('VIP users list retrieved', {
      totalUsers: allPlayers.length,
      vipUsers: vipUsers.length,
    });

    return NextResponse.json({
      success: true,
      users: allPlayers.map(player => ({
        username: player.username,
        email: player.email,
        vip: player.vip === 1,
        vipExpiration: player.vipExpiration || null,
        createdAt: player.createdAt || null
      }))
    });

  } catch (error) {
    log.error('Failed to fetch users', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
