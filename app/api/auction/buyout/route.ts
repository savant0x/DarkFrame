/**
 * @file app/api/auction/buyout/route.ts
 * @created 2025-01-17
 * @overview Instant purchase via buyout price
 * 
 * OVERVIEW:
 * Handles instant auction purchases at buyout price. Validates buyer has sufficient
 * funds, calculates 5% sale fee, transfers item to buyer, transfers payment minus
 * fee to seller. Creates trade history record. Automatically ends auction.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { AuctionBuyoutSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';
import { verifyAuth } from '@/lib/authMiddleware';
import { buyoutAuction } from '@/lib/auctionService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.auctionBid);

/**
 * POST /api/auction/buyout
 * 
 * Instantly purchase auction via buyout price
 * 
 * Request body:
 * ```json
 * {
 *   "auctionId": "string"
 * }
 * ```
 * 
 * Success Response:
 * ```json
 * {
 *   "success": true,
 *   "message": "Auction purchased successfully",
 *   "trade": TradeHistory
 * }
 * ```
 * 
 * Error Responses:
 * - 401: Authentication required
 * - 400: Invalid buyout (self-purchase, no buyout price, insufficient funds, etc.)
 * - 500: Server error
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuctionBuyoutAPI');
  const endTimer = log.time('auction-buyout');
  
  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    const username = authResult.username;

    // Validate request
    const validated = AuctionBuyoutSchema.parse(await request.json());

    // Execute buyout
    const result = await buyoutAuction(username, validated.auctionId);

    if (!result.success) {
      return createErrorResponse(ErrorCode.AUCTION_BUYOUT_FAILED, {
        message: result.message || 'Failed to buyout auction',
        context: { auctionId: validated.auctionId },
      });
    }

    log.info('Auction buyout completed', { username, auctionId: validated.auctionId });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Error in buyout auction API', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Validates authentication and auction existence
// - Prevents self-purchase (cannot buy own listing)
// - Requires buyout price to be set on auction
// - 5% sale fee deducted from seller's payment
// - Item transferred immediately to buyer
// - Payment transferred immediately to seller (minus fee)
// - Creates permanent trade history record
// - Auction status updated to "Sold"
// ============================================================
// END OF FILE
// ============================================================
