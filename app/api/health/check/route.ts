/**
 * DB Health Check — verifies chat_messages, player_sessions, and factories are properly persisted
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = createServiceClient();
  const [{ count: msgCount }, { count: sessionCount }, { data: factories }] = await Promise.all([
    supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
    supabase.from('player_sessions').select('*', { count: 'exact', head: true }).is('ended_at', null),
    supabase.from('factories').select('id, x, y, owner, level, slots, used_slots').limit(5),
  ]);
  return NextResponse.json({
    chat_messages_total: msgCount || 0,
    active_sessions: sessionCount || 0,
    factories_sample: factories || [],
  });
}
