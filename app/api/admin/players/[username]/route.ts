/**
 * Individual Player Data Endpoint
 * 
 * Created: 2025-01-18
 * 
 * Returns detailed information for a specific player.
 * Admin-only access for player management features.
 * 
 * GET /api/admin/players/[username]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players, playerSessions } from '@/lib/db/schema';
import {

  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const _rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
): Promise<NextResponse> {
  const log = createRouteLogger('admin-player-detail');
  const endTimer = log.time('admin-player-detail');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const { username } = await context.params;

    const playerRecord = await db.select().from(players).where(eq(players.username, username)).limit(1);

    if (!playerRecord || playerRecord.length === 0) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    const player = playerRecord[0];

    const sessions = await db.select()
      .from(playerSessions)
      .where(eq(playerSessions.userId, username))
      .orderBy(desc(playerSessions.createdAt))
      .limit(1);

    const lastActive = sessions.length > 0 ? sessions[0].createdAt : player.lastLoginDate;

    const responseData = {
      username: player.username,
      level: player.level || 1,
      rank: player.rank || 0,
      xp: player.xp || 0,
      resources: {
        metal: Number(player.resourcesMetal || 0n),
        energy: Number(player.resourcesEnergy || 0n)
      },
      position: {
        x: player.currentPositionX || 0,
        y: player.currentPositionY || 0
      },
      baseLocation: `(${player.baseX || 0}, ${player.baseY || 0})`,
      isBot: player.isBot === 1,
      createdAt: player.createdAt,
      lastActive,
      totalPlayTime: 0,
      achievements: player.achievements || []
    };

    log.info('Player data retrieved', { 
      username, 
      level: responseData.level, 
      isBot: responseData.isBot,
      sessionCount: sessions.length 
    });

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    log.error('Player fetch error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}
