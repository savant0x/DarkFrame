/**
 * @file app/api/combat/logs/route.ts
 * @created 2025-10-17
 * @overview Battle Logs API - Retrieve combat history
 * 
 * OVERVIEW:
 * GET endpoint for fetching player's recent battle history. Returns both
 * offensive (player attacked) and defensive (player was attacked) battles.
 * 
 * QUERY PARAMETERS:
 * ?limit=10  // Number of logs to return (default: 10, max: 50)
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "logs": BattleLog[],
 *   "count": number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { getPlayerCombatHistory } from '@/lib/battleService';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const usernameParam = searchParams.get('username');
    const summaryParam = searchParams.get('summary');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '10', 10), 50); // Max 50 logs

    // Determine username from auth or query parameter
    let username: string;
    
    if (usernameParam) {
      // Allow username from query parameter (for summary counts)
      username = usernameParam;
    } else {
      // Verify authentication
      const authResult = await verifyAuth();
      if (!authResult || !authResult.username) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }
      username = authResult.username;
    }

    // Handle summary request (just counts, no auth required)
    if (summaryParam === 'true') {
      // For now, return zero counts - this endpoint would need battle log collection
      return NextResponse.json({
        success: true,
        attackCount: 0,
        defenseCount: 0,
        infantryCount: 0,
        landMineCount: 0
      });
    }

    // Fetch battle logs
    const logs = await getPlayerCombatHistory(username, limit);

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length
    });

  } catch (error) {
    console.error('Fetch battle logs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching battle logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
