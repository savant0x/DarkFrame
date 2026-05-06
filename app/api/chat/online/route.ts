/**
 * @file app/api/chat/online/route.ts
 * @overview Online player tracking — queries active sessions with proper player data resolution
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const ONLINE_TIMEOUT_MS = 120000; // Must match heartbeat SESSION_TIMEOUT_MS

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - ONLINE_TIMEOUT_MS).toISOString();

    // Query active sessions — filter by last_heartbeat within timeout window
    console.log(`[Online API] Querying for channelId=${channelId} cutoff=${cutoff}`);
    // Primary query: sessions with recent last_heartbeat
    let { data: sessions, error: sessionsError } = await supabase
      .from('player_sessions')
      .select('player_username, last_heartbeat, started_at')
      .is('ended_at', null)
      .gte('last_heartbeat', cutoff)
      .order('last_heartbeat', { ascending: false });

    console.log('[Online API] Primary last_heartbeat query: ' + (sessions || []).length + ' sessions');

    // Fallback: if no heartbeat sessions, try by started_at
    if (!sessions || sessions.length === 0) {
      console.log('[Online API] No heartbeat sessions, trying fallback by started_at...');
      const fallbackResult = await supabase
        .from('player_sessions')
        .select('player_username, last_heartbeat, started_at')
        .is('ended_at', null)
        .gte('started_at', cutoff)
        .order('started_at', { ascending: false });
      sessions = fallbackResult.data;
      sessionsError = fallbackResult.error;
      console.log('[Online API] Fallback started_at query: ' + (sessions || []).length + ' sessions');
    }
    if (sessionsError) {
      console.error('[Online API] Sessions query error:', sessionsError);
      return NextResponse.json({ total: 0, channels: {}, users: [], onlineCount: 0 });
    }

    // Deduplicate by username (keep most recent heartbeat)
    const seenUsernames = new Set<string>();
    const uniqueUsernames: string[] = [];
    for (const session of sessions || []) {
      if (!seenUsernames.has(session.player_username)) {
        seenUsernames.add(session.player_username);
        uniqueUsernames.push(session.player_username);
      }
    }

    // Fetch player data in bulk for all online usernames
    let playerDataMap = new Map<string, { level: number; is_vip: boolean }>();

    if (uniqueUsernames.length > 0) {
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('username, level, is_vip')
        .in('username', uniqueUsernames);

      if (playersError) {
        console.error('[Online API] Players query error:', playersError);
      } else {
        for (const p of players || []) {
          playerDataMap.set(p.username, {
            level: p.level || 1,
            is_vip: !!p.is_vip,
          });
        }
      }
    }

    // Build online users list with resolved player data
    const onlineUsers: Array<{ userId: string; username: string; level: number; isVIP: boolean; lastSeen: string }> = [];

    for (const session of sessions || []) {
      // Skip duplicates (we already found unique usernames, but sessions may have multiple rows)
      if (!seenUsernames.has(session.player_username)) continue;
      seenUsernames.delete(session.player_username); // Mark as processed

      const playerData = playerDataMap.get(session.player_username);
      onlineUsers.push({
        userId: session.player_username,
        username: session.player_username,
        level: playerData?.level ?? 1,
        isVIP: playerData?.is_vip ?? false,
        lastSeen: session.last_heartbeat,
      });
    }

    if (channelId) {
      const filtered = onlineUsers.filter((u) => {
        if (channelId === 'global' || channelId === 'trade' || channelId === 'help' || channelId === 'clan') return true;
        if (channelId === 'vip') return u.isVIP;
        if (channelId === 'newbie') return u.level >= 1 && u.level <= 5;
        return true;
      });

      console.log('[Online API] Return: channelId=' + channelId + ' onlineCount=' + filtered.length);
      return NextResponse.json({
        channelId,
        onlineCount: filtered.length,
        count: filtered.length,
        users: filtered,
      });
    }

    // Return ALL online players across all channels
    const channels: Record<string, number> = {
      global: onlineUsers.length,
      newbie: onlineUsers.filter((u) => u.level >= 1 && u.level <= 5).length,
      vip: onlineUsers.filter((u) => u.isVIP).length,
      trade: onlineUsers.length,
      help: onlineUsers.length,
    };

    return NextResponse.json({
      total: onlineUsers.length,
      onlineCount: onlineUsers.length,
      channels,
      users: onlineUsers,
    });
  } catch (error) {
    console.error('[Online API] Error:', error);
    return NextResponse.json({ total: 0, channels: {}, users: [], onlineCount: 0 });
  }
}
