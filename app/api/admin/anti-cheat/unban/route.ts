/**
 * Admin Unban Player API
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = body.username;
    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

    const supabase = createServiceClient();

    const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
    if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    await supabase.from('admin_logs').insert({
      admin_username: username,
      action: 'unban_player',
      target: username,
      details: {},
    });

    return NextResponse.json({ success: true, message: `${username} unban recorded` });
  } catch (error) {
    console.error('Unban error:', error);
    return NextResponse.json({ success: false, error: 'Failed to unban player' }, { status: 500 });
  }
}
