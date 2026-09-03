/**
 * @file app/api/admin/beer-bases/analytics/spawn-stats/route.ts
 * @created 2025-10-25
 * 
 * OVERVIEW:
 * API endpoint for Beer Base spawn statistics.
 * Returns daily spawn counts, tier distribution, and spawn sources.
 * Admin-only endpoint with rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { getSpawnStats } from '@/lib/beerBaseAnalytics';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 min cache

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const currentUser = await getAuthenticatedUser();
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse date range from query params
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const startDate = startParam ? new Date(startParam) : undefined;
    const endDate = endParam ? new Date(endParam) : undefined;

    // Validate dates
    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 });
    }
    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid end date' }, { status: 400 });
    }

    // Get stats
    const stats = await getSpawnStats(startDate, endDate);

    logger.info('Spawn stats fetched', { 
      admin: currentUser.username,
      dateRange: { start: startDate?.toISOString(), end: endDate?.toISOString() }
    });

    return NextResponse.json(stats);

  } catch (error) {
    logger.error('Failed to fetch spawn stats', error);
    return NextResponse.json(
      { error: 'Failed to fetch spawn statistics' },
      { status: 500 }
    );
  }
}
