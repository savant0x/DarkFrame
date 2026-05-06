/**
 * Clan main route — Supabase backend
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const clanId = req.nextUrl.searchParams.get('clanId');
  try {
    const supabase = createServiceClient();
    if (clanId) {
      const { data } = await supabase.from('clans').select('*').eq('id', clanId).single();
      return NextResponse.json(data ? { success: true, data } : { success: false, error: 'Not found' });
    }
    const { data } = await supabase.from('clans').select('*').order('level', { ascending: false }).limit(50);
    return NextResponse.json({ success: true, data });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
