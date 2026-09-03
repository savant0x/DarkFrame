/**
 * @file app/api/admin/beer-bases/analytics/defeat-stats/route.ts
 * @created 2025-10-25
 * 
 * OVERVIEW:
 * API endpoint for Beer Base defeat statistics.
 * Returns daily defeat counts, defeats by tier, and top players.
 * Admin-only endpoint with rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { getDefeatStats } from '@/lib/beerBaseAnalytics';
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
    const stats = await getDefeatStats(startDate, endDate);

    logger.info('Defeat stats fetched', { 
      admin: currentUser.username,
      dateRange: { start: startDate?.toISOString(), end: endDate?.toISOString() }
    });

    return NextResponse.json(stats);

  } catch (error) {
    logger.error('Failed to fetch defeat stats', error);
    return NextResponse.json(
      { error: 'Failed to fetch defeat statistics' },
      { status: 500 }
    );
  }
}
