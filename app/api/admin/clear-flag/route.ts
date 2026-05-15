/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2026-05-15 — Fixed auth bypass: use requireAdminAuth
 * 🎯 OVERVIEW:
 * Clear Flag Admin Endpoint
 * 
 * POST /api/admin/clear-flag
 * Rate Limited: 30 req/hour (admin bot management)
 * - Marks a specific anti-cheat flag as resolved
 * - Requires admin notes explaining resolution
 * - Records which admin cleared the flag and when
 * - Admin-only access
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
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { ClearFlagSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminClearFlagAPI');
  const endTimer = log.time('clear-flag');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    const validated = ClearFlagSchema.parse(body);
    const { flagId, adminNotes } = validated;

    const supabase = createServiceClient();

    // Update flag to resolved
    const { data: result, error: updateError } = await supabase
      .from('player_flags')
      .update({
        resolved: true
      })
      .eq('id', flagId)
      .select('*')
      .single();

    if (updateError || !result) {
      return createErrorResponse(ErrorCode.ADMIN_FLAG_NOT_FOUND, {
        message: 'Flag not found',
        flagId,
      });
    }

    // Log admin action
    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'CLEAR_FLAG',
      target: result.player_username,
      details: { admin_notes: adminNotes.trim(), flag_id: flagId }
    });

    log.info('Flag cleared successfully', {
      flagId,
      player_username: result.player_username,
      adminUser: auth.username,
    });

    return NextResponse.json({
      success: true,
      message: 'Flag cleared successfully',
      data: {
        flagId: result.id,
        player_username: result.player_username,
        resolvedBy: auth.username,
        adminNotes: adminNotes.trim()
      }
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Failed to clear flag', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
