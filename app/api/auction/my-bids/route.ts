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
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getCollection } from '@/lib/mongodb';
import { AuctionListing } from '@/types/auction.types';

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
    // Verify authentication
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    const username = tokenPayload.username;

    // Parse pagination parameters
    const url = new URL(request.url);
    const params = url.searchParams;
    const page = parseInt(params.get('page') || '1', 10);
    const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100);

    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { success: false, message: 'page and limit must be positive integers' },
        { status: 400 }
      );
    }

    // Get auctions where user has bid
    const auctionsCollection = await getCollection<AuctionListing>('auctions');
    
    // Find auctions with user's bids
    const query = {
      'bids.bidderUsername': username
    };

    // Get total count
    const totalCount = await auctionsCollection.countDocuments(query);

    // Get paginated results
    const auctions = await auctionsCollection
      .find(query)
      .sort({ 'bids.timestamp': -1 }) // Most recent bid first
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Transform results to include user's bid and winning status
    const bids = auctions.map((auction) => {
      // Find user's highest bid on this auction
      const userBids = auction.bids.filter((bid) => bid.bidderUsername === username);
      const myBid = userBids.reduce((highest, current) => 
        current.bidAmount > highest.bidAmount ? current : highest
      , userBids[0]);

      // Check if user is currently winning
      const isWinning = auction.highestBidder === username;

      return {
        auction,
        myBid,
        isWinning
      };
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      bids,
      totalCount,
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
// ============================================================
// END OF FILE
// ============================================================
