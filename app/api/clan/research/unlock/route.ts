/**
 * @file app/api/clan/research/unlock/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Refactored to use centralized auth + JSDoc)
 * 
 * OVERVIEW:
 * Clan research unlock endpoint. Unlocks research nodes in clan tech tree.
 * Validates prerequisites, level requirements, and RP cost before unlocking.
 * 
 * ROUTES:
 * - POST /api/clan/research/unlock - Unlock research node
 * 
 * AUTHENTICATION:
 * - Requires clan membership via requireClanMembership()
 * 
 * BUSINESS RULES:
 * - Only Leader, Co-Leader, and Officer can unlock research
 * - Must meet prerequisite research requirements
 * - Must meet clan level requirements
 * - Must have sufficient clan RP for cost
 * - All unlocks logged to activity feed
 * - Updates total clan bonuses after unlock
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireClanMembership,
  unlockResearch,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const POST = rateLimiter(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient();

    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    const { auth, clanId } = result;

    const body = await request.json();
    const { researchId } = body;

    if (!researchId || typeof researchId !== 'string') {
      return NextResponse.json(
        { error: 'Research ID is required' },
        { status: 400 }
      );
    }

    try {
      const unlockResult = await unlockResearch(clanId, auth.username, researchId);

      return NextResponse.json({
        success: true,
        research: unlockResult.research,
        totalBonuses: unlockResult.totalBonuses,
        message: `Successfully unlocked ${unlockResult.research.name}`,
      });
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      if (errMessage.includes('not found')) {
        return NextResponse.json(
          { error: 'Research node not found' },
          { status: 404 }
        );
      }
      if (errMessage.includes('not a member')) {
        return NextResponse.json(
          { error: 'You are not a member of this clan' },
          { status: 400 }
        );
      }
      if (errMessage.includes('Insufficient permissions')) {
        return NextResponse.json(
          { error: 'Only Leaders, Co-Leaders, and Officers can unlock research' },
          { status: 403 }
        );
      }
      if (errMessage.includes('already unlocked')) {
        return NextResponse.json(
          { error: 'Research already unlocked' },
          { status: 400 }
        );
      }
      if (errMessage.includes('level') && errMessage.includes('required')) {
        return NextResponse.json(
          { error: errMessage },
          { status: 400 }
        );
      }
      if (errMessage.includes('Prerequisite not met')) {
        return NextResponse.json(
          { error: errMessage },
          { status: 400 }
        );
      }
      if (errMessage.includes('Insufficient research points')) {
        return NextResponse.json(
          { error: errMessage },
          { status: 400 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    logger.error('Error unlocking research:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to unlock research';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
});
