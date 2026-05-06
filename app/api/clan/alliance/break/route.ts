/**
 * Clan alliance break route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { allianceId } = await req.json();
    const supabase = createServiceClient();
    await supabase.from('clan_alliances').update({ status: 'BROKEN' }).eq('id', allianceId);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
