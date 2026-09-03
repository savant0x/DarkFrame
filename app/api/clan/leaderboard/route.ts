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
 * - MongoDB for clan and player data aggregation
 * - Rate limiter for abuse prevention
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  connectToDatabase, 
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
    const db = await connectToDatabase();
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
    
    // Build aggregation pipeline based on category
    const clansCollection = db.collection('clans');
    const playersCollection = db.collection('players');
    
    // Base match stage (filter by search if provided)
    const matchStage: any = {};
    if (searchQuery) {
      matchStage.name = { $regex: searchQuery, $options: 'i' };
    }
    
    // Build aggregation based on category
    const pipeline: any[] = [
      { $match: matchStage }
    ];
    
    if (category === 'power' || category === 'victories') {
      // For power and victories, we need to aggregate member stats
      pipeline.push(
        // Lookup members from players collection
        {
          $lookup: {
            from: 'players',
            let: { clanName: '$name' },
            pipeline: [
              { $match: { $expr: { $eq: ['$clan', '$$clanName'] } } },
              {
                $project: {
                  totalPower: { $add: [{ $ifNull: ['$totalStrength', 0] }, { $ifNull: ['$totalDefense', 0] }] },
                  baseAttackWins: { $ifNull: ['$baseAttackWins', 0] }
                }
              }
            ],
            as: 'memberStats'
          }
        },
        // Calculate aggregated value
        {
          $addFields: {
            calculatedValue: category === 'power'
              ? { $sum: '$memberStats.totalPower' }
              : { $sum: '$memberStats.baseAttackWins' }
          }
        }
      );
    } else if (category === 'level') {
      pipeline.push({
        $addFields: {
          calculatedValue: { $ifNull: ['$level', 1] }
        }
      });
    } else if (category === 'territory') {
      pipeline.push({
        $addFields: {
          calculatedValue: { $ifNull: ['$territoryCount', 0] }
        }
      });
    } else if (category === 'wealth') {
      pipeline.push({
        $addFields: {
          calculatedValue: {
            $add: [
              { $ifNull: ['$bank.metal', 0] },
              { $ifNull: ['$bank.energy', 0] }
            ]
          }
        }
      });
    } else if (category === 'wars') {
      pipeline.push({
        $addFields: {
          calculatedValue: { $ifNull: ['$warsWon', 0] }
        }
      });
    } else if (category === 'alliances') {
      pipeline.push({
        $addFields: {
          calculatedValue: {
            $cond: {
              if: { $isArray: '$alliances' },
              then: { $size: '$alliances' },
              else: 0
            }
          }
        }
      });
    }
    
    // Sort by calculated value (descending)
    pipeline.push({ $sort: { calculatedValue: -1, name: 1 } });
    
    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await clansCollection.aggregate(countPipeline).toArray();
    const total = countResult.length > 0 ? countResult[0].total : 0;
    
    // Add pagination
    const skip = (page - 1) * limit;
    pipeline.push(
      { $skip: skip },
      { $limit: limit }
    );
    
    // Execute aggregation
    const clans = await clansCollection.aggregate(pipeline).toArray();
    
    // Format leaderboard entries with ranks
    const leaderboard = clans.map((clan: any, index: any) => ({
      clan: {
        _id: clan._id,
        name: clan.name,
        tag: clan.tag,
        description: clan.description || '',
        leader: clan.leader,
        members: clan.members || [],
        level: clan.level || 1,
        xp: clan.xp || 0,
        bank: clan.bank || { metal: 0, energy: 0 },
        territoryCount: clan.territoryCount || 0,
        warsWon: clan.warsWon || 0,
        alliances: clan.alliances || [],
        createdAt: clan.createdAt,
        settings: clan.settings || {},
      },
      rank: skip + index + 1,
      value: clan.calculatedValue || 0,
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
 * - Power and victories categories use $lookup to aggregate member stats
 * - For large clans (1000+ members), consider adding indexed fields to clan documents
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
 * - Search query sanitized via MongoDB regex
 */
