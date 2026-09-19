/**
 * @file app/api/auction/my-bids/route.ts
 * @created 2025-01-17
 * @rewritten 2026-09-18 (FID-20260917-017 slice 4: Mongo shim → direct drizzle/pg)
 * @overview View player's bidding activity
 *
 * OVERVIEW:
 * Retrieves all auctions where the authenticated player has placed bids.
 * Shows winning/losing status for each bid, current auction state, and
 * allows player to track their bidding activity and potential purchases.
 *
 * PERSISTENCE (PostgreSQL): the `auctions` doc-bridge table — `doc` jsonb
 * holds the full AuctionListing document (migration 0008); the "which auctions
 * did I bid on" match rides the SAME dual jsonb-containment predicate the shim
 * synthesized for `{'bids.bidderUsername': u}` (now the shared
 * lib/db/docPath.ts truth). The per-auction bid inspection (my highest bid,
 * winning status) reads the domain doc after the row→domain overlay.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db/connection';
import { auctions } from '@/lib/db/schema';
import { docPathContainment } from '@/lib/db/docPath';
import { shapeRowAuctions } from '@/lib/db/auctionDocBridge';

import type { AuctionListing, AuctionBid } from '@/types/auction.types';

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

    // Auctions whose doc.bids carry this bidder (dual jsonb containment —
    // the exact predicate the shim built for the same dot-path filter).
    const matchingRows = await db
      .select()
      .from(auctions)
      .where(docPathContainment(auctions.doc, 'bids.bidderUsername', username));

    // Row → domain overlay: the doc-bridge rebuilds the AuctionListing shape
    // the consumer expects (column values win — they are the indexed truth).
    const allMatching = matchingRows.map((row) => shapeRowAuctions(auctions, row as unknown as Record<string, unknown>) as unknown as AuctionListing);

    const newestOwnBidTime = (auction: AuctionListing): number => {
      const times = (auction.bids ?? [])
        .filter((bid: AuctionBid) => bid.bidderUsername === username)
        .map((bid: AuctionBid) => new Date(bid.bidTime).getTime())
        .filter((t: number) => !Number.isNaN(t));
      return times.length > 0 ? Math.max(...times) : 0;
    };
    allMatching.sort((a, b) => newestOwnBidTime(b) - newestOwnBidTime(a));

    const totalCount = allMatching.length;
    const pageAuctions = allMatching.slice((page - 1) * limit, (page - 1) * limit + limit);

    // Transform results to include user's bid and winning status
    const bids = pageAuctions.map((auction) => {
      // Find user's highest bid on this auction
      const userBids = (auction.bids ?? []).filter((bid: AuctionBid) => bid.bidderUsername === username);
      const myBid = userBids.reduce((highest: AuctionBid, current: AuctionBid) =>
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
// - The match predicate is SQL (jsonb containment); bid inspection stays in
//   the domain doc (per-member data, game-scale small)
// - Sorted by most recent own bid first (computed in-route — per-member key)
// - Pagination after sort (sorting after slicing would only order within a page)
// ============================================================
// END OF FILE
// ============================================================
