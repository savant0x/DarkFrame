// API Route: /api/stats/battles
// Returns aggregated battle stats for a player or recent battles
import { NextRequest, NextResponse } from 'next/server';
import { getPlayerBattleStats } from '@/lib';
import { getRecentCombatLogs } from '@/lib/battleLogService';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  if (username) {
    const stats = await getPlayerBattleStats(username);
    return NextResponse.json(stats);
  } else {
    const recent = await getRecentCombatLogs(10);
    return NextResponse.json(recent);
  }
}
