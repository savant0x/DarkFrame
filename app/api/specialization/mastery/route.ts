/**
 * @file app/api/specialization/mastery/route.ts
 * @created 2025-01-17
 * @overview API endpoint for specialization mastery tracking
 * 
 * OVERVIEW:
 * GET: Retrieve player's current mastery level, XP, and milestone progress
 * POST: Award mastery XP for achievements (building specialized units, winning battles)
 * 
 * MASTERY SYSTEM:
 * - Levels: 0-100%
 * - XP per level: 100 (10,000 total for max mastery)
 * - Milestones: 25% (+5% bonus), 50% (+10%), 75% (+15% + 4th unit), 100% (+20% + 5th unit)
 * 
 * XP SOURCES:
 * - Building specialized units: 10-50 XP based on tier
 * - Winning battles with specialized units: 20-100 XP based on units used
 * - Completing objectives: Variable XP
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { AwardMasteryXPSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';
import { verifyAuth } from '@/lib/authMiddleware';
import { getSpecializationStatus, awardMasteryXP, MASTERY_MILESTONES, MASTERY_XP_PER_LEVEL, SpecializationDoctrine } from '@/lib/specializationService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/specialization/mastery
 * 
 * Get player's current mastery status
 * 
 * @returns Mastery level, XP, milestones, and next requirements
 */
export const GET = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('SpecializationMasteryAPI');
  const endTimer = log.time('mastery-status');
  
  try {
    // Verify authentication
    const user = await verifyAuth();
    if (!user || !user.username) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    const username = user.username;

    // Get specialization status
    const status = await getSpecializationStatus(username);

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const spec = status.specialization;

    // Check if player has specialization
    if (spec.doctrine === SpecializationDoctrine.None) {
      return NextResponse.json({
        success: true,
        hasSpecialization: false,
        message: 'No specialization chosen yet. Reach Level 15 to specialize.'
      });
    }

    // Calculate next level requirements
    const currentLevel = spec.masteryLevel;
    const currentXP = spec.masteryXP;
    const xpForNextLevel = (currentLevel + 1) * MASTERY_XP_PER_LEVEL;
    const xpProgress = currentXP - (currentLevel * MASTERY_XP_PER_LEVEL);
    const xpNeeded = xpForNextLevel - currentXP;

    // Determine reached milestones
    const reachedMilestones = Object.keys(MASTERY_MILESTONES)
      .map(Number)
      .filter(milestone => currentLevel >= milestone)
      .map(milestone => ({
        level: milestone,
        ...MASTERY_MILESTONES[milestone as keyof typeof MASTERY_MILESTONES]
      }));

    // Determine next milestone
    const nextMilestone = Object.keys(MASTERY_MILESTONES)
      .map(Number)
      .find(milestone => currentLevel < milestone);

    return NextResponse.json({
      success: true,
      hasSpecialization: true,
      doctrine: spec.doctrine,
      config: status.config,
      mastery: {
        level: currentLevel,
        maxLevel: 100,
        totalXP: currentXP,
        xpForNextLevel: xpForNextLevel,
        xpProgress: xpProgress,
        xpNeeded: xpNeeded,
        progressPercent: Math.floor((xpProgress / MASTERY_XP_PER_LEVEL) * 100)
      },
      milestones: {
        reached: reachedMilestones,
        next: nextMilestone ? {
          level: nextMilestone,
          ...MASTERY_MILESTONES[nextMilestone as keyof typeof MASTERY_MILESTONES],
          xpToReach: (nextMilestone * MASTERY_XP_PER_LEVEL) - currentXP
        } : null
      },
      stats: {
        totalUnitsBuilt: spec.totalUnitsBuilt,
        totalBattlesWon: spec.totalBattlesWon
      },
      selectedAt: spec.selectedAt,
      respecHistory: spec.respecHistory
    });

  } catch (error) {
    log.error('Error in mastery status endpoint', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/specialization/mastery
 * 
 * Award mastery XP to player
 * 
 * @body xpAmount - Amount of XP to award
 * @body reason - Reason for XP gain
 * @returns Updated mastery status with level-up info
 */
export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('SpecializationMasteryAPI');
  const endTimer = log.time('mastery-award-xp');
  
  try {
    // Verify authentication
    const user = await verifyAuth();
    if (!user || !user.username) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    const username = user.username;

    // Validate request
    const validated = AwardMasteryXPSchema.parse(await req.json());

    // Award mastery XP
    const result = await awardMasteryXP(username, validated.xpAmount, validated.reason);

    if (!result.success) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: result.message,
      });
    }

    // Log if leveled up
    if (result.leveledUp) {
      log.info('Mastery level-up', {
        username,
        newLevel: result.newMasteryLevel,
        xpGained: validated.xpAmount,
        reason: validated.reason,
        milestonesReached: result.milestonesReached
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      mastery: {
        level: result.newMasteryLevel,
        totalXP: result.newMasteryXP,
        leveledUp: result.leveledUp,
        milestonesReached: result.milestonesReached?.map(milestone => ({
          level: milestone,
          ...MASTERY_MILESTONES[milestone as keyof typeof MASTERY_MILESTONES]
        }))
      },
      xpGained: validated.xpAmount,
      reason: validated.reason
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Error in mastery XP award endpoint', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
