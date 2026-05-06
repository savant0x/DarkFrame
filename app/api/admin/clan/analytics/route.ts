/**
 * Admin clan analytics route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
  if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });
  const clanId = req.nextUrl.searchParams.get('clanId');
  if (!clanId) return NextResponse.json({ success: false, error: 'clanId required' }, { status: 400 });
  try {
    const supabase = createServiceClient();
    const [{ count: memberCount }, { data: clan }, { data: territory }] = await Promise.all([
      supabase.from('clan_members').select('*', { count: 'exact', head: true }).eq('clan_id', clanId),
      supabase.from('clans').select('*').eq('id', clanId).single(),
      supabase.from('clan_territories').select('*').eq('clan_id', clanId),
    ]);
    return NextResponse.json({
      success: true,
      data: { clan, memberCount: memberCount || 0, territoryCount: territory?.length || 0 },
    });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
