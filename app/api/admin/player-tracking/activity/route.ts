/**
 * Admin Player Activity API
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
    const { data } = await supabase
      .from('admin_logs')
      .select('id, action, details, created_at, target')
      .eq('target', targetUsername)
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
