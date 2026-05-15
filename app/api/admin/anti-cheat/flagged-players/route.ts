/**
 * Flag Breakdown Analytics — Supabase backend
 */
import { requireAdminAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();

  const { data: logs } = await supabase.from('admin_logs').select('action').order('created_at', { ascending: false }).limit(200);

  const breakdown: Record<string, number> = {};
  (logs || []).forEach(l => { breakdown[l.action] = (breakdown[l.action] || 0) + 1; });

  return NextResponse.json({
    success: true,
    data: Object.entries(breakdown).map(([type, count]) => ({ type, count })),
  });
}
