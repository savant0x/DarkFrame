/**
 * 📅 Created: 2025-01-18
 * 📅 Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 🎯 OVERVIEW:
 * Clear Player Flags Endpoint
 * 
 * Allows admins to clear all anti-cheat flags for a player.
 * Logs action in adminLogs collection for audit trail.
 * Does not remove bans - use unban endpoint for that.
 * 
 * POST /api/admin/anti-cheat/clear-flags
 * Rate Limited: 30 req/hour (admin bot management)
 * Body: { username }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db/connection';
import { players, playerFlags, modLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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
    // Admin authentication
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }
    const adminUser = adminAuth;

    const body = await request.json();
    const validated = ClearFlagsSchema.parse(body);
    const { username } = validated;

    // Check if player exists — pg (FID-20260917-016)
    const [player] = await db.select({ username: players.username }).from(players).where(eq(players.username, username)).limit(1);
    if (!player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    // Get current flags for logging (player_flags is username-keyed as of migration 0007;
    // the pre-0007 `{ username }` filter hit no column and deleted zero rows while
    // reporting success).
    const currentFlags = await db.select({
      flagType: playerFlags.flagType,
      severity: playerFlags.severity,
      createdAt: playerFlags.createdAt,
    }).from(playerFlags).where(eq(playerFlags.username, username));

    // Delete all flags for this player — honest count via .returning()
    // (FID-20260914-004 semantics)
    const deleted = await db.delete(playerFlags)
      .where(eq(playerFlags.username, username))
      .returning({ id: playerFlags.id });

    // Log admin action — mod_log via drizzle (FID-20260917-016 D1). The legacy
    // `adminLogs` shim name mapped to no pg table: NOT NULL moderator_id/
    // target_id/created_at rendered as `default` and the insert matched nothing
    // real AFTER the flags were already cleared (same class as the ban-player
    // audit fix, FID-20260914-004 live sweep).
    await db.insert(modLog).values({
      moderatorId: adminUser.username,
      action: 'CLEAR_FLAGS',
      targetId: username,
      details: JSON.stringify({
        adminUsername: adminUser.username,
        targetUsername: username,
        flagsCleared: deleted.length,
        previousFlags: currentFlags.map((f) => ({
          flagType: f.flagType,
          severity: f.severity,
          timestamp: f.createdAt
        }))
      }),
      createdAt: new Date(),
    });

    log.info('Flags cleared successfully', {
      username,
      flagsCleared: deleted.length,
      adminUser: adminUser.username,
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${deleted.length} flags for ${username}`,
      flagsCleared: deleted.length
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
 * - Deletes all playerFlags documents for username
 * - Logs action with previous flags for audit trail
 * - Does not affect bans (separate collection)
 * 
 * 🔐 SECURITY:
 * - Admin authentication required
 * - Player existence validation
 * - Audit trail logging
 * 
 * 📊 ADMIN LOG STRUCTURE:
 * {
 *   timestamp: Date,
 *   adminUsername: string,
 *   actionType: 'CLEAR_FLAGS',
 *   targetUsername: string,
 *   details: { flagsCleared: number, previousFlags: [] }
 * }
 * 
 * ⚠️ NOTE:
 * - This does not unban players
 * - Use /api/admin/anti-cheat/unban to remove bans
 * - Flags may be re-added if suspicious activity continues
 */
