/**
 * Admin Give Resources API
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

    const { metal, energy } = body;

    const { data: player } = await supabase.from('players').select('resources_metal, resources_energy').eq('username', username).single();

    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const newMetal = (player.resources_metal || 0) + (metal || 0);
    const newEnergy = (player.resources_energy || 0) + (energy || 0);

    await supabase.from('players').update({
      resources_metal: newMetal,
      resources_energy: newEnergy,
    }).eq('username', username);

    return NextResponse.json({
      success: true,
      message: `Gave ${username} ${metal || 0} metal, ${energy || 0} energy`,
      data: { metal: newMetal, energy: newEnergy },
    });
  } catch (error) {
    console.error('Give resources error:', error);
    return NextResponse.json({ success: false, error: 'Failed to give resources' }, { status: 500 });
  }
}
