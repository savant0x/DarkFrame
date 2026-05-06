/**
 * Friends online status — Supabase backend
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });
  try {
    const supabase = createServiceClient();
    const { data: friends } = await supabase.from('friends').select('friend_username').eq('user_username', username);
    if (!friends?.length) return NextResponse.json({ success: true, online: [] });
    const friendIds = friends.map(f => f.friend_username);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('players').select('username').in('username', friendIds).gte('last_login_date', today);
    return NextResponse.json({ success: true, online: (data || []).map(p => p.username) });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
