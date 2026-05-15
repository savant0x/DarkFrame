/**
 * Session Trends Analytics — Supabase backend
 */
import { requireAdminAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = request.nextUrl;
  const period = searchParams.get('period') || '7d';

  const since = new Date();
  if (period === '24h') since.setDate(since.getDate() - 1);
  else if (period === '7d') since.setDate(since.getDate() - 7);
  else since.setDate(since.getDate() - 30);

  const supabase = createServiceClient();

  const { count: activeCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gte('last_login_date', since.toISOString().split('T')[0]);

  const { count: totalCount } = await supabase.from('players').select('*', { count: 'exact', head: true });

  return NextResponse.json({
    success: true,
    period,
    stats: {
      activePlayers: activeCount || 0,
      totalPlayers: totalCount || 0,
    },
  });
}
