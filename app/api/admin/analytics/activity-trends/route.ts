/**
 * Activity Trends Analytics — Supabase backend
 */
import { requireAdminAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = request.nextUrl;
  const period = searchParams.get('period') || '7d';

  const supabase = createServiceClient();

  const since = new Date();
  if (period === '24h') since.setDate(since.getDate() - 1);
  else if (period === '7d') since.setDate(since.getDate() - 7);
  else since.setDate(since.getDate() - 30);

  const { data: logs, count } = await supabase
    .from('admin_logs')
    .select('action, created_at', { count: 'exact' })
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })
    .limit(500);

  const { count: battleCount } = await supabase
    .from('battle_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since.toISOString());

  return NextResponse.json({
    success: true,
    period,
    data: (logs || []).map(l => ({ action: l.action, timestamp: l.created_at })),
    stats: { totalActions: count || 0, battles: battleCount || 0 },
  });
}
