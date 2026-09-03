/**
 * @file app/api/auction/create/route.ts
 * @created 2025-01-17
 * @overview Create new auction listing
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { createAuctionListing } from '@/lib/auctionService';
import { CreateAuctionRequest } from '@/types/auction.types';
import { logger } from '@/lib/logger';
import { 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  CreateAuctionSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.auctionCreate);

/**
 * POST /api/auction/create
 * 
 * Create a new auction listing
 * 
 * Request body:
 * {
 *   item: AuctionItem,
 *   startingBid: number,
 *   buyoutPrice?: number,
 *   reservePrice?: number,
 *   duration: 12 | 24 | 48,
 *   clanOnly?: boolean
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   auction?: AuctionListing
 * }
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuctionCreateAPI');
  const endTimer = log.time('createAuction');
  
  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated auction creation attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const username = authResult.username;

    // Parse and validate request body
    const body: CreateAuctionRequest = await request.json();
    const validated = CreateAuctionSchema.parse(body);

    log.debug('Auction creation request', { 
      username, 
      itemType: validated.item.itemType,
      startingBid: validated.startingBid, 
      duration: validated.duration,
      hasBuyout: !!validated.buyoutPrice
    });

    // Create auction
    const result = await createAuctionListing(username, validated);

    if (!result.success) {
      log.warn('Auction creation failed', { username, reason: result.message });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: result.message });
    }

    log.info('Auction created successfully', { 
      username, 
      itemType: validated.item.itemType,
      startingBid: validated.startingBid,
      duration: validated.duration,
      clanOnly: validated.clanOnly || false
    });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Auction creation validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Auction creation error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Validates authentication and request body
// - Calls auctionService to create listing
// - Returns created auction on success
// - Listing fee is deducted upfront
// ============================================================
// END OF FILE
// ============================================================
