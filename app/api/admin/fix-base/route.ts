/**
 * @file app/api/admin/fix-base/route.ts
 * @created 2025-10-18
 * @updated 2026-05-15 — Fixed auth bypass: use requireAdminAuth
 * @overview Admin-only endpoint to fix base tiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
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
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    
    const { data: players, error: playerError } = await supabase
      .from('players')
      .select('base_x, base_y, username');
    
    if (playerError) throw playerError;
    
    let fixedCount = 0;
    
    for (const player of (players || [])) {
      const { error: updateError } = await supabase
        .from('tiles')
        .update({
          terrain: 'Wasteland',
          occupied_by_base: true,
        })
        .eq('x', player.base_x)
        .eq('y', player.base_y);
      
      if (!updateError) {
        fixedCount++;
        log.debug(`Fixed ${player.username}'s base at (${player.base_x}, ${player.base_y})`);
      }
    }
    
    log.info('Base tiles fixed', {
      fixedCount,
      adminUser: auth.username,
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
