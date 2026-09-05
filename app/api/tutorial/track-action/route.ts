/**
 * Tutorial Action Tracking API
 * Created: 2025-10-25
 * Feature: Real-time tutorial progress tracking
 * 
 * OVERVIEW:
 * Endpoint for tracking player actions (moves, harvests, attacks) during tutorial
 * Enables real-time progress updates in the TutorialQuestPanel
 * 
 * USAGE:
 * POST /api/tutorial/track-action
 * Body: { playerId, action: 'move' | 'harvest' | 'attack', data: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import clientPromise from '@/lib/mongodb';
import {
  
  getCurrentQuestAndStep,
  updateActionTracking,
} from '@/lib/tutorialService';

/**
 * Normalize direction format (N/S/E/W → north/south/east/west)
 * Fixes bug where "N" !== "north" breaks tutorial validation
 */
function normalizeDirection(direction: string | undefined): string | undefined {
  if (!direction) return undefined;
  
  const directionMap: Record<string, string> = {
    'n': 'north',
    'north': 'north',
    's': 'south',
    'south': 'south',
    'e': 'east',
    'east': 'east',
    'w': 'west',
    'west': 'west',
  };
  
  return directionMap[direction.toLowerCase()] || direction.toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // FID-20260904-005 §5.1: session identity — body playerId ignored.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const playerId = authUser.username;
    const { action, data } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'playerId and action are required' },
        { status: 400 }
      );
    }

    // Initialize MongoDB connection
    const mongoClient = await clientPromise;
    const db = mongoClient.db('darkframe');
    

    // Get current tutorial step
    const { step } = await getCurrentQuestAndStep(playerId);
    
    if (!step || !step.validationData) {
      return NextResponse.json({ 
        tracked: false,
        message: 'No active tutorial step with tracking' 
      });
    }

    // Track action based on type
    let tracked = false;
    
    if (action === 'move' && step.action === 'MOVE') {
      const { requiredMoves, anyDirection, direction } = step.validationData;
      
      if (requiredMoves) {
        // Get current tracking
        const trackingCollection = db.collection<{ currentCount?: number }>('tutorial_action_tracking');
        const tracking = await trackingCollection.findOne({ 
          playerId, 
          stepId: step.id 
        });
        
        const currentCount = (tracking?.currentCount ?? 0) + 1;
        
        // Check direction if specified (with normalization)
        let countThis = true;
        if (!anyDirection && direction && data.direction) {
          const normalizedPlayerDirection = normalizeDirection(data.direction);
          const normalizedRequiredDirection = normalizeDirection(direction);
          countThis = normalizedPlayerDirection === normalizedRequiredDirection;
        }
        
        if (countThis) {
          await updateActionTracking(playerId, step.id, currentCount, requiredMoves);
          tracked = true;
          
          // Auto-complete step if target reached
          if (currentCount >= requiredMoves) {
            // The next poll will pick this up and complete the step
          }
        }
      }
    } else if (action === 'harvest' && step.action === 'HARVEST') {
      const { requiredHarvests } = step.validationData;
      
      if (requiredHarvests) {
        const trackingCollection = db.collection<{ currentCount?: number }>('tutorial_action_tracking');
        const tracking = await trackingCollection.findOne({ 
          playerId, 
          stepId: step.id 
        });
        
        const currentCount = (tracking?.currentCount ?? 0) + 1;
        await updateActionTracking(playerId, step.id, currentCount, requiredHarvests);
        tracked = true;
      }
    } else if (action === 'attack' && step.action === 'ATTACK') {
      const { requiredAttacks } = step.validationData;
      
      if (requiredAttacks) {
        const trackingCollection = db.collection<{ currentCount?: number }>('tutorial_action_tracking');
        const tracking = await trackingCollection.findOne({ 
          playerId, 
          stepId: step.id 
        });
        
        const currentCount = (tracking?.currentCount ?? 0) + 1;
        await updateActionTracking(playerId, step.id, currentCount, requiredAttacks);
        tracked = true;
      }
    }

    return NextResponse.json({ 
      tracked,
      step: step.id,
      action 
    });

  } catch (error) {
    console.error('Error in POST /api/tutorial/track-action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
