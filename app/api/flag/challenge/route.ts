/**
 * @file app/api/flag/challenge/route.ts
 * @created 2026-09-06
 * @overview Flag steal channel start (FID-20260906-001 §5.3 — Option A,
 *           FLAG_FEATURE_PLAN.md is the mechanics source of truth).
 *
 * POST /api/flag/challenge
 * Session-authenticated. Starts the 30-second steal channel against the
 * current Flag Bearer. Server-enforced rules (client is never trusted):
 *  - Challenger must be within FLAG_CONFIG.ATTACK_RANGE (Chebyshev, DB
 *    positions via verifyPresence).
 *  - Holder under the 1-hour post-steal grace → rejected.
 *  - An unfinished channel → rejected. Challenger cannot challenge self.
 *
 * Bearer is locked for the first 5s of the channel (flee gate in
 * fleeChallenge). The bot bearer never flees — claim succeeds at channel end.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { verifyPresence } from '@/lib/presenceCheck';
import {
  getFlagHolderState,
  startChallenge,
} from '@/lib/flagBonusService';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { FLAG_CONFIG } from '@/types/flag.types';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_STEAL);

export const POST = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('flag-challenge');
  const endTimer = log.time('flag-challenge');

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - please log in' }, { status: 401 });
    }

    const holderState = await getFlagHolderState();
    if (!holderState.currentHolder) {
      return NextResponse.json({ success: false, error: 'No one is holding the Flag' }, { status: 400 });
    }

    // Server-side presence: challenger must stand within range of the holder's
    // DB position. Holder position derives from their players row.
    const [holderRow] = await db
      .select({ x: players.currentPositionX, y: players.currentPositionY })
      .from(players)
      .where(eq(players.username, holderState.currentHolder))
      .limit(1);
    if (!holderRow) {
      return NextResponse.json({ success: false, error: 'Flag Bearer not found' }, { status: 404 });
    }
    const holderPos = { x: Number(holderRow.x ?? 0), y: Number(holderRow.y ?? 0) };
    const presence = await verifyPresence(user.username, holderPos, FLAG_CONFIG.ATTACK_RANGE);
    if (!presence.ok) {
      return NextResponse.json({ success: false, error: presence.reason ?? 'Not in range' }, { status: 403 });
    }

    const result = await startChallenge(user.username);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.reason }, { status: 409 });
    }

    log.info('Flag challenge started', { challenger: user.username, holder: holderState.currentHolder, endsAt: result.endsAt });
    return NextResponse.json({
      success: true,
      data: {
        channel: {
          holder: holderState.currentHolder,
          challenger: user.username,
          startedAt: result.startedAt,
          endsAt: result.endsAt,
          bearerLockExpiresAt: result.bearerLockExpiresAt,
        },
        message: 'Steal channel started. Hold position for 30 seconds — if the bearer does not flee, the Flag is yours.',
      },
    });
  } catch (error) {
    log.error('Flag challenge error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Unable to complete the request. Please try again.' },
      { status: 500 },
    );
  } finally {
    endTimer();
  }
}));
