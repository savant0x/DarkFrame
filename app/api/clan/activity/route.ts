/**
 * Clan activity route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const clanId = req.nextUrl.searchParams.get('clanId');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
  if (!clanId) return NextResponse.json({ success: false, error: 'clanId required' }, { status: 400 });
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from('clan_activity').select('*').eq('clan_id', clanId).order('created_at', { ascending: false }).limit(limit);
    return NextResponse.json({ success: true, activities: data });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
