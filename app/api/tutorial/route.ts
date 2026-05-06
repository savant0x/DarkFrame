/**
 * Tutorial API Route
 * Created: 2025-10-25
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * Feature: FID-20251025-101 - Interactive Tutorial Quest System
 * 
 * OVERVIEW:
 * RESTful API endpoints for tutorial system operations including:
 * - GET: Fetch current tutorial state
 * - POST: Complete steps, skip quests, claim rewards
 * 
 * ENDPOINTS:
 * GET  /api/tutorial?playerId={id}  - Get current tutorial state
 * POST /api/tutorial                 - Perform tutorial actions
 * 
 * ACTIONS:
 * - complete_step: Mark step as complete and advance
 * - skip: Skip quest or entire tutorial
 * - restart: Reset tutorial progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getTutorialProgress,
  getCurrentQuestAndStep,
  completeStep,
  skipTutorial,
  shouldShowTutorial,
  getActionTracking,
} from '@/lib/tutorialService';
import type { TutorialValidationRequest } from '@/types/tutorial.types';

/**
 * GET /api/tutorial
 * Fetch current tutorial state for player
 * 
 * Query Params:
 * - playerId: Player ID
 * - checkEligibility: Optional boolean to check if player should see tutorial
 * 
 * Response:
 * {
 *   quest: TutorialQuest | null,
 *   step: TutorialStep | null,
 *   progress: TutorialProgress,
 *   shouldShow?: boolean
 * }
 * 
 * Note: Logging suppressed for this endpoint to prevent terminal spam from 1-second polling
 */
