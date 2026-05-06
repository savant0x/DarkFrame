/**
 * @file app/api/players/search/route.ts
 * @created 2025-10-26
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Player search API endpoint for DM system
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';

const MAX_SEARCH_RESULTS = 20;
const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 50;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

  if (!query) {
      return NextResponse.json(
        { error: 'Bad Request', details: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        { error: 'Bad Request', details: `Search query must be at least ${MIN_QUERY_LENGTH} character(s)` },
        { status: 400 }
      );
    }

    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: 'Bad Request', details: `Search query must not exceed ${MAX_QUERY_LENGTH} characters` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data: players } = await supabase
      .from('players')
      .select('username, level, is_vip, clan_name')
      .ilike('username', `%${trimmedQuery}%`)
      .neq('username', username)
      .order('level', { ascending: false })
      .limit(MAX_SEARCH_RESULTS);

    const results = (players || []).map(player => ({
      _id: player.username,
      username: player.username,
      level: player.level || 1,
      vip: player.is_vip || false,
      clanTag: player.clan_name || undefined,
    }));

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[API] Player search error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: 'An unexpected error occurred while searching for players' },
      { status: 500 }
    );
  }
}
