/**
 * Admin clan analytics route
 */
import { requireAdminAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (auth instanceof NextResponse) return auth;

  const clanId = req.nextUrl.searchParams.get('clanId');
  if (!clanId) return NextResponse.json({ success: false, error: 'clanId required' }, { status: 400 });

  const supabase = createServiceClient();
  try {
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
