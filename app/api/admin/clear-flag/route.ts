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
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { playerFlags, modLog } from '@/lib/db/schema';
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
import { ClearFlagSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminClearFlagAPI');
  const endTimer = log.time('clear-flag');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }
    const user = adminAuth;

    const body = await request.json();
    const validated = ClearFlagSchema.parse(body);
    const { flagId, adminNotes } = validated;

    // Find flag
    const flagResult = await db.select().from(playerFlags).where(eq(playerFlags.id, flagId)).limit(1);

    if (flagResult.length === 0) {
      return createErrorResponse(ErrorCode.ADMIN_FLAG_NOT_FOUND, {
        message: 'Flag not found',
        flagId,
      });
    }

    const flag = flagResult[0];
    const details = (flag.details as Record<string, unknown>) || {};

    // Update flag as resolved
    const updatedDetails = {
      ...details,
      resolved: true,
      resolvedBy: user.username,
      resolvedAt: new Date().toISOString(),
      adminNotes: adminNotes.trim(),
    };

    await db.update(playerFlags)
      .set({ details: updatedDetails })
      .where(eq(playerFlags.id, flagId));

    // Log admin action
    // FID-20260905-001 B6: id omitted — schema $defaultFn supplies a 24-char id
    // (the explicit `modlog_<ts>_<rand>` literal was 28 chars → varchar(24) overflow).
    await db.insert(modLog).values({
      moderatorId: user.username,
      action: 'CLEAR_FLAG',
      targetId: flag.playerId ?? '',
      reason: adminNotes.trim(),
      details: JSON.stringify({
        flagType: details.flagType,
        flagSeverity: details.severity,
        flagId,
      }),
      createdAt: new Date(),
    });

    log.info('Flag cleared successfully', {
      flagId,
      username: details.username || flag.playerId,
      flagType: details.flagType,
      severity: details.severity,
      adminUser: user.username,
    });

    return NextResponse.json({
      success: true,
      message: 'Flag cleared successfully',
      data: {
        flagId: flag.id,
        username: details.username || flag.playerId,
        flagType: details.flagType,
        severity: details.severity,
        resolvedBy: user.username,
        resolvedAt: updatedDetails.resolvedAt,
        adminNotes: updatedDetails.adminNotes,
      },
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
 * - Logs all admin actions in modLog table
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
