/**
 * @file app/api/auction/cancel/route.ts
 * @created 2025-01-17
 * @overview Cancel active auction listing
 * 
 * OVERVIEW:
 * Handles auction cancellation by seller. Only allows cancellation if no bids
 * have been placed. Returns locked item to seller. Listing fee is non-refundable.
 * Updates auction status to Cancelled.
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
import { AuctionCancelSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';
import { verifyAuth } from '@/lib/authMiddleware';
import { cancelAuction } from '@/lib/auctionService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * POST /api/auction/cancel
 * 
 * Cancel an active auction listing
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
 *   "message": "Auction cancelled successfully. Item returned (listing fee non-refundable)"
 * }
 * ```
 * 
 * Error Responses:
 * - 401: Authentication required
 * - 400: Cannot cancel (not owner, has bids, already ended, etc.)
 * - 500: Server error
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuctionCancelAPI');
  const endTimer = log.time('auction-cancel');
  
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
    const validated = AuctionCancelSchema.parse(await request.json());

    // Cancel auction
    const result = await cancelAuction(username, validated.auctionId);

    if (!result.success) {
      return createErrorResponse(ErrorCode.AUCTION_NOT_FOUND, {
        message: result.message || 'Failed to cancel auction',
        context: { auctionId: validated.auctionId },
      });
    }

    log.info('Auction cancelled', { username, auctionId: validated.auctionId });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Error in cancel auction API', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Validates authentication and ownership
// - Only seller can cancel their own auction
// - Cannot cancel if any bids have been placed
// - Cannot cancel if auction already ended (Sold, Expired, Cancelled)
// - Item returned to seller's inventory/units
// - Listing fee is NOT refundable (intentional design)
// - Auction status updated to "Cancelled"
// ============================================================
// END OF FILE
// ============================================================
