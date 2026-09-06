/**
 * Admin Battle Logs Endpoint
 * Created: 2025-01-18
 * Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 
 * OVERVIEW:
 * Returns list of all battle logs in the game for admin inspection.
 * Provides comprehensive combat data including attacker, defender, outcome,
 * resources transferred, XP gained, and timestamps.
 * 
 * Endpoint: GET /api/admin/battle-logs
 * Rate Limited: 500 req/min (admin dashboard)
 * Auth Required: Admin (FAME account only)
 * 
 * Returns:
 * {
 *   logs: BattleLog[],
 *   total: number
 * }
 * 
 * Battle Log Data Structure:
 * - battleId: Log document ID
 * - timestamp: Battle timestamp (ISO string)
 * - attackerUsername: Username of attacker
 * - defenderUsername: Username of defender
 * - outcome: 'attacker_win' | 'defender_win' | 'draw'
 * - resourcesTransferred: {metal, energy}
 * - xpGained: XP awarded to winner
 * - location: {x, y} coordinates
 * - attackerLosses: Units lost by attacker (optional)
 * - defenderLosses: Units lost by defender (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { battleLogs } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
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
 * GET handler - Fetch all battle logs
 * 
 * Admin-only endpoint that returns comprehensive battle log data for inspection.
 * Sorted by timestamp (newest first).
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('AdminBattleLogsAPI');
  const endTimer = log.time('battle-logs');

  try {
    // Check admin authentication
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    // Check admin access (isAdmin flag required)
    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    // Fetch all battle logs (limit to 10,000 for safety, sorted by newest first)
    const logs = await db.select()
      .from(battleLogs)
      .orderBy(desc(battleLogs.timestamp))
      .limit(10000);

    // Transform battle log data for admin view
    const logsData = logs.map((logEntry) => {
      // Get timestamp as ISO string
      const timestamp = logEntry.timestamp
        ? new Date(logEntry.timestamp).toISOString()
        : new Date().toISOString();

      // Calculate resources transferred (default to 0 if not present)
      const resourcesTransferred = {
        metal: Number(logEntry.resourcesStolenAmount || 0),
        energy: 0,
      };

      // Get XP gained
      const xpGained = logEntry.attackerXP || 0;

      // Get location coordinates
      const location = {
        x: logEntry.locationX || 0,
        y: logEntry.locationY || 0,
      };

      // Determine outcome
      const outcome = logEntry.outcome || 'draw';

      return {
        _id: logEntry.battleId,
        timestamp,
        attackerUsername: logEntry.attackerUsername || 'Unknown',
        defenderUsername: logEntry.defenderUsername || 'Unknown',
        outcome,
        resourcesTransferred,
        xpGained,
        location,
        attackerLosses: logEntry.attackerUnitsLost,
        defenderLosses: logEntry.defenderUnitsLost,
      };
    });

    log.info('Battle logs retrieved', {
      total: logsData.length,
      adminUser: user.username,
    });

    return NextResponse.json({
      logs: logsData,
      total: logsData.length,
    });
  } catch (error) {
    log.error('Failed to fetch battle logs', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * 
 * Database Schema Assumptions:
 * - battleLogs table with Drizzle ORM schema fields
 * 
 * Data Transformation:
 * - Converts timestamps to ISO strings for consistency
 * - Provides defaults for missing fields (0 for numbers)
 * 
 * Sorting:
 * - Newest battles first (timestamp: -1)
 * - Makes it easy to see recent combat activity
 * 
 * Future Enhancements:
 * - Query params for server-side filtering
 * - Pagination with skip/limit params
 * - Aggregation for statistics (win rates, resource totals)
 * - Battle detail endpoint for individual log inspection
 * - Real-time updates via WebSocket or polling
 * 
 * Performance:
 * - Limit of 10,000 logs prevents excessive data transfer
 * - Client-side filtering for fast UX
 * - For production, implement server-side pagination
 */
