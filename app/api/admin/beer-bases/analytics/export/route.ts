/**
 * @file app/api/admin/beer-bases/analytics/export/route.ts
 * @created 2025-10-25
 * 
 * OVERVIEW:
 * API endpoint for exporting Beer Base analytics data.
 * Supports CSV and JSON formats for archival purposes.
 * Admin-only endpoint with rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { exportAnalytics } from '@/lib/beerBaseAnalytics';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const currentUser = await getAuthenticatedUser();
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'json') as 'json' | 'csv';
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // Validate format
    if (format !== 'json' && format !== 'csv') {
      return NextResponse.json({ error: 'Format must be json or csv' }, { status: 400 });
    }

    const startDate = startParam ? new Date(startParam) : undefined;
    const endDate = endParam ? new Date(endParam) : undefined;

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid end date' }, { status: 400 });
    }

    // Generate export
    const exportData = await exportAnalytics(format, startDate, endDate);

    logger.info('Analytics data exported', { 
      admin: currentUser.username,
      format,
      dateRange: { start: startDate?.toISOString(), end: endDate?.toISOString() }
    });

    // Return appropriate content type
    if (format === 'csv') {
      return new NextResponse(exportData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="beer-base-analytics-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else {
      return new NextResponse(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="beer-base-analytics-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }

  } catch (error) {
    logger.error('Failed to export analytics', error);
    return NextResponse.json(
      { error: 'Failed to export analytics data' },
      { status: 500 }
    );
  }
}
