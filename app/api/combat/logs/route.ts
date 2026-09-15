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
import { db } from '@/lib/db';
import { battleLogs } from '@/lib/db/schema';
import { and, count, eq, or } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const summaryParam = searchParams.get('summary');
    const limitParam = searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '10', 10), 50); // Max 50 logs

    // FID-20260914-002: session identity — the query-string username is no
    // longer trusted (the panel's fetch authenticates via cookie anyway).
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const username = authResult.username;

    // FID-20260914-002: real counts — the summary previously returned
    // hardcoded zeros ("this endpoint would need battle log collection"),
    // so every Battle Log panel counter read 0 while Recent Raids (which
    // reads battle_logs) showed the actual battles.
    if (summaryParam === 'true') {
      const [attackRow] = await db
        .select({ n: count() })
        .from(battleLogs)
        .where(eq(battleLogs.attackerUsername, username));
      const [defenseRow] = await db
        .select({ n: count() })
        .from(battleLogs)
        .where(eq(battleLogs.defenderUsername, username));
      const [infantryRow] = await db
        .select({ n: count() })
        .from(battleLogs)
        .where(
          and(
            eq(battleLogs.battleType, 'INFANTRY'),
            or(
              eq(battleLogs.attackerUsername, username),
              eq(battleLogs.defenderUsername, username)
            )
          )
        );
      return NextResponse.json({
        success: true,
        attackCount: Number(attackRow?.n ?? 0),
        defenseCount: Number(defenseRow?.n ?? 0),
        infantryCount: Number(infantryRow?.n ?? 0),
        // No LandMine battle type exists yet (types BattleType) — the panel
        // row is future-proofing; the count is legitimately 0 until then.
        landMineCount: 0,
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
