/**
 * @file app/api/flag/drop/route.ts
 * @created 2026-09-14
 * @overview User-initiated flag drop (FID-20260914-002 Issue 4).
 *
 * POST /api/flag/drop
 * Bearer-only. Releases the Flag at the holder's current position — it
 * becomes unclaimed for the first-claim flow. Mirrors the 12h auto-drop
 * write (app/api/cron/flag-bot-movement) minus the milestone grant.
 *
 * Server-enforced rules:
 *  - Only the current holder can drop.
 *  - Any active steal channel is cleared with the drop (its columns reset).
 *  - The holder's account is untouched (no resource/bonus loss).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { notifySystem } from '@/lib/battleNotification';
import { db } from '@/lib/db';
import { flags, players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_STEAL);

export const POST = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('flag-drop');
  const endTimer = log.time('flag-drop');

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - please log in' }, { status: 401 });
    }

    const [flagRow] = await db.select().from(flags).limit(1);
    if (!flagRow) {
      return NextResponse.json({ success: false, error: 'No flag exists' }, { status: 404 });
    }
    if (flagRow.currentHolder !== user.username) {
      return NextResponse.json({ success: false, error: 'Only the Flag Bearer can drop it' }, { status: 403 });
    }

    const [holderRow] = await db
      .select({ x: players.currentPositionX, y: players.currentPositionY })
      .from(players)
      .where(eq(players.username, user.username))
      .limit(1);

    await db
      .update(flags)
      .set({
        currentHolder: null,
        currentHolderUsername: null,
        spawnX: holderRow ? Number(holderRow.x ?? 75) : 75,
        spawnY: holderRow ? Number(holderRow.y ?? 75) : 75,
        lastCapturedAt: null,
        challengeChallenger: null,
        challengeStartedAt: null,
        challengeEndsAt: null,
        sessionEarningsMetal: 0,
        sessionEarningsEnergy: 0,
        fleeCount: 0,
        graceUntil: null,
        lastFleeAt: null,
        fleeDestinationX: null,
        fleeDestinationY: null,
        milestone12hAwarded: 0,
      })
      .where(eq(flags.id, flagRow.id));

    // SYSTEM notification (non-fatal — the drop is already persisted).
    const dropX = holderRow ? Number(holderRow.x ?? 75) : 75;
    const dropY = holderRow ? Number(holderRow.y ?? 75) : 75;
    try {
      await notifySystem(
        user.username,
        `🏳️ You dropped the Flag at (${dropX}, ${dropY}). It is now unclaimed — first claim wins.`,
        'flag_dropped',
        'flag'
      );
    } catch (notifyError) {
      console.warn('Flag drop notification failed (non-fatal):', notifyError);
    }

    log.info('Flag dropped by holder', { holder: user.username, x: dropX, y: dropY });

    return NextResponse.json({
      success: true,
      message: `Flag dropped at (${dropX}, ${dropY}) — it is now unclaimed`,
    });
  } catch (error) {
    console.error('❌ Flag drop error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================