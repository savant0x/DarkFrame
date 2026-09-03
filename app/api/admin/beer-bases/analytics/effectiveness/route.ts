/**
 * @file app/api/admin/beer-bases/analytics/effectiveness/route.ts
 * @created 2025-10-25
 * 
 * OVERVIEW:
 * API endpoint for Beer Base effectiveness metrics.
 * Returns defeat rate, avg lifespan by tier, engagement score, and peak hours.
 * Admin-only endpoint with rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { getEffectivenessMetrics } from '@/lib/beerBaseAnalytics';
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

    // Get metrics
    const metrics = await getEffectivenessMetrics(startDate, endDate);

    logger.info('Effectiveness metrics fetched', { 
      admin: currentUser.username,
      dateRange: { start: startDate?.toISOString(), end: endDate?.toISOString() }
    });

    return NextResponse.json(metrics);

  } catch (error) {
    logger.error('Failed to fetch effectiveness metrics', error);
    return NextResponse.json(
      { error: 'Failed to fetch effectiveness metrics' },
      { status: 500 }
    );
  }
}
