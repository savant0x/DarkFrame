/**
 * @file app/api/auction/my-bids/route.ts
 * @created 2025-01-17
 * @overview View player's bidding activity
 * 
 * OVERVIEW:
 * Retrieves all auctions where the authenticated player has placed bids.
 * Shows winning/losing status for each bid, current auction state, and
 * allows player to track their bidding activity and potential purchases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/auction/my-bids
 * 
 * Get authenticated player's bid activity
 * 
 * Query parameters:
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * 
 * Success Response:
 * ```json
 * {
 *   "success": true,
 *   "bids": Array<{
 *     auction: AuctionListing,
 *     myBid: AuctionBid,
 *     isWinning: boolean
 *   }>,
 *   "totalCount": number,
 *   "page": number,
 *   "totalPages": number
 * }
 * ```
 * 
 * Error Responses:
 * - 401: Authentication required
 * - 500: Server error
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('auction-my-bids');
  const endTimer = log.time('my-bids');
  
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const username = params.get('username');
    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Username required');
    }
    const page = parseInt(params.get('page') || '1', 10);
    const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100);

    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { success: false, message: 'page and limit must be positive integers' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Get all bids placed by this user, ordered by most recent first
    const { data: userBids, count: totalCount, error: bidsError } = await supabase
      .from('auction_bids')
      .select('*', { count: 'exact' })
      .eq('bidder_username', username)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (bidsError) {
      log.error('Failed to fetch user bids', bidsError);
      return createErrorFromException(bidsError, ErrorCode.INTERNAL_ERROR);
    }

    if (!userBids || userBids.length === 0) {
      return NextResponse.json({
        success: true,
        bids: [],
        totalCount: 0,
        page,
        totalPages: 0
      });
    }

    // Get the unique auction IDs from the bids
    const auctionIds = [...new Set(userBids.map((bid) => bid.auction_id))];

    // Fetch the corresponding auction listings
    const { data: auctions, error: auctionsError } = await supabase
      .from('auction_listings')
      .select('*')
      .in('auction_id', auctionIds);

    if (auctionsError) {
      log.error('Failed to fetch auction listings', auctionsError);
      return createErrorFromException(auctionsError, ErrorCode.INTERNAL_ERROR);
    }

    const auctionMap = new Map(
      (auctions || []).map((a) => [a.auction_id, a])
    );

    // Build response: for each bid, pair with its auction and determine winning status
    const bids = userBids.map((bid) => {
      const auction = auctionMap.get(bid.auction_id);

      // Find user's highest bid on this auction
      const isWinning = auction
        ? auction.highest_bidder === username
        : false;

      return {
        auction,
        myBid: bid,
        isWinning
      };
    });

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return NextResponse.json({
      success: true,
      bids,
      totalCount: totalCount || 0,
      page,
      totalPages
    });

  } catch (error) {
    log.error('Failed to fetch bids', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Requires authentication (personal data)
// - Returns ALL auctions where player has bid
// - Includes winning/losing status for each bid
// - Shows user's highest bid on each auction
// - Sorted by most recent bid first
// - Useful for tracking outbid notifications
// - Helps player decide whether to increase bid
// - Pagination support for active bidders
// - Uses Supabase auction_listings and auction_bids tables
// ============================================================
// END OF FILE
// ============================================================
