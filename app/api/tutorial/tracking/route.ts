/**
 * Tutorial Action Tracking API Endpoint
 * 
 * GET /api/tutorial/tracking?playerId=X&stepId=Y
 * Returns the current tracking data for a specific step (e.g., target coordinates for MOVE_TO_COORDS)
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

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

    const mongoClient = await clientPromise;
    const db = mongoClient.db('darkframe');
    const trackingCollection = db.collection('tutorial_action_tracking');

    const tracking = await trackingCollection.findOne({ 
      playerId, 
      stepId 
    });

    if (!tracking) {
      return NextResponse.json({});
    }

    // Return tracking data (target coords, move count, etc.)
    return NextResponse.json({
      targetX: tracking.targetX,
      targetY: tracking.targetY,
      startX: tracking.startX,
      startY: tracking.startY,
      moveCount: tracking.moveCount,
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
