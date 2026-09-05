import { NextRequest, NextResponse } from 'next/server';
import { completeStep } from '@/lib/tutorialService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { logger } from '@/lib/logger';

/**
 * POST /api/tutorial/complete
 * Manually complete a tutorial step (for debugging/recovery)
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
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
    const { questId, stepId, validationData } = body;

    if (!questId || !stepId) {
      return NextResponse.json(
        { error: 'Missing required fields: playerId, questId, stepId' },
        { status: 400 }
      );
    }

    logger.info('Manual step completion requested', {
      requestId,
      playerId,
      questId,
      stepId,
      validationData
    });

    // Complete the step
    const result = await completeStep({
      playerId,
      questId,
      stepId,
      validationData: validationData || {}
    });

    logger.info('Step completed successfully', {
      requestId,
      playerId,
      stepId,
      success: result.success,
      nextStep: result.nextStep,
      questComplete: result.questComplete
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      nextStep: result.nextStep,
      questComplete: result.questComplete,
      tutorialComplete: result.tutorialComplete,
      reward: result.reward
    });
  } catch (error) {
    logger.error('Error completing tutorial step', { requestId, error });
    return NextResponse.json(
      { error: 'Failed to complete tutorial step' },
      { status: 500 }
    );
  }
}
