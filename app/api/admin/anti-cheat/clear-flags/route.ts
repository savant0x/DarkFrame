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
import { getAuthenticatedUser } from '@/lib/authService';
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
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || !adminUser.rank || adminUser.rank < 5) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required (rank 5+)',
      });
    }

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

    // Get current flags for logging
    const currentFlags = await db.collection('playerFlags')
      .find({ username })
      .toArray();

    // Delete all flags for this player
    const result = await db.collection('playerFlags').deleteMany({ username });

    // Log admin action
    await db.collection('adminLogs').insertOne({
      timestamp: new Date(),
      adminUsername: adminUser.username,
      actionType: 'CLEAR_FLAGS',
      targetUsername: username,
      details: {
        flagsCleared: result.deletedCount,
        previousFlags: currentFlags.map((f: any) => ({
          flagType: f.flagType,
          severity: f.severity,
          timestamp: f.timestamp
        }))
      }
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
