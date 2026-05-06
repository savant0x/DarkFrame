/**
 * Clan territory unclaim route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { territoryId } = await req.json();
    await createServiceClient().from('clan_territories').delete().eq('id', territoryId);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
