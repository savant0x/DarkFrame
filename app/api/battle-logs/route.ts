/**
 * @file app/api/battle-logs/route.ts
 * @created 2026-09-12
 * @overview FID-20260912-075 — player battle-logs endpoint.
 *
 * The /game/battle-logs/[type] page has fetched `/api/battle-logs` since
 * 2025-10-17, but the route never existed (only /api/admin/battle-logs and
 * /api/combat/logs did) — the viewer 404'd on every visit and rendered an
 * empty table. This implements the page's exact contract:
 *
 *   GET /api/battle-logs?username=&type=attack|defense|infantry|land-mines
 *                       &page=&limit=
 *   → { logs: BattleLogRow[], total, page, totalPages }
 *
 * Perspective: for type=attack the caller is the attacker; for defense the
 * caller is the defender. Pagination is (page-1)*limit → limit with a COUNT
 * over the same predicate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { battleLogs } from '@/lib/db/schema/battle';
import { and, desc, eq, or, sql } from 'drizzle-orm';

const VALID_TYPES = ['attack', 'defense', 'infantry', 'land-mines'] as const;
type LogType = (typeof VALID_TYPES)[number];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const type = (searchParams.get('type') || 'attack') as LogType;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'username query parameter is required' },
        { status: 400 }
      );
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: `type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Perspective filter: attack = caller attacked; defense = caller defended.
    // infantry is type-agnostic (either side); land-mines has no writer yet,
    // so it returns an honest empty set instead of pretending.
    // battleType is stored via the BattleType enum (UPPERCASE: 'INFANTRY').
    const sideCol =
      type === 'attack'
        ? battleLogs.attackerUsername
        : type === 'defense'
          ? battleLogs.defenderUsername
          : null;

    const predicate = and(
      sideCol ? eq(sideCol, username) : or(eq(battleLogs.attackerUsername, username), eq(battleLogs.defenderUsername, username)),
      type === 'infantry' ? eq(battleLogs.battleType, 'INFANTRY') : undefined
    );

    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(battleLogs)
        .where(predicate)
        .orderBy(desc(battleLogs.timestamp))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(battleLogs).where(predicate),
    ]);

    const total = countRows[0]?.count ?? 0;

    const logs = rows.map((row) => {
      // Result from the VIEWER's perspective: if the viewer was the attacker,
      // ATTACKER_WIN is a victory; if the viewer was the defender, DEFENDER_WIN
      // is a victory. Draws render as defeat (no gain) — the page's union only
      // carries victory | defeat.
      const viewerWasAttacker = row.attackerUsername === username;
      const won =
        (viewerWasAttacker && row.outcome === 'ATTACKER_WIN') ||
        (!viewerWasAttacker && row.outcome === 'DEFENDER_WIN');
      return {
        _id: row.battleId,
        attackerUsername: row.attackerUsername,
        defenderUsername: row.defenderUsername,
        result: won ? 'victory' : 'defeat',
        type,
        metalGained: row.resourcesStolenResourceType === 'metal' ? row.resourcesStolenAmount ?? 0 : 0,
        metalLost: 0,
        energyGained: row.resourcesStolenResourceType === 'energy' ? row.resourcesStolenAmount ?? 0 : 0,
        energyLost: 0,
        location: {
          x: row.locationX ?? 0,
          y: row.locationY ?? 0,
        },
        timestamp: row.timestamp.toISOString(),
        attackerStrength: row.attackerTotalSTR,
        defenderStrength: row.defenderTotalSTR,
        attackerLosses: row.attackerUnitsLost,
        defenderLosses: row.defenderUnitsLost,
      };
    });

    return NextResponse.json({
      success: true,
      logs,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error('❌ battle-logs fetch failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch battle logs' },
      { status: 500 }
    );
  }
}
