/**
 * @file app/api/clan/leaderboard/route.ts
 * @created 2025-10-25
 * @overview Clan Leaderboard API - Provides ranked clan listings by various metrics
 * 
 * OVERVIEW:
 * GET endpoint that returns ranked clans based on selected category (power, level, 
 * territory, wealth, victories, wars won, alliances). Supports pagination and search.
 * 
 * CATEGORIES:
 * - power: Sum of all member totalPower (totalStrength + totalDefense)
 * - level: Clan level
 * - territory: Number of controlled tiles
 * - wealth: Total clan bank treasury (metal + energy value)
 * - victories: Sum of all member baseAttackWins
 * - wars: Total war victories
 * - alliances: Number of active alliances
 * 
 * QUERY PARAMETERS:
 * - category: Ranking category (default: 'power')
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25, max: 100)
 * - search: Filter by clan name (optional)
 * 
 * RESPONSE:
 * {
 *   leaderboard: LeaderboardEntry[],
 *   total: number,
 *   page: number,
 *   limit: number,
 *   category: string
 * }
 * 
 * DEPENDENCIES:
 * - Supabase for clan and player data
 * - Rate limiter for abuse prevention
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { 
  withRequestLogging,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.leaderboard);

type LeaderboardCategory = 'power' | 'level' | 'territory' | 'wealth' | 'victories' | 'wars' | 'alliances';

/**
 * GET /api/clan/leaderboard
 * 
 * Retrieves ranked clans based on selected category
 * Supports pagination and search functionality
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const category = (searchParams.get('category') || 'power') as LeaderboardCategory;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const searchQuery = searchParams.get('search');
    
    // Validate category
    const validCategories: LeaderboardCategory[] = ['power', 'level', 'territory', 'wealth', 'victories', 'wars', 'alliances'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Valid options: power, level, territory, wealth, victories, wars, alliances' },
        { status: 400 }
      );
    }
    
    // Build query for clans
    let clansQuery = supabase.from('clans').select('*');
    if (searchQuery) {
      clansQuery = clansQuery.ilike('name', `%${searchQuery}%`);
    }
    
    const { data: allClans, error: clansError } = await clansQuery;
    if (clansError) throw clansError;

    const clans = allClans || [];

    // Fetch all players for power and victories categories
    let players: any[] = [];
    if (category === 'power' || category === 'victories') {
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('clan, total_strength, total_defense, base_attack_wins');
      if (!playersError) {
        players = allPlayers || [];
      }
    }

    // Calculate value for each clan based on category
    const clansWithValues = clans.map((clan: any) => {
      let calculatedValue = 0;

      switch (category) {
        case 'power': {
          const clanPlayers = players.filter((p: any) => p.clan === clan.name);
          calculatedValue = clanPlayers.reduce((sum: number, p: any) => 
            sum + (p.total_strength || 0) + (p.total_defense || 0), 0);
          break;
        }
        case 'level':
          calculatedValue = clan.level || 1;
          break;
        case 'territory':
          calculatedValue = clan.territory_count || 0;
          break;
        case 'wealth':
          calculatedValue = (clan.bank_metal || 0) + (clan.bank_energy || 0);
          break;
        case 'victories': {
          const clanPlayers = players.filter((p: any) => p.clan === clan.name);
          calculatedValue = clanPlayers.reduce((sum: number, p: any) => 
            sum + (p.base_attack_wins || 0), 0);
          break;
        }
        case 'wars':
          calculatedValue = clan.wars_won || 0;
          break;
        case 'alliances':
          calculatedValue = Array.isArray(clan.alliances) ? clan.alliances.length : 0;
          break;
      }

      return { ...clan, calculatedValue };
    });

    // Sort by calculated value descending
    clansWithValues.sort((a: any, b: any) => b.calculatedValue - a.calculatedValue || a.name?.localeCompare(b.name || '') || 0);

    // Paginate
    const total = clansWithValues.length;
    const skip = (page - 1) * limit;
    const paginated = clansWithValues.slice(skip, skip + limit);
    
    // Format leaderboard entries
    const leaderboard = paginated.map((clan: any, index: number) => ({
      clan: {
        _id: clan.id,
        name: clan.name,
        tag: clan.tag,
        description: clan.description || '',
        leader: clan.leader,
        members: clan.members || [],
        level: clan.level || 1,
        xp: clan.xp || 0,
        bank: { metal: clan.bank_metal || 0, energy: clan.bank_energy || 0 },
        territoryCount: clan.territory_count || 0,
        warsWon: clan.wars_won || 0,
        alliances: clan.alliances || [],
        createdAt: clan.created_at,
        settings: clan.settings || {},
      },
      rank: skip + index + 1,
      value: clan.calculatedValue || 0,
      change: 0
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
 * - Power and victories categories fetch all players for aggregation
 * - For large clans, consider adding indexed columns for precomputed values
 * - Caching strategy could be added for top 100 clans (5-minute TTL)
 * 
 * FUTURE ENHANCEMENTS:
 * - Add rank change tracking (compare with previous period)
 * - Implement Redis caching for frequently accessed rankings
 * - Add clan activity score (weighted combination of all metrics)
 * - Support for historical snapshots (weekly/monthly rankings)
 * 
 * SECURITY:
 * - Rate limited to prevent abuse
 * - No authentication required (public leaderboard)
 * - Search query sanitized via Supabase ilike
 */
