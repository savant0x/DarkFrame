/**
 * @file app/api/clan/search/route.ts
 * @created 2026-09-04
 * @overview Clan search for browse/join UIs (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/search?q=<name-or-tag>&page=1&limit=20
 *                     &minLevel=1&maxLevel=50&minMembers=0&maxMembers=100
 *                     &publicOnly=true&recruitingOnly=true
 * Read-only (no membership required — players browse clans before joining).
 * Matches clan name or tag (case-insensitive) and reports member counts and
 * whether the clan is full. Optional filters (SCOPE #35 — JoinClanModal's
 * filter UI): level range on level_current_level, member range on the
 * members jsonb array length, publicOnly → settings_requires_approval = 0
 * (approval-free join), recruitingOnly → settings_is_recruiting = 1.
 * Response serves JoinClanModal's contract:
 * { success, clans: [{_id, name, tag, description, memberCount, maxMembers,
 *   leaderUsername, level}], totalPages, total }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import { and, asc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';

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

    // Base conditions: search by name/tag when provided, then apply the
    // JoinClanModal filter parameters (SCOPE #35). All bounds are clamped to
    // sane ranges so hostile input degrades to a wide filter, not an error.
    const conditions = [];
    if (q) {
      const like = `%${q}%`;
      conditions.push(or(ilike(clans.name, like), ilike(clans.tag, like)));
    }

    const minLevelRaw = Number(searchParams.get('minLevel'));
    const maxLevelRaw = Number(searchParams.get('maxLevel'));
    const minMembersRaw = Number(searchParams.get('minMembers'));
    const maxMembersRaw = Number(searchParams.get('maxMembers'));
    const minLevel = Number.isFinite(minLevelRaw) ? Math.min(Math.max(Math.floor(minLevelRaw), 1), 50) : null;
    const maxLevel = Number.isFinite(maxLevelRaw) ? Math.min(Math.max(Math.floor(maxLevelRaw), 1), 50) : null;
    const minMembers = Number.isFinite(minMembersRaw) ? Math.max(Math.floor(minMembersRaw), 0) : null;
    const maxMembers = Number.isFinite(maxMembersRaw) ? Math.max(Math.floor(maxMembersRaw), 0) : null;

    if (minLevel !== null) conditions.push(gte(clans.levelCurrentLevel, minLevel));
    if (maxLevel !== null) conditions.push(lte(clans.levelCurrentLevel, maxLevel));
    if (minMembers !== null) {
      conditions.push(sql`jsonb_array_length(${clans.members}) >= ${minMembers}`);
    }
    if (maxMembers !== null) {
      conditions.push(sql`jsonb_array_length(${clans.members}) <= ${maxMembers}`);
    }
    if (searchParams.get('publicOnly') === 'true') {
      conditions.push(eq(clans.settingsRequiresApproval, 0));
    }
    if (searchParams.get('recruitingOnly') === 'true') {
      conditions.push(eq(clans.settingsIsRecruiting, 1));
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
