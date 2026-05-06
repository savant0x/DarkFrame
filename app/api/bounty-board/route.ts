/**
 * @fileoverview Bounty Board API - Daily bot defeat challenges with rewards
 * @module app/api/bounty-board/route
 * @created 2025-10-18
 * 
 * OVERVIEW:
 * API endpoints for the bounty board system. Players receive 3 daily bounties
 * (easy, medium, hard) that refresh at midnight UTC. Defeating specific bot
 * types/tiers grants rewards of metal and energy.
 * 
 * Endpoints:
 * - GET: Fetch current bounties and statistics
 * - POST: Claim completed bounty rewards
 * 
 * Features:
 * - Auto-refresh at midnight
 * - Progressive difficulty rewards
 * - Completion tracking
 * - Reward claiming with validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { getBounties, getBountyStats, claimBountyReward } from '@/lib/bountyBoardService';
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

// ============================================================================
// GET - Fetch Bounties and Statistics
// ============================================================================

/**
 * GET /api/bounty-board
 * Returns current bounties and stats for the authenticated player
 * Auto-refreshes bounties if new day
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('bounty-board-get');
  const endTimer = log.time('bounty-board-get');

  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    // Get bounties (auto-refreshes if needed)
    const bounties = await getBounties(tokenPayload.username);
    const stats = await getBountyStats(tokenPayload.username);

    log.info('Bounty board data retrieved', { 
      username: tokenPayload.username,
      activeBounties: bounties.bounties?.length || 0,
      unclaimedRewards: bounties.unclaimedRewards || 0
    });

    return NextResponse.json({
      success: true,
      data: {
        bounties: bounties.bounties,
        lastRefresh: bounties.lastRefresh,
        unclaimedRewards: bounties.unclaimedRewards,
        stats,
      },
    });
  } catch (error) {
    log.error('Bounty board fetch error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================================
// POST - Claim Bounty Reward
// ============================================================================

/**
 * POST /api/bounty-board
 * Claims rewards for a completed bounty
 * 
 * Request body:
 * {
 *   bountyId: string // Bounty ID to claim
 * }
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('bounty-board-post');
  const endTimer = log.time('bounty-board-post');

  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    // Parse request body
    const body = await request.json();
    const { bountyId } = body;

    // Validate input
    if (!bountyId || typeof bountyId !== 'string') {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Valid bounty ID is required');
    }

    // Claim reward
    const result = await claimBountyReward(tokenPayload.username, bountyId);

    if (!result.success) {
      log.warn('Bounty claim failed', { bountyId, reason: result.message });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    log.info('Bounty reward claimed', { 
      username: tokenPayload.username,
      bountyId,
      metalGained: result.metalGained,
      energyGained: result.energyGained
    });

    // Return success with rewards
    return NextResponse.json({
      success: true,
      message: result.message,
      metalGained: result.metalGained,
      energyGained: result.energyGained,
    });
  } catch (error) {
    log.error('Bounty reward claim error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * INTEGRATION:
 * - Bounties auto-refresh when GET is called after midnight
 * - Progress updates happen via recordBotDefeat() in combat service
 * - Claims validate completion and prevent double-claiming
 * 
 * SECURITY:
 * - User authentication required for all operations
 * - Bounty ownership validated via username
 * - Reward amounts defined server-side (no client input)
 * 
 * FUTURE ENHANCEMENTS:
 * - DELETE endpoint to reroll bounties (premium feature)
 * - PATCH endpoint to "pin" favorite bounty types
 * - Bounty history tracking
 */