export const dynamic = 'force-dynamic'; // Prevent caching, ensure fresh data

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const playerId = searchParams.get('playerId');
    const checkEligibility = searchParams.get('checkEligibility') === 'true';

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Check eligibility if requested
    if (checkEligibility) {
      // Get player's actual level from database
      const { data: player } = await supabase
        .from('players')
        .select('username, level')
        .eq('username', playerId)
        .maybeSingle();
      
      if (!player) {
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        );
      }
      
      const playerLevel = player.level || 1;
      const shouldShow = await shouldShowTutorial(playerId, playerLevel);
      
      if (!shouldShow) {
        return NextResponse.json({
          shouldShow: false,
          quest: null,
          step: null,
          progress: null,
        });
      }
    }

    // Get current quest and step
    const { quest, step, progress } = await getCurrentQuestAndStep(playerId);

    // SERVER-SIDE AUTO-COMPLETE: Auto-complete READ_INFO steps after delay
    if (quest && step && step.action === 'READ_INFO' && step.autoComplete && progress) {
      const stepStartTime = progress.currentStepStartedAt || progress.startedAt;
      const autoCompleteDelay = step.autoCompleteDelay || 5000;
      
      if (stepStartTime) {
        const elapsedTime = Date.now() - new Date(stepStartTime).getTime();
        
        if (elapsedTime >= autoCompleteDelay) {
          const completionResult = await completeStep({
            playerId,
            questId: quest._id!,
            stepId: step.id,
            validationData: { autoCompleted: true }
          });
          
          if (completionResult.success) {
            const updated = await getCurrentQuestAndStep(playerId);
            return NextResponse.json({
              quest: updated.quest,
              step: updated.step,
              progress: updated.progress,
              shouldShow: true,
              autoCompleted: true,
            });
          }
        }
      }
    }

    // SERVER-SIDE AUTO-COMPLETE: Auto-complete MOVE_TO_COORDS when at target
    if (quest && step && step.action === 'MOVE_TO_COORDS' && progress) {
      const stepValidation = step.validationData || {};
      if (stepValidation.targetX !== undefined && stepValidation.targetY !== undefined) {
        const { data: posCheck } = await supabase
          .from('players')
          .select('current_x, current_y')
          .eq('username', playerId)
          .maybeSingle();

        if (posCheck) {
          const px = Number(posCheck.current_x);
          const py = Number(posCheck.current_y);
          const tx = Number(stepValidation.targetX);
          const ty = Number(stepValidation.targetY);

          if (px === tx && py === ty) {
            const completionResult = await completeStep({
              playerId,
              questId: quest._id!,
              stepId: step.id,
              validationData: { targetX: px, targetY: py, autoCompleted: true }
            });

            if (completionResult.success) {
              const updated = await getCurrentQuestAndStep(playerId);
              return NextResponse.json({
                quest: updated.quest,
                step: updated.step,
                progress: updated.progress,
                shouldShow: true,
                autoCompleted: true,
              });
            }
          }
        }
      }
    }

    // SERVER-SIDE AUTO-COMPLETE: Auto-complete MOVE/HARVEST/ATTACK when target count reached
    if (quest && step && ['MOVE', 'HARVEST', 'ATTACK'].includes(step.action) && progress) {
      const stepValidation = step.validationData || {};
      const targetCount = stepValidation.requiredMoves || stepValidation.requiredHarvests || stepValidation.requiredAttacks;
      
      if (targetCount) {
        const tracking = await getActionTracking(playerId, step.id);
        const currentCount = tracking?.currentCount || 0;
        
        if (currentCount >= targetCount) {
          const completionResult = await completeStep({
            playerId,
            questId: quest._id!,
            stepId: step.id,
            validationData: { currentCount, targetCount, autoCompleted: true }
          });
          
          if (completionResult.success) {
            const updated = await getCurrentQuestAndStep(playerId);
            return NextResponse.json({
              quest: updated.quest,
              step: updated.step,
              progress: updated.progress,
              shouldShow: true,
              autoCompleted: true,
            });
          }
        }
      }
    }

    return NextResponse.json({
      quest,
      step,
      progress,
      shouldShow: true,
    });

  } catch (error) {
    console.error('Error in GET /api/tutorial:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tutorial
 * Perform tutorial actions
 * 
 * Body:
 * {
 *   action: 'complete_step' | 'skip' | 'restart',
 *   playerId: string,
 *   questId?: string,
 *   stepId?: string,
 *   validationData?: object,
 *   skipType?: 'ENTIRE_TUTORIAL' | 'QUEST'
 * }
 * 
 * Response varies by action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, playerId } = body;

    if (!action || !playerId) {
      return NextResponse.json(
        { error: 'Action and playerId are required' },
        { status: 400 }
      );
    }

    // Route to appropriate handler
    switch (action) {
      case 'complete_step':
        return await handleCompleteStep(body);

      case 'skip':
        return await handleSkip(body);

      case 'restart':
        return await handleRestart(body);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in POST /api/tutorial:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle step completion action
 */
async function handleCompleteStep(body: any) {
  const { playerId, questId, stepId, validationData } = body;

  if (!questId || !stepId) {
    return NextResponse.json(
      { error: 'questId and stepId are required for complete_step action' },
      { status: 400 }
    );
  }

  const validationRequest: TutorialValidationRequest = {
    playerId,
    questId,
    stepId,
    validationData: validationData || {},
  };

  const result = await completeStep(validationRequest);

  return NextResponse.json(result);
}

/**
 * Handle skip action (quest or entire tutorial)
 */
async function handleSkip(body: any) {
  const { playerId, skipType, questId } = body;

  if (!skipType) {
    return NextResponse.json(
      { error: 'skipType is required for skip action' },
      { status: 400 }
    );
  }

  if (skipType === 'QUEST' && !questId) {
    return NextResponse.json(
      { error: 'questId is required for quest skip' },
      { status: 400 }
    );
  }

  const result = await skipTutorial(playerId, skipType, questId);

  return NextResponse.json(result);
}

/**
 * Handle tutorial restart
 */
async function handleRestart(body: any) {
  const { playerId } = body;

  try {
    const supabase = createServiceClient();

    // Delete existing progress
    await supabase
      .from('tutorial_progress')
      .delete()
      .eq('player_username', playerId);

    return NextResponse.json({
      success: true,
      message: 'Tutorial progress reset successfully',
    });

  } catch (error) {
    console.error('Error restarting tutorial:', error);
    return NextResponse.json(
      { error: 'Failed to restart tutorial' },
      { status: 500 }
    );
  }
}
