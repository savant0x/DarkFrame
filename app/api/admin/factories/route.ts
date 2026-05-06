/**
 * Admin Factories Endpoint — Supabase backend
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
  if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const { data: factories } = await supabase
    .from('factories')
    .select('*')
    .order('x', { ascending: true })
    .limit(10000);

  return NextResponse.json({
    factories: (factories || []).map(f => ({
      id: f.id,
      x: f.x,
      y: f.y,
      owner: f.owner || null,
      defense: f.defense || 0,
      slots: f.slots || 0,
      used_slots: f.used_slots || 0,
      level: f.level || 1,
      production_rate: f.production_rate || 0,
    })),
  });
}
