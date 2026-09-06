/**
 * @file app/api/flag/flee/route.ts
 * @created 2026-09-06
 * @overview Flag bearer flee (FID-20260906-001 §5.3 — Option A,
 *           FLAG_FEATURE_PLAN.md is the mechanics source of truth).
 *
 * POST /api/flag/flee
 * Bearer-only. Escapes the active steal channel by paying the escalating
 * share of GROSS session earnings (10/15/20/25/30%) — payment goes directly
 * to the challenger — and dashing 5 tiles in a random direction (map-bounded).
 *
 * Server-enforced rules:
 *  - 5-second bearer lock at channel start must have elapsed.
 *  - 60-second cooldown between flee attempts.
 *  - fleeCount >= 5 → cannot flee (the 6th challenge is an auto-lose).
 *  - Insufficient unbanked resources → cannot flee ("cannot pay = cannot
 *    flee" — the Flag is lost when the channel ends).
 *  - Success breaks the channel (steal fails) and resets its columns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import {
  getFlagHolderState,
  fleeChallenge,
  breakChallenge,
} from '@/lib/flagBonusService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_STEAL);

export const POST = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('flag-flee');
  const endTimer = log.time('flag-flee');

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - please log in' }, { status: 401 });
    }

    const holderState = await getFlagHolderState();
    if (!holderState.challenge) {
      return NextResponse.json({ success: false, error: 'No active challenge to flee from' }, { status: 400 });
    }
    if (holderState.currentHolder !== user.username) {
      return NextResponse.json({ success: false, error: 'Only the Flag Bearer can flee' }, { status: 403 });
    }

    const result = await fleeChallenge(user.username, { x: 0, y: 0 });
    if (!result.ok) {
      // 409 = a rules-based refusal (lock/cooldown/budget); the client shows
      // the reason on the flee button. Auto-lose state is NOT cleared here.
      return NextResponse.json({ success: false, error: result.reason }, { status: 409 });
    }

    // Escape succeeded: the channel is broken — the steal fails, but the
    // challenger keeps the payment (already transferred inside fleeChallenge).
    await breakChallenge();

    log.info('Flag bearer fled', {
      bearer: user.username,
      challenger: holderState.challenge.challenger,
      fleeCount: holderState.fleeCount + 1,
      costMetal: result.costMetal,
      costEnergy: result.costEnergy,
      destination: result.destination,
    });

    return NextResponse.json({
      success: true,
      data: {
        fled: true,
        costMetal: result.costMetal,
        costEnergy: result.costEnergy,
        destination: result.destination,
        fleeCount: holderState.fleeCount + 1,
        maxFlees: 5,
        message: `You fled! Paid ${result.costMetal?.toLocaleString()} Metal + ${result.costEnergy?.toLocaleString()} Energy to the challenger.`,
      },
    });
  } catch (error) {
    log.error('Flag flee error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Unable to complete the request. Please try again.' },
      { status: 500 },
    );
  } finally {
    endTimer();
  }
}));
