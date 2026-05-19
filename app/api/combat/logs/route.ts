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
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, getPlayerCombatHistory, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const { searchParams } = new URL(request.url);
    const summaryParam = searchParams.get('summary');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '10', 10), 50);

    if (summaryParam === 'true') {
      const supabase = createServiceClient();

      const baseQuery = supabase
        .from('battle_logs')
        .select('*', { count: 'exact', head: true })
        .or(`attacker_username.eq.${username},defender_username.eq.${username}`);

      const attackQuery = supabase
        .from('battle_logs')
        .select('*', { count: 'exact', head: true })
        .eq('attacker_username', username);

      const defenseQuery = supabase
        .from('battle_logs')
        .select('*', { count: 'exact', head: true })
        .eq('defender_username', username);

      const infantryQuery = supabase
        .from('battle_logs')
        .select('*', { count: 'exact', head: true })
        .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
        .eq('battle_type', 'INFANTRY');

      const [totalRes, attackRes, defenseRes, infantryRes] = await Promise.all([
        baseQuery,
        attackQuery,
        defenseQuery,
        infantryQuery,
      ]);

      return NextResponse.json({
        success: true,
        attackCount: attackRes.count ?? 0,
        defenseCount: defenseRes.count ?? 0,
        infantryCount: infantryRes.count ?? 0,
        landMineCount: 0,
        totalCount: totalRes.count ?? 0,
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
    logger.error('Fetch battle logs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching battle logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
