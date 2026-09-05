/**
 * @file app/api/cron/player-snapshot/route.ts
 * @created 2025-10-25
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
import { connectToDatabase } from '@/lib/mongodb';
import type { Player } from '@/types/game.types';

export const dynamic = 'force-dynamic';

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

    const db = await connectToDatabase();
    const playersCollection = db.collection<Player & { _id: string; level?: number }>('players');

    // Get all active players (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activePlayers = await playersCollection.find({
      lastActive: { $gte: thirtyDaysAgo }
    }).toArray();

    logger.info(`Found ${activePlayers.length} active players to snapshot`);

    // Capture snapshot for each player
    let successCount = 0;
    let errorCount = 0;

    for (const player of activePlayers) {
      try {
        await capturePlayerSnapshot(player._id.toString(), player.level);
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
    // Manual trigger endpoint can use regular auth
    const { getAuthenticatedUser } = await import('@/lib/authService');
    const currentUser = await getAuthenticatedUser();
    
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Manual player snapshot triggered', { admin: currentUser.username });

    // Re-use GET logic
    const db = await connectToDatabase();
    const playersCollection = db.collection<Player & { _id: string; level?: number }>('players');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activePlayers = await playersCollection.find({
      lastActive: { $gte: thirtyDaysAgo }
    }).toArray();

    let successCount = 0;
    let errorCount = 0;

    for (const player of activePlayers) {
      try {
        await capturePlayerSnapshot(player._id.toString(), player.level);
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
