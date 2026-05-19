/**
 * @file app/api/clan/research/contribute/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Clan research contribution endpoint. Allows members to contribute personal RP to clan pool.
 * Validates membership, balance, and updates both player and clan research points.
 * 
 * ROUTES:
 * - POST /api/clan/research/contribute - Contribute RP to clan research fund
 * 
 * AUTHENTICATION:
 * - Requires clan membership via requireClanMembership()
 * 
 * BUSINESS RULES:
 * - Any clan member can contribute RP
 * - Player must have sufficient personal RP
 * - Contribution amount must be positive
 * - All contributions logged to activity feed
 * - Updates both player (deduct) and clan (add) RP totals
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireClanMembership,
  contributeRP,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const POST = rateLimiter(async (request: NextRequest) => {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { auth, clanId } = result;

    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid contribution amount (must be positive number)' },
        { status: 400 }
      );
    }

    try {
      const contributionResult = await contributeRP(clanId, auth.username, amount);

      return NextResponse.json({
        success: true,
        newTotal: contributionResult.newTotal,
        contributed: contributionResult.contributed,
        message: `Successfully contributed ${amount} RP to clan research fund`,
      });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      if (errMessage.includes('not a member')) {
        return NextResponse.json(
          { error: 'You are not a member of this clan' },
          { status: 400 }
        );
      }
      if (errMessage.includes('Insufficient research points')) {
        return NextResponse.json(
          { error: `Insufficient RP (you have ${auth.player.research_points || 0})` },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    logger.error('Error contributing RP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to contribute RP';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
});
