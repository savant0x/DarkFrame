/**
 * @fileoverview Bot Migration API - Manual trigger and migration history
 * @module app/api/bot-migration/route
 * @created 2025-10-18
 * 
 * OVERVIEW:
 * Admin API for manually triggering bot migrations and viewing migration history.
 * Automatic migrations run on Sundays at 8 AM UTC via cron job.
 * 
 * Endpoints:
 * - GET: Migration history and next scheduled time
 * - POST: Manually trigger migration (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import {
  executeMigration,
  getMigrationHistory,
  getNextMigrationTime,
} from '@/lib/botMigrationService';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// GET - Migration History and Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const history = await getMigrationHistory(10);
    const nextMigration = getNextMigrationTime();

    return NextResponse.json({
      success: true,
      data: {
        history,
        nextMigration,
      },
    });
  } catch (error) {
    console.error('Migration history fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch migration history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Manually Trigger Migration (Admin Only)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const playerResult = await db.select().from(players).where(eq(players.username, tokenPayload.username)).limit(1);
    const player = playerResult[0];

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    if (!player.rank || player.rank < 5) {
      return NextResponse.json(
        { error: 'Admin privileges required (rank 5+)' },
        { status: 403 }
      );
    }

    const result = await executeMigration('manual', tokenPayload.username);

    return NextResponse.json({
      success: true,
      message: 'Migration executed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Migration execution error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute migration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * AUTOMATIC MIGRATION:
 * For automatic Sunday 8 AM migrations, set up a cron job or scheduled task:
 * 
 * Example (Node.js cron):
 * ```typescript
 * import { CronJob } from 'cron';
 * import { shouldRunAutoMigration, executeMigration } from './lib/botMigrationService';
 * 
 * new CronJob('0 8 * * 0', async () => {
 *   if (shouldRunAutoMigration()) {
 *     await executeMigration('automatic');
 *   }
 * }, null, true, 'UTC');
 * ```
 * 
 * ADMIN PERMISSIONS:
 * - Only players with rank >= 5 can manually trigger migrations
 * - Manual triggers recorded in migration history
 * - No cooldown on manual triggers (admin discretion)
 * 
 * FUTURE ENHANCEMENTS:
 * - DELETE endpoint to cancel scheduled migration
 * - PATCH endpoint to adjust migration percentage
 * - Migration preview (show which bots will move)
 */
