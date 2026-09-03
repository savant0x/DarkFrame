/**
 * @file app/api/admin/fix-base/route.ts
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * @overview Admin-only endpoint to fix base tiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, tiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
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

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminFixBaseAPI');
  const endTimer = log.time('fix-base');

  try {
    const user = await getAuthenticatedUser();
    
    if (!user || user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }
    
    const allPlayers = await db.select({
      username: players.username,
      baseX: players.baseX,
      baseY: players.baseY,
    }).from(players);
    
    let fixedCount = 0;
    
    for (const player of allPlayers) {
      const { baseX: x, baseY: y } = player;
      
      const result = await db.update(tiles)
        .set({ 
          terrain: 'Wasteland',
          occupiedByBase: 1
        })
        .where(and(eq(tiles.x, x), eq(tiles.y, y)));
      
      if (result && (result.rowCount ?? 0) > 0) {
        fixedCount++;
        log.debug(`Fixed ${player.username}'s base at (${x}, ${y})`);
      }
    }
    
    log.info('Base tiles fixed', {
      fixedCount,
      adminUser: user.username,
    });

    return NextResponse.json({ 
      success: true, 
      message: `Fixed ${fixedCount} base tiles` 
    });
    
  } catch (error) {
    log.error('Failed to fix bases', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
