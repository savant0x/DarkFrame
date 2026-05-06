/**
 * Clan promote/demote/kick route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { clanId, username, action } = await req.json();
    const supabase = createServiceClient();

    if (action === 'promote') {
      await supabase.from('clan_members').update({ role: 'OFFICER' }).eq('clan_id', clanId).eq('player_id', username);
    } else if (action === 'demote') {
      await supabase.from('clan_members').update({ role: 'MEMBER' }).eq('clan_id', clanId).eq('player_id', username);
    } else if (action === 'kick') {
      await supabase.from('clan_members').delete().eq('clan_id', clanId).eq('player_id', username);
      await supabase.from('players').update({ clan_id: null }).eq('username', username);
    }
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
