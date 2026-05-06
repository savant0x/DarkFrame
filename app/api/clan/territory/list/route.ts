/**
 * Clan territory list route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const clanId = req.nextUrl.searchParams.get('clanId');
  if (!clanId) return NextResponse.json({ success: false, error: 'clanId required' }, { status: 400 });
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from('clan_territories').select('*').eq('clan_id', clanId);
    return NextResponse.json({ success: true, territories: data });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
