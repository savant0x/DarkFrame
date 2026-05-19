import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  shouldShowTutorial,
  getCurrentQuestAndStep,
  completeStep,
  getActionTracking,
  skipTutorial,
  logger,
} from '@/lib';
import type { TutorialValidationRequest } from '@/types';

const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const dynamic = 'force-dynamic';

export const GET = getRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const playerId = auth.playerId;

    const searchParams = request.nextUrl.searchParams;
    const checkEligibility = searchParams.get('checkEligibility') === 'true';

    const supabase = createServiceClient();

    if (checkEligibility) {
      const { data: player } = await supabase
        .from('players')
        .select('username, level')
        .eq('username', playerId)
        .maybeSingle();

      if (!player) {
        return createErrorResponse(ErrorCode.NOT_FOUND, 'Player not found');
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

    const { quest, step, progress } = await getCurrentQuestAndStep(playerId);

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
    logger.error('Error in GET /api/tutorial:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

export const POST = postRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { action } = body;
    const playerId = auth.playerId;
    body.playerId = playerId;

    if (!action) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Action is required');
    }

    switch (action) {
      case 'complete_step':
        return await handleCompleteStep(body);

      case 'skip':
        return await handleSkip(body);

      case 'restart':
        return await handleRestart(body);

      default:
        return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid action');
    }
  } catch (error) {
    logger.error('Error in POST /api/tutorial:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

async function handleCompleteStep(body: Record<string, unknown>) {
  const { playerId, questId, stepId, validationData } = body;

  if (!questId || !stepId) {
    return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'questId and stepId are required for complete_step action');
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

async function handleSkip(body: Record<string, unknown>) {
  const { playerId, skipType, questId } = body;

  if (!skipType) {
    return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'skipType is required for skip action');
  }

  if (skipType === 'QUEST' && !questId) {
    return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'questId is required for quest skip');
  }

  const result = await skipTutorial(playerId, skipType, questId);

  return NextResponse.json(result);
}

async function handleRestart(body: Record<string, unknown>) {
  const { playerId } = body;

  try {
    const supabase = createServiceClient();

    await supabase
      .from('tutorial_progress')
      .delete()
      .eq('player_username', playerId);

    return NextResponse.json({
      success: true,
      message: 'Tutorial progress reset successfully',
    });

  } catch (error) {
    logger.error('Error restarting tutorial:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}
