/**
 * WMD API Helpers — Supabase Auth
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

type PlayerRow = Tables<'players'>;

export async function verifyAuth(_request: NextRequest, _db?: unknown): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return (user.user_metadata?.username as string) ?? user.email!;
  } catch {
    return null;
  }
}

export async function getAuthenticatedPlayer(
  _request: NextRequest,
  _db?: unknown
): Promise<{ username: string; playerId: string; player: PlayerRow } | null> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const username = (user.user_metadata?.username as string) ?? user.email!;
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('username', username)
    .single();

  if (playerError || !player) return null;

  return { username, playerId: username, player };
}
