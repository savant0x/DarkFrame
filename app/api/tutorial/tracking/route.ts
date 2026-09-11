/**
 * Tutorial Action Tracking API Endpoint
 *
 * GET /api/tutorial/tracking?stepId=Y
 * Returns the current tracking data for a specific step (e.g., target coordinates for MOVE_TO_COORDS).
 *
 * FID-20260909-023 §3.1b: session identity — the `playerId` query parameter is
 * IGNORED (an unauthenticated caller could read any player's tutorial progress
 * by playerId). Identity comes from the authenticated session, matching the
 * track-action route contract (FID-20260904-005 §5.1: playerId == username).
 *
 * Counts are read through getActionTracking — the canonical reader of the
 * actionType JSON contract (FID-20260908-001). A raw findOne returning
 * row.currentCount is always undefined.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionTracking } from '@/lib/tutorialService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const playerId = authUser.username;

    const { searchParams } = new URL(request.url);
    const stepId = searchParams.get('stepId');

    if (!stepId) {
      return NextResponse.json(
        { error: 'Missing stepId parameter' },
        { status: 400 }
      );
    }

    const tracking = await getActionTracking(playerId, stepId);

    if (!tracking) {
      return NextResponse.json({});
    }

    // Return tracking data (target coords, move count, etc.)
    return NextResponse.json({
      targetX: tracking.targetX,
      targetY: tracking.targetY,
      startX: tracking.startX,
      startY: tracking.startY,
      moveCount: tracking.targetCount,
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
