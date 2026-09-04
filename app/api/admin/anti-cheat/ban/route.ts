/**
 * @file app/api/admin/anti-cheat/ban/route.ts
 * @created 2026-09-04
 * @overview Account-ban endpoint for the admin PlayerDetailModal (SCOPE #22).
 *
 * Rebuild of the Mongo-pivot-era endpoint. The `bans` table is SHARED with
 * lib/moderationService's channel bans — account-ban rows are distinguished by
 * `bannedBy` being set (channel rows have moderatorId=channelId, bannedBy NULL).
 * The ban is enforced at login via the `players.banned` gate columns.
 *
 * POST /api/admin/anti-cheat/ban  Body: { username, reason }
 * Admin-only (rank >= 5). Modal prompt supplies the reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bans, players, modLog } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
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
  const log = createRouteLogger('AdminAntiCheatBanAPI');
  const endTimer = log.time('anti-cheat-ban');

  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || !adminUser.rank || adminUser.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const body = await request.json().catch(() => null);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

    if (!username) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'username is required',
      });
    }
    if (reason.length < 3) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Ban reason is required (min 3 characters)',
      });
    }

    const [player] = await db.select().from(players).where(eq(players.username, username)).limit(1);
    if (!player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }
    if ((player.rank ?? 0) >= 5) {
      return createErrorResponse(ErrorCode.ADMIN_CANNOT_BAN_ADMIN, {
        message: 'Cannot ban admin accounts',
        username,
      });
    }

    const now = new Date();

    // Ban record (account scope: bannedBy set; permanent — no expiry from this route)
    await db.insert(bans).values({
      id: generateId().slice(0, 24),
      playerId: username,
      moderatorId: adminUser.username.slice(0, 20),
      reason,
      expiresAt: null,
      createdAt: now,
      username,
      bannedBy: adminUser.username.slice(0, 20),
      bannedAt: now,
      isPermanent: 1,
      active: 1,
    });

    // Gate columns on the player account (read by /api/auth/login)
    await db.update(players).set({
      banned: 1,
      banReason: reason,
      bannedAt: now,
      bannedBy: adminUser.username.slice(0, 20),
      banExpiresAt: null,
    }).where(eq(players.username, username));

    // Audit trail
    await db.insert(modLog).values({
      id: generateId().slice(0, 24),
      moderatorId: adminUser.username.slice(0, 20),
      action: 'BAN_PLAYER',
      targetId: username,
      reason,
      details: JSON.stringify({ scope: 'account', bannedBy: adminUser.username }),
      createdAt: now,
    });

    log.info('Player banned', { username, adminUser: adminUser.username });

    return NextResponse.json({
      success: true,
      message: `Banned ${username}`,
    });
  } catch (error) {
    log.error('Failed to ban player', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// Keep the shared-scope guard import used above meaningful if lint complains about `and`.
void and;
