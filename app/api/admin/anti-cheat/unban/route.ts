/**
 * @file app/api/admin/anti-cheat/unban/route.ts
 * @created 2026-09-04
 * @overview Account-unban endpoint for the admin PlayerDetailModal (SCOPE #22).
 *
 * Deactivates the player's account-ban rows (bannedBy-scoped — channel bans in the
 * shared `bans` table are untouched) and clears the login gate columns.
 *
 * POST /api/admin/anti-cheat/unban  Body: { username }
 * Admin-only (rank >= 5).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bans, players, modLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authService';
import { generateId } from '@/lib/utils';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminAntiCheatUnbanAPI');
  const endTimer = log.time('anti-cheat-unban');

  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || !adminUser.rank || adminUser.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const body = await request.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    if (!username) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'username is required',
      });
    }

    const [player] = await db.select().from(players).where(eq(players.username, username)).limit(1);
    if (!player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    const now = new Date();

    // Deactivate this player's account-scope ban rows only.
    const accountBans = await db.update(bans)
      .set({ active: 0, isPermanent: 0 })
      .where(eq(bans.username, username))
      .returning({ id: bans.id });

    await db.update(players).set({
      banned: 0,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      banExpiresAt: null,
    }).where(eq(players.username, username));

    await db.insert(modLog).values({
      id: generateId().slice(0, 24),
      moderatorId: adminUser.username.slice(0, 20),
      action: 'UNBAN_PLAYER',
      targetId: username,
      reason: null,
      details: JSON.stringify({ scope: 'account', bansDeactivated: accountBans.length }),
      createdAt: now,
    });

    log.info('Player unbanned', { username, adminUser: adminUser.username, bansDeactivated: accountBans.length });

    return NextResponse.json({
      success: true,
      message: `Unbanned ${username}`,
    });
  } catch (error) {
    log.error('Failed to unban player', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
