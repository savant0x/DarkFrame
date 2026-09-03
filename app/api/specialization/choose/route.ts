/**
 * @file app/api/specialization/choose/route.ts
 * @created 2025-01-17
 * @overview API endpoint for choosing initial player specialization
 * 
 * OVERVIEW:
 * Allows Level 15+ players to choose their specialization doctrine (Offensive, Defensive, or Tactical).
 * Requires 25 Research Points as a one-time unlock cost. Player can later respec using the /switch endpoint.
 * 
 * REQUIREMENTS:
 * - Player Level 15+
 * - 25 Research Points available
 * - No existing specialization (cannot choose twice)
 * 
 * DOCTRINES:
 * - Offensive: +15% STR, -10% metal cost, 5 offensive specialized units
 * - Defensive: +15% DEF, -10% energy cost, 5 defensive specialized units
 * - Tactical: +10% STR/DEF balanced, -5% all costs, 5 hybrid units
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { chooseSpecialization, SpecializationDoctrine, SPECIALIZATION_CONFIG } from '@/lib/specializationService';
import { logger } from '@/lib/logger';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  ChooseSpecializationSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * POST /api/specialization/choose
 * 
 * Choose initial specialization for authenticated player
 * 
 * @body doctrine - Chosen specialization doctrine ('offensive', 'defensive', or 'tactical')
 * @returns Specialization status and confirmation
 */
export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('SpecializationChooseAPI');
  const endTimer = log.time('chooseSpecialization');

  try {
    // Verify authentication
    const user = await verifyAuth();
    if (!user || !user.username) {
      log.warn('Unauthenticated specialization choice attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Unauthorized. Please log in.'
      });
    }

    const username = user.username;

    // Parse and validate request body
    const body = await req.json();
    const validated = ChooseSpecializationSchema.parse(body);

    // Normalize doctrine to enum value
    const normalizedDoctrine = validated.doctrine as SpecializationDoctrine;

    log.debug('Specialization choice request', { 
      username, 
      doctrine: normalizedDoctrine 
    });

    // Attempt to choose specialization
    const result = await chooseSpecialization(username, normalizedDoctrine);

    if (!result.success) {
      log.debug('Specialization choice failed', { 
        username, 
        doctrine: normalizedDoctrine,
        reason: result.message 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: result.message
      });
    }

    const config = SPECIALIZATION_CONFIG[normalizedDoctrine as keyof typeof SPECIALIZATION_CONFIG];

    log.info('Specialization chosen successfully', {
      username,
      doctrine: normalizedDoctrine,
      rpSpent: config.unlockCost,
      rpRemaining: result.rpRemaining
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      specialization: {
        doctrine: normalizedDoctrine,
        name: config.name,
        icon: config.icon,
        description: config.description,
        bonuses: config.bonuses,
        masteryLevel: result.specialization?.masteryLevel || 0,
        masteryXP: result.specialization?.masteryXP || 0
      },
      rpRemaining: result.rpRemaining,
      rpSpent: config.unlockCost
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Specialization choice validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Specialization choice error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * GET /api/specialization/choose
 * 
 * Get eligibility status for choosing specialization
 * 
 * @returns Eligibility info with requirements
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth();
    if (!user || !user.username) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const username = user.username;

    // Import needed for eligibility check
    const { canChooseSpecialization, getSpecializationStatus } = await import('@/lib/specializationService');
    
    // Get full status
    const status = await getSpecializationStatus(username);
    
    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Check eligibility
    const eligibility = await canChooseSpecialization(username);

    return NextResponse.json({
      success: true,
      canChoose: eligibility.canChoose,
      reason: eligibility.reason,
      requirements: {
        currentLevel: eligibility.currentLevel,
        requiredLevel: eligibility.requiredLevel || 15,
        currentRP: eligibility.currentRP,
        requiredRP: eligibility.requiredRP || 25
      },
      doctrines: {
        offensive: SPECIALIZATION_CONFIG[SpecializationDoctrine.Offensive],
        defensive: SPECIALIZATION_CONFIG[SpecializationDoctrine.Defensive],
        tactical: SPECIALIZATION_CONFIG[SpecializationDoctrine.Tactical]
      },
      hasSpecialization: status.specialization.doctrine !== SpecializationDoctrine.None
    });

  } catch (error) {
    logger.error('Error in specialization eligibility check:', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred while checking eligibility'
      },
      { status: 500 }
    );
  }
}
