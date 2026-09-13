/**
 * @file app/api/autofarm/run/route.ts
 * @created 2026-09-12
 * @overview FID-20260912-078 — session-scoped AutoFarm run persistence.
 *
 * POST /api/autofarm/run   { run: AutoFarmRunRecord | null }
 *   - run != null → validate + upsert onto the caller's player row.
 *   - run === null → clear (stop/complete/interrupted-by-stop).
 *   Session identity ONLY — the username never comes from the body, so one
 *   player cannot write another's run record.
 *
 * GET /api/autofarm/run
 *   - Returns the caller's persisted run (or null). The page uses this on
 *     mount to auto-resume an interrupted run; the engine itself syncs its
 *     position from /api/player as before.
 *
 * Reads use the slim projection (FID-043 egress lesson): one jsonb column,
 * not the 39 KB full row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  saveAutoFarmRun,
  clearAutoFarmRun,
  isAutoFarmRunRecord,
  type AutoFarmRunRecord,
} from '@/lib/autoFarmRunService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.harvest);

export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('autofarm-run');
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - please log in' }, { status: 401 });
    }
    const [row] = await db
      .select({ autofarmRun: players.autofarmRun })
      .from(players)
      .where(eq(players.username, user.username))
      .limit(1);
    return NextResponse.json({ success: true, run: row?.autofarmRun ?? null });
  } catch (error) {
    log.error('autofarm run read failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Failed to read run state' }, { status: 500 });
  }
}));

interface PostBody {
  run?: AutoFarmRunRecord | null;
}

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('autofarm-run');
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - please log in' }, { status: 401 });
    }

    let body: PostBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (body.run === null || body.run === undefined) {
      await clearAutoFarmRun(user.username);
      return NextResponse.json({ success: true, cleared: true });
    }

    if (!isAutoFarmRunRecord(body.run)) {
      return NextResponse.json(
        { success: false, error: 'Invalid run record — expected { status, position, currentRow, direction, tilesCompleted, startTime }' },
        { status: 400 }
      );
    }

    // Bounding sanity: a corrupted client must not persist out-of-map positions.
    const MAP_SIZE = 150;
    const run = body.run;
    if (
      run.position.x < 0 || run.position.x >= MAP_SIZE ||
      run.position.y < 0 || run.position.y >= MAP_SIZE ||
      run.currentRow < 1 || run.currentRow > MAP_SIZE
    ) {
      return NextResponse.json({ success: false, error: 'Run position out of map bounds' }, { status: 400 });
    }

    await saveAutoFarmRun(user.username, run);
    return NextResponse.json({ success: true, saved: true });
  } catch (error) {
    log.error('autofarm run write failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Failed to persist run state' }, { status: 500 });
  }
}));
