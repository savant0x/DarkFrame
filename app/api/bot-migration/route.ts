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
import {
  executeMigration,
  getMigrationHistory,
  getNextMigrationTime,
} from '@/lib/botMigrationService';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// GET - Migration History and Status
// ============================================================================

/**
 * GET /api/bot-migration
 * Returns migration history and next scheduled migration time
 * Public endpoint (no auth required)
 */
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

/**
 * POST /api/bot-migration
 * Manually triggers a bot migration event
 * Requires admin privileges
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body.username;
    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 });

    const supabase = createServiceClient();
    
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Check admin privileges (rank >= 5)
    if (!player.rank || player.rank < 5) {
      return NextResponse.json(
        { error: 'Admin privileges required (rank 5+)' },
        { status: 403 }
      );
    }

    // Execute migration
    const result = await executeMigration('manual', username);

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
