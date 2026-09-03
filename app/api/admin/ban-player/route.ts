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
import { getAuthenticatedUser } from '@/lib/authService';
import clientPromise from '@/lib/mongodb';
import type { Player } from '@/types/game.types';
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
    // Admin authentication check
    const user = await getAuthenticatedUser();
    if (!user || !user.rank || user.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const body = await request.json();
    const validated = BanPlayerSchema.parse(body);
    const { username, reason, durationDays, autoResolveFlags } = validated;

    const client = await clientPromise;
    const db = client.db('game');
    const players = db.collection<Player>('players');
    const bans = db.collection('bans');
    const flags = db.collection('playerFlags');

    // Check if player exists
    const player = await players.findOne({ username });
    if (!player) {
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

    // Create ban record
    const banRecord = {
      username,
      bannedBy: user.username,
      bannedAt,
      expiresAt,
      reason: reason.trim(),
      isPermanent: !durationDays,
      active: true
    };

    await bans.insertOne(banRecord);

    // Update player account
    await players.updateOne(
      { username },
      {
        $set: {
          banned: true,
          bannedAt,
          bannedBy: user.username,
          banReason: reason.trim(),
          banExpiresAt: expiresAt
        }
      }
    );

    // Optionally resolve all active flags
    if (autoResolveFlags) {
      await flags.updateMany(
        { username, resolved: false },
        {
          $set: {
            resolved: true,
            resolvedBy: user.username,
            resolvedAt: new Date(),
            adminNotes: `Auto-resolved via player ban: ${reason.trim()}`
          }
        }
      );
    }

    // Log admin action
    const adminLogs = db.collection('adminLogs');
    await adminLogs.insertOne({
      adminUsername: user.username,
      action: 'BAN_PLAYER',
      targetUsername: username,
      reason: reason.trim(),
      durationDays: durationDays || 'permanent',
      timestamp: new Date(),
      metadata: {
        playerTier: (player as Player & { tier?: number }).tier ?? null,
        playerRank: player.rank,
        playerResources: player.resources,
        autoResolvedFlags: autoResolveFlags
      }
    });

    log.info('Player banned successfully', {
      username,
      bannedBy: user.username,
      isPermanent: !durationDays,
      durationDays: durationDays || 'permanent',
      flagsResolved: autoResolveFlags,
    });

    return NextResponse.json({
      success: true,
      message: `Player ${username} has been banned`,
      data: {
        username,
        bannedBy: user.username,
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
    // Admin authentication check
    const user = await getAuthenticatedUser();
    if (!user || !user.rank || user.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        message: 'Username is required',
      });
    }

    const client = await clientPromise;
    const db = client.db('game');
    const players = db.collection('players');
    const bans = db.collection('bans');

    // Update player account
    const result = await players.updateOne(
      { username },
      {
        $set: {
          banned: false,
          unbannedAt: new Date(),
          unbannedBy: user.username
        },
        $unset: {
          bannedAt: '',
          bannedBy: '',
          banReason: '',
          banExpiresAt: ''
        }
      }
    );

    if (result.modifiedCount === 0) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    // Deactivate ban records
    await bans.updateMany(
      { username, active: true },
      {
        $set: {
          active: false,
          unbannedAt: new Date(),
          unbannedBy: user.username
        }
      }
    );

    // Log admin action
    const adminLogs = db.collection('adminLogs');
    await adminLogs.insertOne({
      adminUsername: user.username,
      action: 'UNBAN_PLAYER',
      targetUsername: username,
      timestamp: new Date()
    });

    log.info('Player unbanned successfully', {
      username,
      unbannedBy: user.username,
    });

    return NextResponse.json({
      success: true,
      message: `Player ${username} has been unbanned`,
      data: {
        username,
        unbannedBy: user.username,
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
 * - Creates ban record in separate collection for history
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
