/**
 * @file app/api/clan/leaderboard/route.ts
 * @created 2025-10-25
 * @rewritten 2026-09-18 (FID-20260917-017 slice 4: Mongo shim → direct drizzle/pg)
 * @overview Clan Leaderboard API - ranked clan listings by category
 *
 * OVERVIEW:
 * GET endpoint that returns ranked clans based on selected category. Supports
 * pagination and case-insensitive name search.
 *
 * CATEGORIES (original Mongo-pipeline semantics, preserved):
 * - power:     SUM(member totalStrength + totalDefense) — live member aggregate
 * - level:     level_current_level
 * - territory: stats_total_teritories (the clan's maintained aggregate)
 * - wealth:    bank_treasury_metal + bank_treasury_energy
 * - victories: SUM(stats.battlesWon across member players) — live member
 *   aggregate. The original pipeline projected a `baseAttackWins` player field
 *   that has NO pg column, so the shim always computed 0; stats.battlesWon is
 *   the real battle-victory ledger (incremented by the battle services).
 * - wars:      stats_wars_won (same ledger as the historical warsWon)
 * - alliances: count of ACTIVE rows in clan_alliances containing this clan
 *
 * QUERY PARAMETERS:
 * - category: Ranking category (default: 'power')
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25, max: 100)
 * - search: Case-insensitive clan-name filter (optional)
 *
 * RESPONSE (client contract — app/clans/page.tsx + ClanLeaderboardPanel):
 * {
 *   leaderboard: Array<{ rank, clan: <Clan domain shape via rowToClan>, value, change }>,
 *   total, page, limit, category
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { clans } from '@/lib/db/schema';
import { desc, asc, ilike, sql } from 'drizzle-orm';
import { rowToClan } from '@/lib/clanService';
import { AllianceStatus } from '@/types/clan.types';
import {
  withRequestLogging,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.leaderboard);

type LeaderboardCategory = 'power' | 'level' | 'territory' | 'wealth' | 'victories' | 'wars' | 'alliances';

const CATEGORIES: LeaderboardCategory[] = ['power', 'level', 'territory', 'wealth', 'victories', 'wars', 'alliances'];

/**
 * Map the requested category onto a SQL value expression (correlated
 * subqueries where the original pipeline aggregated member rows live — the
 * members jsonb roster carries playerId, and players.clanId is the indexed
 * membership truth both sides of the original $lookup agree on).
 */
function valueSql(category: LeaderboardCategory) {
  switch (category) {
    case 'power':
      return sql<number>`(
        SELECT COALESCE(SUM(p.total_strength + p.total_defense), 0)::int
        FROM players p WHERE p.clan_id = ${clans.id}
      )`;
    case 'level':
      return sql<number>`${clans.levelCurrentLevel}`;
    case 'territory':
      return sql<number>`${clans.statsTotalTerritories}`;
    case 'wealth':
      return sql<number>`(${clans.bankTreasuryMetal} + ${clans.bankTreasuryEnergy})::int`;
    case 'victories':
      return sql<number>`(
        SELECT COALESCE(SUM(NULLIF(p.stats->>'battlesWon', '')::int), 0)::int
        FROM players p WHERE p.clan_id = ${clans.id}
      )`;
    case 'wars':
      return sql<number>`${clans.statsWarsWon}`;
    case 'alliances':
      return sql<number>`(
        SELECT COUNT(*)::int FROM clan_alliances ca
        WHERE ca.status = ${AllianceStatus.ACTIVE}
          AND ca.clan_ids @> jsonb_build_array(${clans.id}::text)::jsonb
      )`;
  }
}

/**
 * GET /api/clan/leaderboard
 *
 * Retrieves ranked clans based on selected category
 * Supports pagination and search functionality
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const category = (searchParams.get('category') || 'power') as LeaderboardCategory;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const searchQuery = searchParams.get('search');

    // Validate category
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Valid options: power, level, territory, wealth, victories, wars, alliances' },
        { status: 400 }
      );
    }

    const value = valueSql(category);
    const skip = (page - 1) * limit;

    // Total count (same filter, before pagination)
    const [{ n: total }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(clans)
      .where(searchQuery ? ilike(clans.name, `%${searchQuery}%`) : sql`true`);

    // Ranked page (ordering happens in SQL; ties break by name like the pipeline)
    const rows = await db
      .select({ row: clans, value: value.as('calculated_value') })
      .from(clans)
      .where(searchQuery ? ilike(clans.name, `%${searchQuery}%`) : sql`true`)
      .orderBy(desc(value), asc(clans.name))
      .limit(limit)
      .offset(skip);

    // Format leaderboard entries with ranks (client contract shape — the Clan
    // domain shape via the single row→domain mapper).
    const leaderboard = rows.map(({ row, value: calculatedValue }, index) => ({
      clan: rowToClan(row),
      rank: skip + index + 1,
      value: Number(calculatedValue ?? 0),
      change: 0 // TODO: Implement rank change tracking
    }));

    return NextResponse.json({
      leaderboard,
      total,
      page,
      limit,
      category
    });

  } catch (error) {
    console.error('Error fetching clan leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clan leaderboard' },
      { status: 500 }
    );
  }
}));

/**
 * FOOTER:
 *
 * PERFORMANCE NOTES:
 * - power/victories/alliances are correlated subqueries — O(clans) per call
 *   at game scale (the shim's per-request member aggregation did the same work
 *   in memory); territory/wealth/wars/level are plain indexed columns
 * - Caching strategy could be added for the top 100 clans (5-minute TTL)
 *
 * FUTURE ENHANCEMENTS:
 * - Add rank change tracking (compare with previous period)
 * - Support for historical snapshots (weekly/monthly rankings)
 *
 * SECURITY:
 * - Rate limited to prevent abuse
 * - No authentication required (public leaderboard)
 * - Search is parameterized (ilike) — no regex injection surface
 */
