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
import clientPromise from '@/lib/mongodb';
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

    const client = await clientPromise;
    const db = client.db('game');

    // Check if player exists
    const player = await db.collection('players').findOne({ username });
    if (!player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    // Get current flags for logging (player_flags is username-keyed as of migration 0007;
    // the pre-0007 `{ username }` filter hit no column and deleted zero rows while
    // reporting success).
    const currentFlags = await db.collection('playerFlags')
      .find({ username })
      .toArray();

    // Delete all flags for this player
    const result = await db.collection('playerFlags').deleteMany({ username });

    // Log admin action — mod_log column keys. The legacy Mongo doc keys resolve to
    // no column post-pivot (NOT NULL moderator_id/target_id/created_at rendered as
    // `default` and the insert 500'd AFTER the flags were already cleared — same
    // class as the ban-player audit fix, FID-20260914-004 live sweep).
    await db.collection('adminLogs').insertOne({
      moderatorId: adminUser.username,
      action: 'CLEAR_FLAGS',
      targetId: username,
      details: JSON.stringify({
        adminUsername: adminUser.username,
        targetUsername: username,
        flagsCleared: result.deletedCount,
        previousFlags: currentFlags.map((f: Record<string, unknown>) => ({
          flagType: f.flagType,
          severity: f.severity,
          timestamp: f.timestamp
        }))
      }),
      createdAt: new Date(),
    });

    log.info('Flags cleared successfully', {
      username,
      flagsCleared: result.deletedCount,
      adminUser: adminUser.username,
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.deletedCount} flags for ${username}`,
      flagsCleared: result.deletedCount
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
