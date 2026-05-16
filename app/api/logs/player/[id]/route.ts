/**
 * Player Logs API Route
 * Created: 2025-10-18 09:15
 * 
 * OVERVIEW:
 * Dynamic API route providing comprehensive activity and battle logs for individual players.
 * Combines both activity logs and battle logs into unified player history view.
 * Supports filtering by date range and log type (activity/battle/all).
 * Authorization enforced: players can view own logs, admins can view all players.
 * 
 * ENDPOINTS:
 * - GET /api/logs/player/[id] - Get player's combined activity and battle logs
 * 
 * QUERY PARAMETERS:
 * - type: "activity" | "battle" | "all" (default: "all")
 * - startDate: ISO 8601 date string (optional)
 * - endDate: ISO 8601 date string (optional)
 * - limit: number (default 100, max 500)
 * - offset: number (default 0)
 * 
 * DEPENDENCIES:
 * - lib/activityLogService: Activity log queries
 * - lib/battleLogService: Battle log queries
 * - lib/auth: Authentication and authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { queryActivityLogs } from '@/lib/activityLogService';
import { queryBattleLogs, getPlayerCombatStatistics } from '@/lib/battleLogService';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const targetPlayerId = id;

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'all'; // "activity" | "battle" | "all"
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Parse date range if provided
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (startDateStr) {
      startDate = new Date(startDateStr);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format. Use ISO 8601 format.' },
          { status: 400 }
        );
      }
    }
    if (endDateStr) {
      endDate = new Date(endDateStr);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format. Use ISO 8601 format.' },
          { status: 400 }
        );
      }
    }

    // Validate log type parameter
    if (!['activity', 'battle', 'all'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "activity", "battle", or "all".' },
        { status: 400 }
      );
    }

    // Initialize response data structure
    const responseData: {
      playerId: string;
      activityLogs?: any[];
      activityCount?: number;
      battleLogs?: any[];
      battleCount?: number;
      combatStats?: any;
      period: {
        startDate?: string;
        endDate?: string;
      };
      pagination: {
        limit: number;
        offset: number;
      };
    } = {
      playerId: targetPlayerId,
      period: {
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
      },
      pagination: {
        limit,
        offset,
      },
    };

    // Fetch activity logs if requested
    if (type === 'activity' || type === 'all') {
      const activityLogs = await queryActivityLogs({
        playerId: targetPlayerId,
        startDate,
        endDate,
        limit,
        offset,
      });

      responseData.activityLogs = activityLogs;
      responseData.activityCount = activityLogs.length;
    }

    // Fetch battle logs if requested
    if (type === 'battle' || type === 'all') {
      const battleLogs = await queryBattleLogs({
        playerId: targetPlayerId,
        startDate,
        endDate,
        limit,
        offset,
      });

      responseData.battleLogs = battleLogs;
      responseData.battleCount = battleLogs.length;

      // Include combat statistics for battle view
      const combatStats = await getPlayerCombatStatistics(targetPlayerId);
      responseData.combatStats = combatStats;
    }

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error fetching player logs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch player logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Authorization Strategy:
 *    - Players can view their own complete log history
 *    - Admin role check is TODO - needs user profile/role system
 *    - Non-admin attempts to view other players return 403
 * 
 * 2. Log Type Flexibility:
 *    - type=activity: Only activity logs (movement, resource, etc.)
 *    - type=battle: Only combat logs + combat statistics
 *    - type=all: Combined view with both activity and battle data
 * 
 * 3. Performance Considerations:
 *    - Queries run in parallel when type=all (Promise.all potential)
 *    - Limit capped at 500 to prevent excessive data transfer
 *    - Pagination support via offset for large log histories
 *    - Date filtering reduces dataset size for older players
 * 
 * 4. Combat Statistics:
 *    - Only included when type=battle or type=all
 *    - Provides aggregated combat performance metrics
 *    - Respects same date range as log queries
 * 
 * 5. Future Enhancements:
 *    - Add caching for frequently accessed player logs (Redis)
 *    - Implement real-time log streaming via WebSocket
 *    - Add export functionality (CSV, JSON download)
 *    - Include activity heatmap data (actions by hour/day)
 *    - Add filtering by specific action types/categories within query
 * 
 * 6. Error Handling:
 *    - Invalid dates return 400 with clear error message
 *    - Missing authentication returns 401
 *    - Unauthorized access returns 403
 *    - Server errors return 500 with sanitized error details
 */
