/**
 * @file app/api/flag/claim/route.ts
 * @created 2026-09-06
 * @overview Flag steal claim (FID-20260906-001 §5.3 — Option A,
 *           FLAG_FEATURE_PLAN.md is the mechanics source of truth).
 *
 * POST /api/flag/claim
 * Challenger-only. Completes a successful steal: the 30-second channel must
 * have ended unbroken (bearer never fled, or could not). Transfers the flag,
 * resets holder state (session earnings, flee count), and starts the new
 * bearer's 1-hour challenge grace.
 *
 * Idempotency note: claim is only valid while `challenge_challenger` matches
 * the session user — after transfer the channel columns are cleared, so a
 * replayed claim returns 409 "No active challenge".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { claimFlag, claimUnclaimedFlag } from '@/lib/flagBonusService';
import { verifyPresence } from '@/lib/presenceCheck';
import { db } from '@/lib/db';
import { flags } from '@/lib/db/schema';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_STEAL);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('flag-claim');
  const endTimer = log.time('flag-claim');

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - please log in' }, { status: 401 });
    }

    // Two claim modes (FID-20260906-001 §5.9):
    //  - mode=spawn: the flag is unclaimed; claim it within 15 tiles of its
    //    spawn coordinates (doc §146-154 first-claim, no channel).
    //  - default: complete a steal channel the caller started.
    const body = await request.json().catch(() => ({}));
    if (body?.mode === 'spawn') {
      const [flagRow] = await db.select().from(flags).limit(1);
      if (!flagRow) {
        return NextResponse.json({ success: false, error: 'The Flag has not spawned yet' }, { status: 400 });
      }
      if (flagRow.currentHolder) {
        return NextResponse.json({ success: false, error: 'The Flag is already held — use the steal channel' }, { status: 409 });
      }
      const spawnPos = { x: Number(flagRow.spawnX ?? 75), y: Number(flagRow.spawnY ?? 75) };
      const presence = await verifyPresence(user.username, spawnPos, 15);
      if (!presence.ok) {
        return NextResponse.json({ success: false, error: presence.reason ?? 'Not in range of the Flag' }, { status: 403 });
      }
      const spawnResult = await claimUnclaimedFlag(user.username, presence.attackerPosition!);
      if (!spawnResult.ok) {
        return NextResponse.json({ success: false, error: spawnResult.reason }, { status: 409 });
      }
      log.info('Flag claimed from spawn', { newHolder: user.username, spawn: spawnPos });
      return NextResponse.json({
        success: true,
        data: {
          claimed: true,
          newHolder: user.username,
          autoLoss: false,
          message: 'You claimed the Flag! All bonuses are active — you are now a glowing target.',
        },
      });
    }

    const result = await claimFlag(user.username);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.reason }, { status: 409 });
    }

    log.info('Flag claimed via channel', {
      newHolder: result.newHolder,
      autoLoss: result.autoLoss ?? false,
      reason: result.reason,
    });

    return NextResponse.json({
      success: true,
      data: {
        claimed: true,
        newHolder: result.newHolder,
        autoLoss: result.autoLoss ?? false,
        message: result.autoLoss
          ? 'The bearer had exhausted their flees — the Flag is yours!'
          : `Flag stolen! You are now the Flag Bearer (${result.reason}).`,
      },
    });
  } catch (error) {
    log.error('Flag claim error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to claim flag' },
      { status: 500 },
    );
  } finally {
    endTimer();
  }
}));
