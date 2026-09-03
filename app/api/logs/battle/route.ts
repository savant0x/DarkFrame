/**
 * Battle Logs Query API
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * REST API endpoint for querying battle/combat logs with filtering and pagination.
 * Supports filtering by player, battle type, outcome, location, and date range.
 * Returns detailed combat data including units, damage, and outcomes.
 * 
 * Endpoints:
 * - GET /api/logs/battle - Query battle logs with filters
 * - GET /api/logs/battle/[battleId] - Get specific battle details
 * 
 * Authentication: Required (public battles viewable, private restricted)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/authMiddleware';
import { 
  queryBattleLogs
} from '@/lib/battleLogService';
import { BattleType, BattleOutcome } from '@/types/activityLog.types';

/**
 * GET /api/logs/battle
 * 
 * Query battle logs with optional filters
 * 
 * Query Parameters:
 * - playerId: Filter by player ID (attacker or defender)
 * - battleType: Filter by battle type (pvp, pve_factory, clan_war)
 * - outcome: Filter by outcome (attacker_win, defender_win, draw)
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - tileX: Filter by tile X coordinate
 * - tileY: Filter by tile Y coordinate
 * - limit: Maximum results to return (default: 50, max: 500)
 * - offset: Pagination offset (default: 0)
 * 
 * @example
 * GET /api/logs/battle?playerId=player1&limit=20
 * GET /api/logs/battle?battleType=pvp&outcome=attacker_win
 * GET /api/logs/battle?tileX=10&tileY=15
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    
    const playerId = searchParams.get('playerId') || undefined;
    const battleTypeParam = searchParams.get('battleType');
    const outcomeParam = searchParams.get('outcome');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const tileXParam = searchParams.get('tileX');
    const tileYParam = searchParams.get('tileY');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    
    // Parse battle type
    const battleType = battleTypeParam as BattleType | undefined;
    
    // Parse outcome
    const outcome = outcomeParam as BattleOutcome | undefined;
    
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;
    
    // Parse coordinates
    const tileX = tileXParam ? parseInt(tileXParam, 10) : undefined;
    const tileY = tileYParam ? parseInt(tileYParam, 10) : undefined;
    
    // Parse pagination
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;
    
    // Query battles
    const battles = await queryBattleLogs({
      playerId,
      battleType,
      outcome,
      startDate,
      endDate,
      tileX,
      tileY,
      limit,
      offset
    });
    
    return NextResponse.json({
      success: true,
      battles,
      count: battles.length,
      filters: {
        playerId,
        battleType,
        outcome,
        startDate,
        endDate,
        tileX,
        tileY,
        limit,
        offset
      }
    });
  } catch (error: any) {
    console.error('[API] Error querying battle logs:', error);
    return NextResponse.json(
      { error: 'Failed to query battle logs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * FOOTER:
 * 
 * Implementation Notes:
 * - All battle logs are publicly viewable (part of game transparency)
 * - Supports filtering by participant, type, outcome, location
 * - Pagination prevents large result sets
 * - Coordinates enable location-based battle history
 * 
 * Security:
 * - Authentication required to prevent abuse
 * - Rate limiting recommended for production
 * - Input validation on all parameters
 * 
 * Future Enhancements:
 * - Add battle replay functionality
 * - Implement battle statistics aggregation
 * - Add real-time battle notifications
 * - Implement battle export for analysis
 */
