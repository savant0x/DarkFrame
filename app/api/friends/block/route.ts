/**
 * Friends block route — Supabase backend
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = body.username;
    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });
    const supabase = createServiceClient();
    await supabase.from('friends').delete().eq('user_username', username).eq('friend_username', username);
    await supabase.from('friends').delete().eq('user_username', username).eq('friend_username', username);
    await supabase.from('blocked_users').insert({ blocker_username: username, blocked_username: username });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
