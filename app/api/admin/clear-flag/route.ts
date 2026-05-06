/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Clear Flag Admin Endpoint
 * 
 * POST /api/admin/clear-flag
 * Rate Limited: 30 req/hour (admin bot management)
 * - Marks a specific anti-cheat flag as resolved
 * - Requires admin notes explaining resolution
 * - Records which admin cleared the flag and when
 * - Admin-only access (rank >= 5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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
    const body = await request.json();
    const username = (body as Record<string, unknown>).username as string;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const validated = ClearFlagSchema.parse(body);
    const { flagId, adminNotes } = validated;

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

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
      admin_username: username,
      action: 'CLEAR_FLAG',
      target: result.player_username,
      details: { admin_notes: adminNotes.trim(), flag_id: flagId }
    });

    log.info('Flag cleared successfully', {
      flagId,
      player_username: result.player_username,
      adminUser: username,
    });

    return NextResponse.json({
      success: true,
      message: 'Flag cleared successfully',
      data: {
        flagId: result.id,
        player_username: result.player_username,
        resolvedBy: username,
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

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Marks flag as resolved, not deleted (maintains history)
 * - Requires meaningful admin notes for accountability
 * - Logs all admin actions in admin_logs table
 * - Returns updated flag data for UI refresh
 * 
 * 🔐 SECURITY:
 * - Admin-only access (rank >= 5)
 * - Validates flag ID and notes
 * - Audit trail via admin logs
 * 
 * 📊 REQUEST BODY:
 * {
 *   flagId: string,
 *   adminNotes: string (min 10 characters)
 * }
 * 
 * 🚀 FUTURE ENHANCEMENTS:
 * - Bulk flag clearing for same issue
 * - Flag reinstatement if player reoffends
 * - Automatic notifications to player
 * - Admin action history view
 */
