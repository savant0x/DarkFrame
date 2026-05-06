/**
 * Admin Player Flags API
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
  if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from('admin_logs')
      .select('*').eq('target', username)
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
