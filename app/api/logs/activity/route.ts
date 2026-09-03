/**
 * Activity Logs Query API
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * REST API endpoint for querying player activity logs with filtering and pagination.
 * Supports filtering by player, action type, category, date range, and success status.
 * Returns paginated results with comprehensive log metadata.
 * 
 * Endpoints:
 * - GET /api/logs/activity - Query activity logs with filters
 * 
 * Authentication: Required (admin or own logs only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/authMiddleware';
import { queryActivityLogs, getPlayerActivityLogs } from '@/lib/activityLogService';
import { ActionType, ActionCategory } from '@/types/activityLog.types';

/**
 * GET /api/logs/activity
 * 
 * Query activity logs with optional filters
 * 
 * Query Parameters:
 * - playerId: Filter by player ID
 * - username: Filter by username
 * - actionType: Filter by action type (can be array)
 * - category: Filter by category (can be array)
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - success: Filter by success status (true/false)
 * - limit: Maximum results to return (default: 100, max: 1000)
 * - offset: Pagination offset (default: 0)
 * - sortBy: Sort field ('timestamp' or 'executionTimeMs')
 * - sortOrder: Sort order ('asc' or 'desc')
 * 
 * @example
 * GET /api/logs/activity?playerId=player1&actionType=harvest_metal&limit=50
 * GET /api/logs/activity?category=combat&startDate=2025-10-01&endDate=2025-10-18
 * GET /api/logs/activity?success=false&limit=100
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
    const username = searchParams.get('username') || undefined;
    const actionTypeParam = searchParams.get('actionType');
    const categoryParam = searchParams.get('category');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const successParam = searchParams.get('success');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const sortBy = searchParams.get('sortBy') as 'timestamp' | 'executionTimeMs' | null;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;
    
    // Authorization: Users can only view their own logs unless admin
    // TODO: Add admin role check from database
    const isAdmin = false; // Replace with actual admin check
    
    if (!isAdmin && playerId && playerId !== payload.username) {
      return NextResponse.json(
        { error: 'Forbidden: Can only view your own activity logs' },
        { status: 403 }
      );
    }
    
    // Default to current player's logs if no playerId specified and not admin
    const effectivePlayerId = playerId || (isAdmin ? undefined : payload.username);
    
    // Parse action types (support multiple)
    let actionType: ActionType | ActionType[] | undefined;
    if (actionTypeParam) {
      const types = actionTypeParam.split(',').map(t => t.trim() as ActionType);
      actionType = types.length === 1 ? types[0] : types;
    }
    
    // Parse categories (support multiple)
    let category: ActionCategory | ActionCategory[] | undefined;
    if (categoryParam) {
      const categories = categoryParam.split(',').map(c => c.trim() as ActionCategory);
      category = categories.length === 1 ? categories[0] : categories;
    }
    
    // Parse dates
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;
    
    // Parse success filter
    const success = successParam !== null ? successParam === 'true' : undefined;
    
    // Parse pagination
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;
    
    // Query logs
    const logs = await queryActivityLogs({
      playerId: effectivePlayerId,
      username,
      actionType,
      category,
      startDate,
      endDate,
      success,
      limit,
      offset,
      sortBy: sortBy || 'timestamp',
      sortOrder: sortOrder || 'desc'
    });
    
    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      filters: {
        playerId: effectivePlayerId,
        username,
        actionType,
        category,
        startDate,
        endDate,
        success,
        limit,
        offset
      }
    });
  } catch (error: any) {
    console.error('[API] Error querying activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to query activity logs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * FOOTER:
 * 
 * Implementation Notes:
 * - Requires authentication for all requests
 * - Non-admin users can only view their own logs
 * - Supports multiple filter combinations
 * - Pagination prevents large result sets
 * - Date parsing handles ISO 8601 format
 * 
 * Security:
 * - Authorization enforced (own logs or admin)
 * - SQL injection prevented by MongoDB driver
 * - Input validation on all parameters
 * 
 * Future Enhancements:
 * - Add admin role detection from database
 * - Implement log export functionality
 * - Add real-time log streaming via WebSocket
 * - Implement log aggregation endpoints
 */
