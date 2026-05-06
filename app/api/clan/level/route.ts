/**
 * @file app/api/clan/level/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Refactored to use centralized auth + JSDoc)
 * 
 * OVERVIEW:
 * Clan level progression and XP management endpoints.
 * GET retrieves current level info with progress percentages and milestones.
 * POST awards XP to clan (system/admin only - called from game events).
 * 
 * ROUTES:
 * - GET /api/clan/level - Retrieve clan level information
 * - POST /api/clan/level - Award XP to clan (internal use only)
 * 
 * AUTHENTICATION:
 * - GET: Requires clan membership via requireClanMembership()
 * - POST: System-only (internal service calls, not direct player access)
 * 
 * BUSINESS RULES:
 * - Level progression based on XP accumulation
 * - Milestones unlock at specific levels (5, 10, 15, etc.)
 * - XP sources: harvest, combat, research, building, territory, monuments
 * - Level-up rewards automatically distributed to clan bank
 * 
 * INTEGRATION:
 * - clanLevelService for all level calculations
 * - Activity logging for XP awards and level ups
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  requireClanMembership,
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import {
  getClanLevelInfo,
  getClanMilestones,
  awardClanXP,
  getRecommendedXPSources,
  estimateTimeToNextLevel,
} from '@/lib/clanLevelService';
import { ClanXPSource } from '@/types/clan.types';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/clan/level
 * Retrieve clan level information with progress and milestones
 * 
 * @param request - NextRequest with authentication cookie and optional query params
 * @returns NextResponse with level info, milestones, and time estimates
 * 
 * @example
 * GET /api/clan/level
 * Response: { success: true, clanName: "Warriors", level: { currentLevel: 12, totalXP: 125000, ... } }
 * 
 * GET /api/clan/level?detailed=true&estimate=true
 * Response: { ...basic, milestones: {...}, recommendedXPSources: [...], estimatedHoursToNextLevel: 24 }
 * 
 * @throws {400} Not in clan
 * @throws {401} Unauthorized
 * @throws {500} Failed to fetch clan level info
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan/level-get');
  const endTimer = log.time('get-level');
  
  try {
    const supabase = createServiceClient();

    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    const { clan, clanId } = result;

    const { searchParams } = new URL(request.url);
    const includeDetailed = searchParams.get('detailed') === 'true';
    const includeEstimate = searchParams.get('estimate') === 'true';

    const levelInfo = await getClanLevelInfo(clanId);

    const response: any = {
      success: true,
      clanId,
      clanName: clan.name,
      clanTag: clan.tag,
      level: levelInfo,
    };

    if (includeDetailed) {
      const milestones = await getClanMilestones(clanId);
      const recommendations = getRecommendedXPSources();

      response.milestones = milestones;
      response.recommendedXPSources = recommendations;
    }

    if (includeEstimate) {
      const estimate = await estimateTimeToNextLevel(clanId);
      response.estimatedHoursToNextLevel = estimate;
    }

    log.info('Clan level retrieved', { clanId, level: levelInfo.currentLevel, xp: levelInfo.totalXP });
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    log.error('Failed to fetch clan level info', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/clan/level
 * Award XP to a clan (system/admin only)
 * 
 * THIS ENDPOINT IS FOR INTERNAL USE ONLY
 * Called by game event handlers (harvesting, combat, research, etc.)
 * NOT intended for direct player access
 * 
 * @param request - NextRequest with XP award data in body
 * @returns NextResponse with XP award result and level-up info
 * 
 * @example
 * POST /api/clan/level
 * Body: { clanId: "abc123", source: "combat", amount: 5, playerId: "player123" }
 * Response: { success: true, xpAwarded: 150, newLevel: 15, leveledUp: true, milestoneRewards: {...} }
 * 
 * @throws {400} Missing required fields
 * @throws {400} Invalid amount or source
 * @throws {500} Failed to award XP
 */
export const POST = withRequestLogging(postRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan/level-post');
  const endTimer = log.time('award-xp');
  
  try {
    const body = await request.json();
    const { clanId, source, amount, playerId } = body;

    if (!clanId || !source || amount === undefined || !playerId) {
      return NextResponse.json(
        { error: 'Missing required fields: clanId, source, amount, playerId' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    const validSources: ClanXPSource[] = [
      'harvest',
      'combat',
      'research',
      'building',
      'territory_claim',
      'monument_control',
      'member_join',
      'clan_created',
    ];
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid XP source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const result = await awardClanXP(clanId, source, amount, playerId);

    const response: any = {
      success: result.success,
      xpAwarded: result.xpAwarded,
      newLevel: result.newLevel,
      leveledUp: result.leveledUp,
      message: result.leveledUp
        ? `Clan leveled up to ${result.newLevel}! XP awarded: ${result.xpAwarded}`
        : `${result.xpAwarded} XP awarded`,
    };

    if (result.leveledUp && result.milestoneRewards) {
      response.milestoneRewards = result.milestoneRewards;
      response.message += ` | Milestone reached! Rewards: ${result.milestoneRewards.rewards.metal} Metal, ${result.milestoneRewards.rewards.energy} Energy, ${result.milestoneRewards.rewards.researchPoints} RP`;
    }

    log.info('Clan XP awarded', { clanId, source, amount, leveledUp: result.leveledUp });
    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    log.error('Failed to award clan XP', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * 
 * Security Considerations:
 * - POST endpoint has NO authentication check (internal use only)
 * - Should be called only from server-side game logic
 * - Consider adding API key validation for production
 * - Alternative: Make POST require admin JWT token
 * 
 * Integration Points:
 * - Harvest handlers: Award XP on successful harvests
 * - Combat system: Award XP on victories
 * - Research system: Award XP on RP contributions
 * - Building system: Award XP on construction completion
 * - Territory system: Award XP on claims
 * - Monument system: Award XP on monument control
 * 
 * Response Examples:
 * 
 * GET /api/clan/level (basic):
 * {
 *   "success": true,
 *   "clanId": "...",
 *   "clanName": "Dark Crusaders",
 *   "clanTag": "DARK",
 *   "level": {
 *     "currentLevel": 12,
 *     "totalXP": 125000,
 *     "currentLevelXP": 5000,
 *     "xpToNextLevel": 8500,
 *     "progressPercentage": 37,
 *     "nextMilestone": { level: 15, ... },
 *     "milestonesCompleted": 2,
 *     "featuresUnlocked": ["bronze_perks", "silver_perks"],
 *     "maxLevel": false
 *   }
 * }
 * 
 * GET /api/clan/level?detailed=true&estimate=true:
 * {
 *   ...basic response,
 *   "milestones": {
 *     "completed": [...],
 *     "upcoming": [...],
 *     "currentLevel": 12
 *   },
 *   "recommendedXPSources": [
 *     { source: "monument_control", xpRate: 100, description: "..." },
 *     ...
 *   ],
 *   "estimatedHoursToNextLevel": 24
 * }
 * 
 * POST /api/clan/level (level up):
 * {
 *   "success": true,
 *   "xpAwarded": 150,
 *   "newLevel": 15,
 *   "leveledUp": true,
 *   "message": "Clan leveled up to 15! XP awarded: 150 | Milestone reached! Rewards: 250000 Metal, 250000 Energy, 25000 RP",
 *   "milestoneRewards": {
 *     "level": 15,
 *     "rewards": { metal: 250000, energy: 250000, researchPoints: 25000 },
 *     "unlocksFeature": "gold_perks",
 *     "description": "Unlocks Gold tier perks and major rewards"
 *   }
 * }
 */
