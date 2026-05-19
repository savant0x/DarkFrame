import { NextRequest, NextResponse } from 'next/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  getAuthenticatedPlayer,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  logger,
} from '@/lib';
import {
  getPlayerResearch,
  getAvailableTechs,
  canStartResearch,
  startResearch,
  spendRPOnResearch,
} from '@/lib/wmd/researchService';

const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const GET = getRateLimiter(async (req: NextRequest) => {
  try {
    const auth = await getAuthenticatedPlayer();

    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'status';

    const research = await getPlayerResearch(auth.username);

    if (view === 'available') {
      const available = await getAvailableTechs(auth.username);

      return NextResponse.json({
        success: true,
        available,
        completedCount: research?.completedTechs.length || 0,
        currentResearch: research?.currentResearch || null,
      });
    }

    return NextResponse.json({
      success: true,
      research,
    });
  } catch (error) {
    logger.error('Error fetching research:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

export const POST = postRateLimiter(async (request: NextRequest) => {
  try {
    const auth = await getAuthenticatedPlayer();
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const body = await request.json();
    const { action, techId } = body;

    if (!action || !techId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'action and techId are required');
    }

    if (action === 'start') {
      const canStart = await canStartResearch(auth.username, techId);

      if (!canStart.canStart) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, canStart.reason || 'Cannot start research');
      }

      const result = await startResearch(auth.username, techId);

      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, result.message);
      }

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }

    if (action === 'spendRP') {
      const result = await spendRPOnResearch(auth.username, techId);

      if (!result.success) {
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, result.message);
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        completed: result.completed,
      });
    }

    return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid action. Use "start" or "spendRP"');
  } catch (error) {
    logger.error('Error in research API:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
