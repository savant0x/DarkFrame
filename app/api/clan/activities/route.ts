/**
 * Clan activities route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const clanId = req.nextUrl.searchParams.get('clanId');
  if (!clanId) return NextResponse.json({ success: false, error: 'clanId required' }, { status: 400 });
  try {
    const { data } = await createServiceClient().from('clan_activity').select('*').eq('clan_id', clanId).order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ success: true, data });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
