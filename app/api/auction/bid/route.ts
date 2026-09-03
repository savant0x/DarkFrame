/**
 * @file app/api/auction/bid/route.ts
 * @created 2025-01-17
 * @overview Place bid on auction listing
 * 
 * OVERVIEW:
 * Handles bid placement on active auctions. Validates bid amount meets minimum
 * increment requirements (100 units above current highest bid). Prevents self-bidding.
 * Automatically outbids previous highest bidder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { placeBid } from '@/lib/auctionService';
import { PlaceBidRequest } from '@/types/auction.types';
import { logger } from '@/lib/logger';
import { 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  BidAuctionSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.auctionBid);

/**
 * POST /api/auction/bid
 * 
 * Place a bid on an auction
 * 
 * Request body:
 * ```json
 * {
 *   "auctionId": "string",
 *   "bidAmount": number
 * }
 * ```
 * 
 * Success Response:
 * ```json
 * {
 *   "success": true,
 *   "message": "Bid placed successfully",
 *   "auction": AuctionListing
 * }
 * ```
 * 
 * Error Responses:
 * - 401: Authentication required
 * - 400: Invalid bid (self-bid, too low, auction inactive, etc.)
 * - 500: Server error
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuctionBidAPI');
  const endTimer = log.time('placeBid');
  
  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated bid attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const username = authResult.username;

    // Parse and validate request body
    const body: PlaceBidRequest = await request.json();
    const validated = BidAuctionSchema.parse(body);

    log.debug('Bid placement request', { 
      username, 
      auctionId: validated.auctionId, 
      bidAmount: validated.bidAmount 
    });

    // Place bid
    const result = await placeBid(username, validated);

    if (!result.success) {
      log.warn('Bid rejected', { 
        username, 
        auctionId: validated.auctionId, 
        reason: result.message 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: result.message });
    }

    log.info('Bid placed successfully', { 
      username, 
      auctionId: validated.auctionId, 
      bidAmount: validated.bidAmount 
    });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Bid validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Bid placement error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Validates authentication and bid amount
// - Minimum bid increment: 100 units
// - Prevents self-bidding (cannot bid on own auction)
// - Updates highest bidder automatically
// - Previous high bidder marked as not winning
// ============================================================
// END OF FILE
// ============================================================
