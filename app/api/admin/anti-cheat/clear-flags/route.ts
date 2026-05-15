/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2026-05-15 — Fixed auth bypass: use requireAdminAuth; proper types
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
import { requireAdminAuth } from '@/lib/authMiddleware';
import type { Database } from '@/types/database';
import type { Json } from '@/types/database';
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

type PlayerFlag = Database['public']['Tables']['player_flags']['Row'];

interface PreviousFlagEntry {
  reason: string;
  flagged_by: string;
  created_at: string;
}

interface ClearFlagsDetails {
  flags_cleared: number;
  previous_flags: PreviousFlagEntry[];
}

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminClearFlagsAPI');
  const endTimer = log.time('clear-flags');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const validated = ClearFlagsSchema.parse(body);
    const { username: targetUsername } = validated;
    if (!targetUsername) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('username', targetUsername)
      .single();

    if (playerError || !player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username: targetUsername,
      });
    }

    const { data: currentFlags } = await supabase
      .from('player_flags')
      .select('*')
      .eq('player_username', targetUsername);

    const { error: deleteError } = await supabase
      .from('player_flags')
      .delete()
      .eq('player_username', targetUsername);

    if (deleteError) {
      throw deleteError;
    }

    const deletedCount = currentFlags?.length || 0;

    const previousFlags: PreviousFlagEntry[] = (currentFlags || []).map((f: PlayerFlag): PreviousFlagEntry => ({
      reason: f.reason,
      flagged_by: f.flagged_by,
      created_at: f.created_at,
    }));

    const details: ClearFlagsDetails = {
      flags_cleared: deletedCount,
      previous_flags: previousFlags,
    };

    await supabase.from('admin_logs').insert({
      created_at: new Date().toISOString(),
      admin_username: auth.username,
      action: 'CLEAR_FLAGS',
      target: targetUsername,
      details: details as unknown as Json,
    });

    log.info('Flags cleared successfully', {
      targetUsername,
      flagsCleared: deletedCount,
      adminUser: auth.username,
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedCount} flags for ${targetUsername}`,
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
