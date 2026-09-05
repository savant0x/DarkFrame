/**
 * @file app/api/clan/search/route.ts
 * @created 2026-09-04
 * @overview Clan search for browse/join UIs (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/search?q=<name-or-tag>&page=1&limit=20
 * Read-only (no membership required — players browse clans before joining).
 * Matches clan name or tag (case-insensitive) and reports member counts and
 * whether the clan is full. Response serves JoinClanModal's contract:
 * { success, clans: [{_id, name, tag, description, memberCount, maxMembers,
 *   leaderUsername, level}], totalPages, total }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || searchParams.get('query') || '').trim();
    const pageRaw = Number(searchParams.get('page') ?? 1);
    const limitRaw = Number(searchParams.get('limit') ?? 20);
    const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(MAX_LIMIT, Math.floor(limitRaw)) : 20;
    const offset = (page - 1) * limit;

    // Base conditions: search by name/tag when provided
    const conditions = [];
    if (q) {
      const like = `%${q}%`;
      conditions.push(or(ilike(clans.name, like), ilike(clans.tag, like)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(clans)
      .where(whereClause);
    const total = countResult[0]?.total ?? 0;

    // memberCount is derived from the members jsonb array length
    const rows = await db
      .select({
        id: clans.id,
        name: clans.name,
        tag: clans.tag,
        description: clans.description,
        leaderId: clans.leaderId,
        members: clans.members,
        maxMembers: clans.maxMembers,
        level: clans.levelCurrentLevel,
        memberCount: sql<number>`jsonb_array_length(${clans.members})::int`,
      })
      .from(clans)
      .where(whereClause)
      .orderBy(asc(clans.name))
      .limit(limit)
      .offset(offset);

    // Resolve leader usernames in one round-trip
    const leaderIds = [...new Set(rows.map((r) => r.leaderId).filter((v): v is string => Boolean(v)))];
    const leaderMap = new Map<string, string>();
    if (leaderIds.length > 0) {
      const leaderRows = await db
        .select({ username: players.username })
        .from(players)
        .where(or(...leaderIds.map((id) => eq(players.username, id))));
      for (const l of leaderRows) leaderMap.set(l.username, l.username);
    }

    const clanDtos = rows.map((r) => ({
      _id: r.id,
      name: r.name,
      tag: r.tag,
      description: r.description || '',
      memberCount: Number(r.memberCount ?? r.members?.length ?? 0),
      maxMembers: r.maxMembers,
      leaderUsername: r.leaderId ? leaderMap.get(r.leaderId) || r.leaderId : 'Unknown',
      level: r.level ?? 1,
    }));

    return NextResponse.json(
      {
        success: true,
        clans: clanDtos,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        page,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /clan/search GET] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to search clans' },
      { status: 500 }
    );
  }
}
