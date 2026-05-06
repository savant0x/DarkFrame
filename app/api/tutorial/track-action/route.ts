/**
 * Tutorial Action Tracking API
 * Created: 2025-10-25
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
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
import {
  getCurrentQuestAndStep,
  updateActionTracking,
  getActionTracking,
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
    const { playerId, action, data } = body;

    if (!playerId || !action) {
      return NextResponse.json(
        { error: 'playerId and action are required' },
        { status: 400 }
      );
    }

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
        const tracking = await getActionTracking(playerId, step.id);
        
        const currentCount = tracking ? tracking.currentCount + 1 : 1;
        
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
        }
      }
    } else if (action === 'harvest' && step.action === 'HARVEST') {
      const { requiredHarvests } = step.validationData;
      
      if (requiredHarvests) {
        const tracking = await getActionTracking(playerId, step.id);
        
        const currentCount = tracking ? tracking.currentCount + 1 : 1;
        await updateActionTracking(playerId, step.id, currentCount, requiredHarvests);
        tracked = true;
      }
    } else if (action === 'attack' && step.action === 'ATTACK') {
      const { requiredAttacks } = step.validationData;
      
      if (requiredAttacks) {
        const tracking = await getActionTracking(playerId, step.id);
        
        const currentCount = tracking ? tracking.currentCount + 1 : 1;
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
