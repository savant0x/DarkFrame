/**
 * Admin Bot Spawn API — Full implementation
 * Creates real bot player records in the database.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';

const BOT_NAMES = ['Bot_Alpha', 'Bot_Beta', 'Bot_Gamma', 'Bot_Delta', 'Bot_Epsilon', 'Bot_Zeta', 'Bot_Eta', 'Bot_Theta', 'Bot_Iota', 'Bot_Kappa'];
const BOT_SPECS: Array<'offensive' | 'defensive' | 'tactical'> = ['offensive', 'defensive', 'tactical'];

function generateBotUsername(): string {
  const base = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}_${suffix}`;
}

function generateBotEmail(username: string): string {
  return `bot_${username.toLowerCase()}@darkframe.internal`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (!auth.isAdmin) return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });

    const body = await req.json();
    const username = auth.username;
    const count = Math.min(body.count || 10, 50);
    const specialization = body.specialization || 'random';
    const supabase = createServiceClient();

    const spawned: string[] = [];
    const spec = specialization === 'random'
      ? BOT_SPECS[Math.floor(Math.random() * BOT_SPECS.length)]
      : specialization;

    for (let i = 0; i < count; i++) {
      const botUsername = generateBotUsername();
      const email = generateBotEmail(botUsername);
      const x = Math.floor(Math.random() * 150) + 1;
      const y = Math.floor(Math.random() * 150) + 1;

      const { error } = await supabase.from('players').insert({
        username: botUsername,
        email,
        password: 'supabase_auth',
        current_x: x,
        current_y: y,
        base_x: x,
        base_y: y,
        is_bot: true,
        level: Math.floor(Math.random() * 20) + 1,
        rank: Math.floor(Math.random() * 5) + 1,
        spec_doctrine: spec,
        resources_metal: Math.floor(Math.random() * 10000),
        resources_energy: Math.floor(Math.random() * 10000),
        total_strength: Math.floor(Math.random() * 500),
        total_defense: Math.floor(Math.random() * 500),
      });

      if (error) {
        console.error('Bot insert failed:', error.message);
        continue;
      }
      spawned.push(botUsername);
    }

    const { count: totalAfter } = await supabase
      .from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true);

    await supabase.from('admin_logs').insert({
      admin_username: username,
      action: 'spawn_bots',
      target: 'bot_ecosystem',
      details: { count: spawned.length, specialization: spec },
    });

    return NextResponse.json({
      success: true,
      data: { spawned: spawned.length, totalBefore: (totalAfter || 0) - spawned.length, totalAfter: totalAfter || 0 },
      message: `${spawned.length} bots spawned with spec: ${spec}`,
    });
  } catch (error) {
    console.error('Bot spawn error:', error);
    return NextResponse.json({ success: false, error: 'Failed to spawn bots' }, { status: 500 });
  }
}
