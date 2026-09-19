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
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db/connection';
import { players, bans, modLog, playerFlags } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
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
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }
    const user = adminAuth;

    const body = await request.json();
    const validated = BanPlayerSchema.parse(body);
    const { username, reason, durationDays, autoResolveFlags } = validated;

    // Check if player exists — pg (FID-20260917-016)
    const [player] = await db.select({ username: players.username, rank: players.rank, vipTier: players.vipTier, resourcesMetal: players.resourcesMetal, resourcesEnergy: players.resourcesEnergy }).from(players).where(eq(players.username, username)).limit(1);
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
    // Ban record — pg (FID-20260917-016). The moderation table requires
    // id (24-char PK with NO default — drizzle must generate it), playerId/
    // moderatorId (NOT NULL), createdAt (NOT NULL, no default); the account-ban
    // domain keys (username/bannedBy) are carried per the schema's shared-table
    // contract. isPermanent/active are smallint flags, not booleans. Missing
    // keys made every ban 500 on the insert (FID-20260914-004 live sweep).
    const bannedAt = new Date();
    const expiresAt = durationDays
      ? new Date(bannedAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : null; // null = permanent ban

    await db.insert(bans).values({
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      playerId: username,
      moderatorId: user.username,
      username,
      bannedBy: user.username,
      bannedAt,
      createdAt: bannedAt,
      expiresAt,
      reason: reason.trim(),
      isPermanent: durationDays ? 0 : 1,
      active: 1,
    });

    // Update player account — pg columns (banned is smallint, not boolean)
    await db.update(players).set({
      banned: 1,
      bannedAt,
      bannedBy: user.username,
      banReason: reason.trim(),
      banExpiresAt: expiresAt,
    }).where(eq(players.username, username));

    // Optionally resolve all active flags. player_flags has NO resolvedBy/
    // resolvedAt/adminNotes columns (FID-20260917-016 D5): only `resolved`
    // flips; the evidence rides the metadata jsonb so it stays queryable.
    if (autoResolveFlags) {
      await db.update(playerFlags).set({
        resolved: 1,
        metadata: {
          resolvedBy: user.username,
          resolvedAt: new Date().toISOString(),
          adminNotes: `Auto-resolved via player ban: ${reason.trim()}`,
        },
      }).where(and(eq(playerFlags.username, username), eq(playerFlags.resolved, 0)));
    }

    // Log admin action — mod_log via drizzle (FID-20260917-016 D1). The legacy
    // `adminLogs` shim name mapped to no pg table: the insert matched nothing
    // real. Legacy fields preserved in details.
    await db.insert(modLog).values({
      moderatorId: user.username,
      action: 'BAN_PLAYER',
      targetId: username,
      reason: reason.trim(),
      details: JSON.stringify({
        adminUsername: user.username,
        targetUsername: username,
        durationDays: durationDays || 'permanent',
        metadata: {
          playerTier: player.vipTier ?? null,
          playerRank: player.rank,
          playerResources: { metal: player.resourcesMetal, energy: player.resourcesEnergy },
          autoResolvedFlags: autoResolveFlags
        }
      }),
      createdAt: new Date(),
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
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }
    const user = adminAuth;

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        message: 'Username is required',
      });
    }

    // Update player account — pg (FID-20260917-016 D4): players has no
    // unbannedAt/unbannedBy columns (the Mongo $set mapped to nothing); the
    // unban clears the five real ban columns and the UNBAN mod_log row below
    // carries the actor audit.
    const result = await db.update(players).set({
      banned: 0,
      bannedAt: null,
      bannedBy: null,
      banReason: null,
      banExpiresAt: null,
    }).where(eq(players.username, username)).returning({ username: players.username });

    if (result.length === 0) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    // Deactivate active ban records (shared channel/account table; account rows
    // are distinguished by bannedBy being set — filter on username as before)
    await db.update(bans).set({ active: 0 })
      .where(and(eq(bans.username, username), eq(bans.active, 1)));

    // Log admin action — mod_log via drizzle (FID-20260917-016 D1); the legacy
    // `adminLogs` shim name matched no pg table.
    await db.insert(modLog).values({
      moderatorId: user.username,
      action: 'UNBAN_PLAYER',
      targetId: username,
      details: JSON.stringify({ adminUsername: user.username, targetUsername: username }),
      createdAt: new Date(),
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
