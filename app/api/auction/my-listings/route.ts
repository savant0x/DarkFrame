/**
 * @file app/api/auction/my-listings/route.ts
 * @created 2025-01-17
 * @overview View player's own auction listings
 * 
 * OVERVIEW:
 * Retrieves all auctions created by the authenticated player. Includes active,
 * sold, cancelled, and expired listings. Sorted by creation date (newest first).
 * Allows seller to monitor their auction status, bids, and sales.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getAuctions } from '@/lib/auctionService';
import { logger } from '@/lib/logger';
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
 * GET /api/auction/my-listings
 * 
 * Get authenticated player's auction listings
 * 
 * Query parameters:
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * 
 * Success Response:
 * ```json
 * {
 *   "success": true,
 *   "auctions": AuctionListing[],
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
  const log = createRouteLogger('auction-my-listings');
  const endTimer = log.time('my-listings');
  
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

    // Get player's auctions (filter by seller username)
    const result = await getAuctions({
      sellerUsername: username,
      sortBy: 'newly_listed',
      page,
      limit
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Calculate total pages
    const totalPages = Math.ceil((result.total || 0) / limit);

    return NextResponse.json({
      success: true,
      auctions: result.auctions,
      totalCount: result.total,
      page,
      totalPages
    });

  } catch (error) {
    log.error('Failed to fetch listings', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Requires authentication (personal data)
// - Returns ALL player's auctions (active, sold, cancelled, expired)
// - Sorted by creation date (newest first)
// - Includes bid information for each auction
// - Useful for tracking sales, cancellations, and expiring auctions
// - Pagination support for players with many listings
// ============================================================
// END OF FILE
// ============================================================
