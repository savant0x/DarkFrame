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
import { requireAdminAuth } from '@/lib/authMiddleware';
import {
  executeMigration,
  getMigrationHistory,
  getNextMigrationTime,
} from '@/lib/botMigrationService';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib';

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
    logger.error('Migration history fetch error:', error);
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
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Execute migration
    const result = await executeMigration('manual', auth.username);

    return NextResponse.json({
      success: true,
      message: 'Migration executed successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Migration execution error:', error);
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
