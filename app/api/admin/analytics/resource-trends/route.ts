/**
 * Resource Trends Analytics — Supabase backend
 */
import { requireAuth } from '@/lib/authMiddleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: adminCheck } = await supabase.from('players').select('is_admin, rank').eq('username', username).single();
  if (!adminCheck?.is_admin && (adminCheck?.rank || 0) < 5) return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });

  const period = searchParams.get('period') || '7d';

  // Sum resources gathered from players table
  const { data } = await supabase.from('players').select('username, resources_metal, resources_energy, stat_total_resources_gathered').order('stat_total_resources_gathered', { ascending: false }).limit(20);

  const topGatherers = (data || []).map(p => ({
    username: p.username,
    metal: p.resources_metal || 0,
    energy: p.resources_energy || 0,
    total: p.stat_total_resources_gathered || 0,
  }));

  return NextResponse.json({
    success: true,
    period,
    data: topGatherers,
    stats: {
      topGathererCount: topGatherers.length,
      totalGathered: topGatherers.reduce((s, p) => s + p.total, 0),
    },
  });
}
