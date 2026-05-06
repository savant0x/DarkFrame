/**
 * Combat base attack route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = body.username;
    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });
    const { targetUsername } = body;
    const supabase = createServiceClient();
    const { data: attacker } = await supabase.from('players').select('total_strength,total_defense').eq('username', username).single();
    const { data: defender } = await supabase.from('players').select('total_defense').eq('username', targetUsername).single();
    if (!defender) return NextResponse.json({ success: false, error: 'Target not found' }, { status: 404 });
    const damage = Math.max(0, (attacker?.total_strength || 0) - (defender?.total_defense || 0));
    return NextResponse.json({ success: true, data: { damage, target: targetUsername } });
  } catch { return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 }); }
}
