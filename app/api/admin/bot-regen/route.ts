/**
 * Admin Bot Regen Cycle API — Full implementation
 * Cleans up old/inactive bot records and spawns replacement bots.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { logger } from '@/lib';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!auth.isAdmin) return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });

    const supabase = createServiceClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Count bots before regen
    const { count: countBefore } = await supabase
      .from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true);

    // Remove old bot records (created over 30 days ago, never logged in recently)
    const { data: oldBots, error: queryError } = await supabase
      .from('players')
      .select('username')
      .eq('is_bot', true)
      .lt('created_at', thirtyDaysAgo)
      .or(`last_login_date.is.null,last_login_date.lt.${thirtyDaysAgo}`)
      .limit(50);

    let cleaned = 0;
    if (oldBots && oldBots.length > 0) {
      const usernames = oldBots.map(b => b.username);
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .in('username', usernames);

      if (!deleteError) cleaned = usernames.length;
    }

    // Spawn replacement bots
    let spawned = 0;
    const replacementCount = Math.min(cleaned, 20);
    for (let i = 0; i < replacementCount; i++) {
      const x = Math.floor(Math.random() * 150) + 1;
      const y = Math.floor(Math.random() * 150) + 1;
      const username = `Bot_Regen_${crypto.randomUUID().replace(/-/g, '').substring(0, 6)}`;
      const { error } = await supabase.from('players').insert({
        username,
        email: `bot_regen_${username.toLowerCase()}@darkframe.internal`,
        password: 'supabase_auth',
        current_x: x, current_y: y, base_x: x, base_y: y,
        is_bot: true,
        level: Math.floor(Math.random() * 15) + 1,
        rank: Math.floor(Math.random() * 3) + 1,
        resources_metal: Math.floor(Math.random() * 5000),
        resources_energy: Math.floor(Math.random() * 5000),
      });
      if (!error) spawned++;
    }

    const { count: countAfter } = await supabase
      .from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true);

    await supabase.from('admin_logs').insert({
      admin_username: 'system',
      action: 'regen_cycle',
      target: 'bot_ecosystem',
      details: { cleaned, spawned, botCountBefore: countBefore, botCountAfter: countAfter },
    });

    return NextResponse.json({
      success: true,
      data: { updated: cleaned + spawned, spawned, cleaned, totalBefore: countBefore, totalAfter: countAfter },
      message: `Regen complete: ${cleaned} bots cleaned, ${spawned} replacement bots spawned`,
    });
  } catch (error) {
    logger.error('Regen error:', error);
    return NextResponse.json({ success: false, error: 'Regen cycle failed' }, { status: 500 });
  }
}
