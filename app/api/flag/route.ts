/**
 * @file app/api/flag/route.ts
 * @created 2025-10-20
 * @overview Flag API — GET returns the extended bearer/challenge/bonus payload
 *           (FID-20260906-001 §5.3, Option A: design-doc faithful).
 *
 * OVERVIEW:
 * GET /api/flag — current Flag Bearer data plus the viewer's action surface:
 *  - `bearer`: identity/position/level/hold duration/trail (derived from the
 *    holder's `players` row at read time — single source of truth).
 *  - `challenge`: the active steal channel (challenger, seconds remaining,
 *    bearer-only flee eligibility/cost) — null when no channel is running.
 *  - `bonuses`: the while-holding bonus stack (doc multipliers) + the holder's
 *    permanent harvest milestone.
 *  - `actions`: viewer-specific flags (isBearer / isChallenger / canChallenge /
 *    canFlee) so the client renders exactly one actionable surface.
 *
 * Identity is session-derived (never trusted from the query string); an
 * unauthenticated caller gets bearer + bonuses but no viewer-specific actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { FlagBearer, FlagAPIResponse, FlagDetailPayload } from '@/types/flag.types';
import { getFlagState } from '@/lib/flagState';import {
  getFlagHolderState,
  getBonusStack,
  evaluateFleeEligibility,
  getFleeCostShare,
  MAX_FLEES,
} from '@/lib/flagBonusService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_DATA);

/**
 * GET /api/flag
 *
 * Retrieve current Flag Bearer information + challenge/bonus state.
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest): Promise<NextResponse<FlagAPIResponse<FlagDetailPayload | null>>> => {
  const log = createRouteLogger('flag-get');
  const endTimer = log.time('flag-get');

  try {
    const state = await getFlagState();

    if (!state) {
      // No holder (flag unclaimed or holder row missing) — client shows the
      // flag module as unclaimed. Lazy init is handled by /api/flag/init and
      // server boot; an empty read here is a valid steady state.
      return NextResponse.json({
        success: true,
        data: null,
        timestamp: new Date()
      });
    }

    const holderState = await getFlagHolderState();
    const bonusStack = await getBonusStack(state.holderUsername);
    const holdDuration = Math.floor((Date.now() - state.claimedAt.getTime()) / 1000);

    const bearer: FlagBearer = {
      playerId: state.holderUsername,
      username: state.holderUsername,
      level: state.level,
      position: state.position,
      claimedAt: state.claimedAt,
      holdDuration,
      trail: state.trail,
    };

    // Viewer-specific action surface (session identity only).
    const user = await getAuthenticatedUser();
    const viewer = user?.username ?? null;
    const isBearer = viewer !== null && holderState.currentHolder === viewer;
    const challenge = holderState.challenge;

    let canChallenge = false;
    let challengeBlockReason: string | undefined;
    if (!viewer) {
      challengeBlockReason = 'Log in to challenge the Flag Bearer';
    } else if (isBearer) {
      challengeBlockReason = 'You already hold the Flag';
    } else if (challenge) {
      challengeBlockReason = 'A steal challenge is already in progress';
    } else if (holderState.graceUntil && holderState.graceUntil > new Date()) {
      challengeBlockReason = 'Flag is under challenge grace';
    } else {
      canChallenge = true;
    }

    const fleeEval = isBearer ? evaluateFleeEligibility(holderState) : { canFlee: false, reason: 'Not the bearer' };
    const fleeShare = getFleeCostShare(holderState.fleeCount);

    const payload: FlagDetailPayload = {
      bearer,
      challenge: challenge
        ? {
            challenger: challenge.challenger,
            startedAt: challenge.startedAt,
            endsAt: challenge.endsAt,
            secondsRemaining: Math.max(0, Math.ceil((challenge.endsAt.getTime() - Date.now()) / 1000)),
            canFlee: fleeEval.canFlee,
            fleeBlockReason: fleeEval.canFlee ? undefined : fleeEval.reason,
            fleeCostMetal: Math.floor(holderState.sessionEarningsMetal * fleeShare),
            fleeCostEnergy: Math.floor(holderState.sessionEarningsEnergy * fleeShare),
            fleeCount: holderState.fleeCount,
            maxFlees: MAX_FLEES,
          }
        : null,
      bonuses: {
        harvestMultiplier: bonusStack.harvestMultiplier,
        xpMultiplier: bonusStack.xpMultiplier,
        rpMultiplier: bonusStack.rpMultiplier,
        unitStrengthMultiplier: bonusStack.unitStrengthMultiplier,
        unitDefenseMultiplier: bonusStack.unitDefenseMultiplier,
        bankCapacityMultiplier: bonusStack.bankCapacityMultiplier,
        bankFeeMultiplier: bonusStack.bankFeeMultiplier,
        autoFarmSpeedMultiplier: bonusStack.autoFarmSpeedMultiplier,
        clanXpMultiplier: bonusStack.clanXpMultiplier,
        referralMultiplier: bonusStack.referralMultiplier,
        permanentHarvestBonusPct: bonusStack.permanentHarvestBonusPct,
        sessionEarningsMetal: holderState.sessionEarningsMetal,
        sessionEarningsEnergy: holderState.sessionEarningsEnergy,
      },
      actions: {
        isBearer,
        isChallenger: viewer !== null && challenge?.challenger === viewer,
        canChallenge,
        challengeBlockReason,
        canFlee: fleeEval.canFlee,
        fleeBlockReason: fleeEval.canFlee ? undefined : fleeEval.reason,
        graceUntil: holderState.graceUntil ?? undefined,
      },
    };

    log.info('Flag detail retrieved', { holder: state.holderUsername, holdDuration, viewer: viewer ?? 'anon' });
    return NextResponse.json({
      success: true,
      data: payload,
      timestamp: new Date()
    });
  } catch (error) {
    log.error('Failed to fetch flag bearer', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Flag Bearer data',
      timestamp: new Date()
    }, { status: 500 });
  } finally {
    endTimer();
  }
}));
