/**
 * @file app/api/cron/player-snapshot/route.ts
 * @created 2025-10-25
 * @updated 2026-05-15 — Fixed POST auth bypass: use requireAdminAuth
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
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
    if (!cronSecret || providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting daily player snapshot...');

    const supabase = createServiceClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activePlayers, error } = await supabase
      .from('players')
      .select('username, level')
      .gte('last_login_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (error) {
      logger.error('Failed to fetch active players', error);
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

    logger.info(`Found ${activePlayers.length} active players to snapshot`);

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

    return NextResponse.json({
      success: true,
      message: 'Player snapshots captured',
      stats: {
        total: activePlayers.length,
        success: successCount,
        errors: errorCount
      }
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
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    logger.info('Manual player snapshot triggered', { admin: auth.username });

    const supabase = createServiceClient();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activePlayers, error } = await supabase
      .from('players')
      .select('username, level')
      .gte('last_login_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (error) {
      logger.error('Failed to fetch active players', error);
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
    }

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

    return NextResponse.json({
      success: true,
      message: 'Manual player snapshots captured',
      stats: {
        total: activePlayers.length,
        success: successCount,
        errors: errorCount
      }
    });

  } catch (error) {
    logger.error('Failed manual player snapshot', error);
    return NextResponse.json(
      { error: 'Failed to capture player snapshots' },
      { status: 500 }
    );
  }
}
