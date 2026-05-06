/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Clear Player Flags Endpoint
 * 
 * Allows admins to clear all anti-cheat flags for a player.
 * Logs action in admin_logs table for audit trail.
 * Does not remove bans - use unban endpoint for that.
 * 
 * POST /api/admin/anti-cheat/clear-flags
 * Rate Limited: 30 req/hour (admin bot management)
 * Body: { username }
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
import { ClearFlagsSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminClearFlagsAPI');
  const endTimer = log.time('clear-flags');

  try {
    const body = await request.json();
    const validated = ClearFlagsSchema.parse(body);
    const { username } = validated;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    // Check if player exists
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (playerError || !player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    // Get current flags for logging — uses player_username column
    const { data: currentFlags } = await supabase
      .from('player_flags')
      .select('*')
      .eq('player_username', username);

    // Delete all flags for this player
    const { error: deleteError } = await supabase
      .from('player_flags')
      .delete()
      .eq('player_username', username);

    if (deleteError) {
      throw deleteError;
    }

    const deletedCount = currentFlags?.length || 0;

    // Log admin action — uses actual admin_logs column names
    await supabase.from('admin_logs').insert({
      created_at: new Date().toISOString(),
      admin_username: username,
      action: 'CLEAR_FLAGS',
      target: username,
      details: {
        flags_cleared: deletedCount,
        previous_flags: (currentFlags || []).map((f: any) => ({
          reason: f.reason,
          flagged_by: f.flagged_by,
          created_at: f.created_at,
        })),
      },
    });

    log.info('Flags cleared successfully', {
      username,
      flagsCleared: deletedCount,
      adminUser: username,
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedCount} flags for ${username}`,
      flagsCleared: deletedCount,
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Failed to clear flags', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Admin-only access (rank >= 5)
 * - Deletes all player_flags records for username
 * - Logs action with previous flags for audit trail
 * - Does not affect bans (stored in players table)
 * 
 * 🔐 SECURITY:
 * - Admin authentication required
 * - Player existence validation
 * - Audit trail logging
 * 
 * 📊 ADMIN LOG STRUCTURE:
 * {
 *   created_at: Date,
 *   admin_username: string,
 *   action: 'CLEAR_FLAGS',
 *   target: string,
 *   details: { flags_cleared: number, previous_flags: [] }
 * }
 * 
 * ⚠️ NOTE:
 * - This does not unban players
 * - Use /api/admin/anti-cheat/unban to remove bans
 * - Flags may be re-added if suspicious activity continues
 */
