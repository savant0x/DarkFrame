/**
 * @file app/api/admin/player-activity/route.ts
 * @created 2025-10-18
 * @overview Get detailed activity logs for a specific player
 * 
 * OVERVIEW:
 * Returns paginated activity history for a player including all actions,
 * timestamps, metadata, and session information. Used by admin dashboard
 * to monitor individual player behavior and investigate flags.
 * 
 * Access: Admin only (rank >= 5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playerActivity } from '@/lib/db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/**
 * GET /api/admin/player-activity?userId=PlayerOne&limit=100&page=1
 * 
 * Get activity history for a specific player
 * 
 * Query params:
 * - userId: Player username (required)
 * - limit: Records per page (default: 50, max: 500)
 * - page: Page number (default: 1)
 * - action: Filter by action type (optional)
 * - hoursAgo: Only get activities from last X hours (optional)
 * 
 * Returns:
 * - activities: Array of PlayerActivity records
 * - totalCount: Total matching records
 * - page: Current page
 * - totalPages: Total pages available
 * 
 * @example
 * GET /api/admin/player-activity?userId=PlayerOne&limit=50&page=1
 * GET /api/admin/player-activity?userId=PlayerOne&action=harvest&hoursAgo=24
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/player-activity');
  const endTimer = log.time('get-player-activity');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limitStr = searchParams.get('limit') || '50';
    const pageStr = searchParams.get('page') || '1';
    const actionFilter = searchParams.get('action');
    const hoursAgoStr = searchParams.get('hoursAgo');

    if (!userId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'userId parameter required');
    }

    const limit = Math.min(parseInt(limitStr), 500);
    const page = Math.max(parseInt(pageStr), 1);
    const skip = (page - 1) * limit;

    const conditions = [eq(playerActivity.playerId, userId)];

    if (actionFilter) {
      conditions.push(eq(playerActivity.action, actionFilter));
    }

    if (hoursAgoStr) {
      const hoursAgo = parseInt(hoursAgoStr);
      const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      conditions.push(gte(playerActivity.timestamp, cutoffTime));
    }

    const totalCountResult = await db.select({ count: sql<number>`count(*)` })
      .from(playerActivity)
      .where(and(...conditions));

    const totalCount = Number(totalCountResult[0]?.count || 0);

    const activities = await db.select()
      .from(playerActivity)
      .where(and(...conditions))
      .orderBy(desc(playerActivity.timestamp))
      .limit(limit)
      .offset(skip);

    const totalPages = Math.ceil(totalCount / limit);

    log.info('Player activity retrieved', {
      userId,
      totalCount,
      page,
      totalPages,
      actionFilter: actionFilter || 'all',
    });

    return NextResponse.json({
      success: true,
      activities,
      totalCount,
      page,
      totalPages,
      limit,
    });
  } catch (error) {
    log.error('Failed to fetch player activity', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Admin only access (rank >= 5)
// - Pagination to handle large activity histories
// - Optional filtering by action type and time period
// - Sorted by timestamp descending (newest first)
// - Returns metadata for detailed investigation
// - Used by admin dashboard player detail view
// ============================================================
