/**
 * @file app/api/cron/player-snapshot/route.ts
 * @created 2025-10-25
 * @rewritten 2026-09-18 (FID-20260917-017 slice 3: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * Daily cron job to capture player level snapshots.
 * Runs at 3 AM UTC daily via Vercel Cron.
 * Used for predictive Beer Base spawning based on player growth.
 *
 * SCHEDULE: 0 3 * * * (Daily at 3 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { capturePlayerSnapshot } from '@/lib/playerHistoryService';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db/connection';
import { players } from '@/lib/db/schema';
import { gte } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

export const dynamic = 'force-dynamic';

/**
 * Snapshot every player active in the last 30 days.
 *
 * FID-20260914-009 Phase B: the old filter used `lastActive` — a field no
 * players column stores. The real activity column is last_login_date
 * (players.lastLoginDate). Single Law-13 helper: GET and POST previously
 * duplicated the query + capture loop verbatim.
 */
async function runPlayerSnapshots(): Promise<{
  total: number;
  success: number;
  errors: number;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activePlayers = await db
    .select({ username: players.username, level: players.level })
    .from(players)
    .where(gte(players.lastLoginDate, thirtyDaysAgo));

  logger.info(`Found ${activePlayers.length} active players to snapshot`);

  // Capture snapshot for each player — keyed by username (stable; the
  // snapshot table's PK. The Mongo-era _id died with the pivot).
  let successCount = 0;
  let errorCount = 0;

  for (const player of activePlayers) {
    try {
      await capturePlayerSnapshot(player.username, player.level);
      successCount++;
    } catch (error) {
      errorCount++;
      logger.error(`Failed to snapshot player ${player.username}`, error);
    }
  }

  logger.info('Daily player snapshot completed', {
    total: activePlayers.length,
    success: successCount,
    errors: errorCount
  });

  return { total: activePlayers.length, success: successCount, errors: errorCount };
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret — fail closed when unset (a literal 'Bearer undefined'
    // would otherwise match and open the cron to anyone).
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('Unauthorized cron access attempt', { path: '/api/cron/player-snapshot' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting daily player snapshot...');

    const stats = await runPlayerSnapshots();

    return NextResponse.json({
      success: true,
      message: 'Player snapshots captured',
      stats
    });

  } catch (error) {
    logger.error('Failed to run player snapshot cron', error);
    return NextResponse.json(
      { error: 'Failed to capture player snapshots' },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger (admin only)
export async function POST(_request: NextRequest) {
  try {
    // Manual trigger endpoint can use regular auth
    const currentUser = await getAuthenticatedUser();

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Manual player snapshot triggered', { admin: currentUser.username });

    const stats = await runPlayerSnapshots();

    return NextResponse.json({
      success: true,
      message: 'Manual player snapshots captured',
      stats
    });

  } catch (error) {
    logger.error('Failed manual player snapshot', error);
    return NextResponse.json(
      { error: 'Failed to capture player snapshots' },
      { status: 500 }
    );
  }
}
