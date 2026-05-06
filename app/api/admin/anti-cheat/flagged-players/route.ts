/**
 * Flag Breakdown Analytics — Supabase backend
 */
import { requireAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

  const supabase = createServiceClient();

  const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
  if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const { data: logs } = await supabase.from('admin_logs').select('action').order('created_at', { ascending: false }).limit(200);

  const breakdown: Record<string, number> = {};
  (logs || []).forEach(l => { breakdown[l.action] = (breakdown[l.action] || 0) + 1; });

  return NextResponse.json({
    success: true,
    data: Object.entries(breakdown).map(([type, count]) => ({ type, count })),
  });
}
