/**
 * Session Trends Analytics — Supabase backend
 */
import { requireAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
  if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });

  const period = searchParams.get('period') || '7d';

  // Active players in period
  const since = new Date();
  if (period === '24h') since.setDate(since.getDate() - 1);
  else if (period === '7d') since.setDate(since.getDate() - 7);
  else since.setDate(since.getDate() - 30);

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
