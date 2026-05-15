/**
 * @file app/api/battle-logs/route.ts
 * @created 2026-05-15 — FID-20260515-BATTLE-LOG-UI-FIX
 * @overview Battle Logs API with type filtering and pagination
 *
 * QUERY PARAMETERS:
 * ?type=attack|defense|infantry  // Filter by battle role/type
 * ?page=1                        // Page number (default: 1)
 * ?limit=20                      // Items per page (default: 20, max: 50)
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "logs": BattleLog[],
 *   "total": number,
 *   "page": number,
 *   "totalPages": number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import { mapDbBattleLogToDomain } from '@/lib/battleLogService';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10)), 50);
    const offset = (page - 1) * limit;

    const supabase = createServiceClient();

    let countQuery = supabase
      .from('battle_logs')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase
      .from('battle_logs')
      .select('*');

    switch (typeParam) {
      case 'attack':
        countQuery = countQuery.eq('attacker_username', username);
        dataQuery = dataQuery.eq('attacker_username', username);
        break;
      case 'defense':
        countQuery = countQuery.eq('defender_username', username);
        dataQuery = dataQuery.eq('defender_username', username);
        break;
      case 'infantry':
        countQuery = countQuery
          .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
          .eq('battle_type', 'INFANTRY');
        dataQuery = dataQuery
          .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
          .eq('battle_type', 'INFANTRY');
        break;
      default:
        countQuery = countQuery.or(`attacker_username.eq.${username},defender_username.eq.${username}`);
        dataQuery = dataQuery.or(`attacker_username.eq.${username},defender_username.eq.${username}`);
        break;
    }

    const [countRes, dataRes] = await Promise.all([
      countQuery,
      dataQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1),
    ]);

    if (dataRes.error) {
      throw new Error(dataRes.error.message);
    }

    const total = countRes.count ?? 0;
    const logs = (dataRes.data || []).map((row) => mapDbBattleLogToDomain(row));

    return NextResponse.json({
      success: true,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Fetch battle logs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching battle logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
