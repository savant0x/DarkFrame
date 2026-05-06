/**
 * Tutorial Action Tracking API Endpoint
 * 
 * GET /api/tutorial/tracking?playerId=X&stepId=Y
 * Returns the current tracking data for a specific step (e.g., target coordinates for MOVE_TO_COORDS)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionTracking } from '@/lib/tutorialService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    const stepId = searchParams.get('stepId');

    if (!playerId || !stepId) {
      return NextResponse.json(
        { error: 'Missing playerId or stepId parameter' },
        { status: 400 }
      );
    }

    const tracking = await getActionTracking(playerId, stepId);

    if (!tracking) {
      return NextResponse.json({});
    }

    // ActionTracking uses currentCount/targetCount (not moveCount, targetX, etc.)
    return NextResponse.json({
      targetX: (tracking as unknown as Record<string, unknown>).targetX,
      targetY: (tracking as unknown as Record<string, unknown>).targetY,
      startX: (tracking as unknown as Record<string, unknown>).startX,
      startY: (tracking as unknown as Record<string, unknown>).startY,
      moveCount: (tracking as unknown as Record<string, unknown>).moveCount,
      currentCount: tracking.currentCount,
    });

  } catch (error) {
    console.error('Tutorial tracking fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracking data' },
      { status: 500 }
    );
  }
}
