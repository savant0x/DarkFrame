/**
 * @file app/api/admin/fix-base/route.ts
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * @updated 2026-05-03 — Migrated to Supabase
 * @overview Admin-only endpoint to fix base tiles
 */

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

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminFixBaseAPI');
  const endTimer = log.time('fix-base');

  try {
    const body = await request.json();
    const username = body.username;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }
    
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
      adminUser: username,
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
