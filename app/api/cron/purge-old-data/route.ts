/**
 * @file app/api/cron/purge-old-data/route.ts
 * @created 2025-10-25
 * 
 * OVERVIEW:
 * Annual cron job to purge old analytics and player history data.
 * Runs on January 1st at 12:01 AM UTC via Vercel Cron.
 * Deletes all data older than 365 days to maintain constant storage.
 * 
 * SCHEDULE: 1 0 1 1 * (January 1st at 12:01 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { purgeOldAnalytics } from '@/lib/beerBaseAnalytics';
import { purgeOldSnapshots } from '@/lib/playerHistoryService';
import { exportAnalytics } from '@/lib/beerBaseAnalytics';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron access attempt', { path: '/api/cron/purge-old-data' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting annual data purge...');

    // Optional: Export before purge for archival
    const autoExport = process.env.AUTO_EXPORT_BEFORE_PURGE === 'true';
    if (autoExport) {
      try {
        logger.info('Creating pre-purge export...');
        const exportData = await exportAnalytics('json');
        // In production, save to S3 or external storage
        logger.info('Pre-purge export created', { size: exportData.length });
      } catch (exportError) {
        logger.error('Pre-purge export failed (continuing with purge)', exportError);
      }
    }

    // Purge analytics data
    const analyticsResult = await purgeOldAnalytics();
    
    // Purge player history data
    const snapshotsDeleted = await purgeOldSnapshots();

    logger.info('Annual data purge completed', {
      spawnsDeleted: analyticsResult.spawnsDeleted,
      defeatsDeleted: analyticsResult.defeatsDeleted,
      snapshotsDeleted
    });

    return NextResponse.json({
      success: true,
      message: 'Old data purged successfully',
      stats: {
        spawnsDeleted: analyticsResult.spawnsDeleted,
        defeatsDeleted: analyticsResult.defeatsDeleted,
        snapshotsDeleted
      }
    });

  } catch (error) {
    logger.error('Failed to run annual purge cron', error);
    return NextResponse.json(
      { error: 'Failed to purge old data' },
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

    logger.info('Manual data purge triggered', { admin: currentUser.username });

    // Purge analytics data
    const analyticsResult = await purgeOldAnalytics();
    
    // Purge player history data
    const snapshotsDeleted = await purgeOldSnapshots();

    return NextResponse.json({
      success: true,
      message: 'Manual data purge completed',
      stats: {
        spawnsDeleted: analyticsResult.spawnsDeleted,
        defeatsDeleted: analyticsResult.defeatsDeleted,
        snapshotsDeleted
      }
    });

  } catch (error) {
    logger.error('Failed manual data purge', error);
    return NextResponse.json(
      { error: 'Failed to purge old data' },
      { status: 500 }
    );
  }
}
