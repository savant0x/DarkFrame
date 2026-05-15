/**
 * Admin Player Flags API
 */
import { requireAdminAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  const targetUsername = req.nextUrl.searchParams.get('target');
  if (!targetUsername) return NextResponse.json({ success: false, error: 'target parameter required' }, { status: 400 });

  const supabase = createServiceClient();
  try {
    const { data } = await supabase.from('admin_logs')
      .select('*').eq('target', targetUsername)
      .order('created_at', { ascending: false }).limit(50);

    return NextResponse.json({
      success: true,
      data: (data || []).map(f => ({
        id: f.id, playerId: f.target, type: f.action,
        severity: 'medium', details: f.details || '', timestamp: f.created_at,
        adminUsername: f.admin_username,
      })),
    });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}
