/**
 * Admin Player Activity API
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
    const { data } = await supabase
      .from('admin_logs')
      .select('id, action, details, created_at, target')
      .eq('target', username)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      data: (data || []).map(a => ({
        id: a.id,
        username: a.target,
        action: a.action,
        details: typeof a.details === 'object' ? a.details : { raw: a.details },
        timestamp: a.created_at,
      })),
    });
  } catch (error) {
    console.error('Activity error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load activity' }, { status: 500 });
  }
}
