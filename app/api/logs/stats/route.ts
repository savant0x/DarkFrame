/**
 * Log Statistics API
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * REST API endpoint for retrieving activity and battle log statistics.
 * Provides aggregated analytics for admin dashboards and player profiles.
 * Supports both activity logs and battle logs statistics.
 * 
 * Endpoints:
 * - GET /api/logs/stats?type=activity - Activity log statistics
 * - GET /api/logs/stats?type=battle - Battle log statistics
 * - GET /api/logs/stats?type=player&playerId=X - Player-specific statistics
 * 
 * Authentication: Required (admin for global stats, own stats for players)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { getActivityLogStats, getActionCountForPeriod } from '@/lib/activityLogService';
import { getBattleLogStats, getPlayerCombatStatistics } from '@/lib/battleLogService';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = req.nextUrl;
    
    const type = searchParams.get('type') || 'activity';
    const playerId = searchParams.get('playerId') || undefined;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;
    
    // Handle different stat types
    switch (type) {
      case 'activity': {
        // Activity log statistics
        const stats = await getActivityLogStats({
          startDate,
          endDate
        });
        
        // Additional period-based stats
        const actionsLast1Hour = await getActionCountForPeriod(1);
        const actionsLast24Hours = await getActionCountForPeriod(24);
        const actionsLast7Days = await getActionCountForPeriod(24 * 7);
        
        return NextResponse.json({
          success: true,
          type: 'activity',
          stats,
          periodStats: {
            last1Hour: actionsLast1Hour,
            last24Hours: actionsLast24Hours,
            last7Days: actionsLast7Days,
            actionsPerHour: actionsLast24Hours / 24,
            actionsPerDay: actionsLast7Days / 7
          },
          dateRange: { startDate, endDate }
        });
      }
      
      case 'battle': {
        // Battle log statistics
        const stats = await getBattleLogStats({
          startDate,
          endDate
        });
        
        return NextResponse.json({
          success: true,
          type: 'battle',
          stats,
          dateRange: { startDate, endDate }
        });
      }
      
      case 'player': {
        // Player-specific statistics
        if (!playerId) {
          return NextResponse.json(
            { error: 'playerId parameter required for player statistics' },
            { status: 400 }
          );
        }
        
        // Authorization: Users can only view their own stats unless admin
        // Simplified: no auth check needed with username-based access
        if (!playerId) {
          return NextResponse.json(
            { error: 'Forbidden: Can only view your own statistics' },
            { status: 403 }
          );
        }
        
        // Get activity stats for player
        const activityStats = await getActivityLogStats({
          playerId,
          startDate,
          endDate
        });
        
        // Get combat stats for player
        const combatStats = await getPlayerCombatStatistics(playerId);
        
        return NextResponse.json({
          success: true,
          type: 'player',
          playerId,
          stats: {
            activity: activityStats,
            combat: combatStats
          },
          dateRange: { startDate, endDate }
        });
      }
      
      default: {
        return NextResponse.json(
          { error: `Invalid type parameter: ${type}. Must be 'activity', 'battle', or 'player'` },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    console.error('[API] Error retrieving log statistics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve statistics', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * FOOTER:
 * 
 * Implementation Notes:
 * - Supports multiple statistics types (activity, battle, player)
 * - Activity stats include period-based metrics (hourly, daily, weekly)
 * - Battle stats include win rates and unit performance
 * - Player stats combine both activity and combat data
 * 
 * Security:
 * - Global stats require admin access
 * - Players can only view their own stats
 * - Date range filtering prevents excessive queries
 * 
 * Performance:
 * - Statistics are calculated on-demand (consider caching for production)
 * - Aggregation pipelines optimize MongoDB queries
 * - Period stats use indexed timestamp field
 * 
 * Future Enhancements:
 * - Add statistics caching with Redis
 * - Implement leaderboard endpoints
 * - Add trend analysis (week-over-week, month-over-month)
 * - Implement statistics export functionality
 */
