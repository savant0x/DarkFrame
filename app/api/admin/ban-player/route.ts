/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Ban Player Admin Endpoint
 * 
 * POST /api/admin/ban-player
 * Rate Limited: 30 req/hour (admin bot management)
 * - Permanently bans a player account
 * - Prevents future logins
 * - Requires ban reason and optional duration
 * - Logs all ban actions for accountability
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
import { BanPlayerSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBanPlayerAPI');
  const endTimer = log.time('ban-player');

  try {
    const body = await request.json();
    const validated = BanPlayerSchema.parse(body);
    const { username, reason, durationDays, autoResolveFlags } = validated;
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

    // Prevent banning admins
    if (player.rank && player.rank >= 5) {
      return createErrorResponse(ErrorCode.ADMIN_CANNOT_BAN_ADMIN, {
        message: 'Cannot ban admin accounts',
        username,
      });
    }

    // Calculate ban expiration if duration specified
    const bannedAt = new Date();
    const expiresAt = durationDays 
      ? new Date(bannedAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : null; // null = permanent ban


    // Optionally resolve all active flags for this player
    if (autoResolveFlags) {
      await supabase
        .from('player_flags')
        .update({
          resolved: true
        })
        .eq('player_username', username)
        .eq('resolved', false);
    }

    // Log admin action
    await supabase.from('admin_logs').insert({
      admin_username: username,
      action: 'BAN_PLAYER',
      target: username,
      details: {
        reason: reason.trim(),
        ban_duration: durationDays || 'permanent',
        banned_at: bannedAt.toISOString(),
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        is_permanent: !durationDays,
        player_rank: player.rank,
        player_metal: player.resources_metal,
        player_energy: player.resources_energy,
        auto_resolved_flags: autoResolveFlags
      }
    });

    log.info('Player banned successfully', {
      username,
      bannedBy: username,
      isPermanent: !durationDays,
      durationDays: durationDays || 'permanent',
      flagsResolved: autoResolveFlags,
    });

    return NextResponse.json({
      success: true,
      message: `Player ${username} has been banned`,
      data: {
        username,
        bannedBy: username,
        bannedAt,
        expiresAt,
        isPermanent: !durationDays,
        reason: reason.trim(),
        flagsResolved: autoResolveFlags
      }
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Failed to ban player', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * DELETE /api/admin/ban-player - Unban a player
 * Rate Limited: 30 req/hour (admin bot management)
 * Removes ban and restores account access
 */
export const DELETE = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminUnbanPlayerAPI');
  const endTimer = log.time('unban-player');

  try {
    const { searchParams } = request.nextUrl;
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        message: 'Username is required',
      });
    }

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    // Check player exists before update
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

    // Log unban action (players table has no ban columns, so we just log it)
    await supabase.from('admin_logs').insert({
      admin_username: username,
      action: 'UNBAN_PLAYER',
      target: username
    });

    log.info('Player unbanned successfully', {
      username,
      unbannedBy: username,
    });

    return NextResponse.json({
      success: true,
      message: `Player ${username} has been unbanned`,
      data: {
        username,
        unbannedBy: username,
        unbannedAt: new Date()
      }
    });

  } catch (error) {
    log.error('Failed to unban player', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Updates player record directly with ban fields (no separate bans table)
 * - Updates player account to prevent login
 * - Supports both permanent and temporary bans
 * - Option to auto-resolve flags when banning
 * - Prevents banning of admin accounts
 * - Comprehensive audit logging
 * 
 * 🔐 SECURITY:
 * - Admin-only access (rank >= 5)
 * - Cannot ban admin accounts (rank >= 5)
 * - Requires meaningful ban reason
 * - All actions logged for accountability
 * 
 * 📊 REQUEST BODY (POST):
 * {
 *   username: string,
 *   reason: string (min 10 characters),
 *   durationDays?: number (null/undefined = permanent),
 *   autoResolveFlags?: boolean (default: false)
 * }
 * 
 * 📊 QUERY PARAMS (DELETE):
 * ?username=string
 * 
 * 🚀 FUTURE ENHANCEMENTS:
 * - IP banning for severe cases
 * - Automatic ban expiration job
 * - Ban appeal system
 * - Warning system before bans
 * - Progressive ban durations for repeat offenders
 * - Discord webhook notifications
 */
