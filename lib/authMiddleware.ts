/**
 * Supabase-Aware Auth Middleware for API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

type PlayerRow = Tables<'players'>;
type ClanRow = Tables<'clans'>;

export interface TokenPayload {
  username: string;
  email: string;
  id: string;
  rank?: number;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  username: string;
  /** NOTE: This field holds the player's username (text), NOT a UUID. The `players` table uses `username` as its primary key. All clan service functions treat `playerId` as a username for lookups. */
  playerId: string;
  player: PlayerRow;
  isAdmin: boolean;
}

async function resolveAuth(): Promise<AuthResult | null> {
  try {
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

    return {
      username,
      playerId: username,
      player,
      isAdmin: Boolean(player.is_admin),
    };
  } catch {
    return null;
  }
}

export async function authenticateRequest(
  _request: NextRequest,
  _db?: unknown,
  _cookieName?: string
): Promise<AuthResult | null> {
  return resolveAuth();
}

export async function requireAuth(
  _request: NextRequest,
  _db?: unknown,
  _cookieName?: string
): Promise<AuthResult | NextResponse> {
  const auth = await resolveAuth();
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return auth;
}

export async function requireAdmin(
  _request: NextRequest,
  _db?: unknown,
  _cookieName?: string
): Promise<AuthResult | NextResponse> {
  const auth = await requireAuth(_request);
  if (auth instanceof NextResponse) return auth;
  if (!auth.isAdmin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  return auth;
}

export async function requireClanMembership(
  _request: NextRequest,
  _db?: unknown
): Promise<{ auth: AuthResult; clan: ClanRow; clanId: string } | NextResponse> {
  const auth = await requireAuth(_request);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceClient();
  const { data: member, error: memberError } = await supabase
    .from('clan_members')
    .select('clan_id')
    .eq('player_id', auth.username)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json({ success: false, error: 'You are not in a clan' }, { status: 400 });
  }

  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('*')
    .eq('id', member.clan_id)
    .single();

  if (clanError || !clan) {
    return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });
  }

  return { auth, clan, clanId: clan.id };
}

export async function getAuthenticatedUser(): Promise<TokenPayload | null> {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const username = (user.user_metadata?.username as string) ?? user.email!;
  const { data: player } = await supabase
    .from('players')
    .select('is_admin, rank')
    .eq('username', username)
    .maybeSingle();

  return {
    id: user.id,
    username,
    email: user.email!,
    isAdmin: Boolean(player?.is_admin),
    rank: player?.rank ?? 1,
  };
}

export const verifyAuth = getAuthenticatedUser;

export async function verifyToken(_token: string): Promise<TokenPayload | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser(_token);
  if (!user) return null;

  const username = (user.user_metadata?.username as string) ?? user.email!;
  const { data: player } = await supabase
    .from('players')
    .select('is_admin, rank')
    .eq('username', username)
    .maybeSingle();

  return {
    id: user.id,
    username,
    email: user.email!,
    isAdmin: Boolean(player?.is_admin),
    rank: player?.rank ?? 1,
  };
}
