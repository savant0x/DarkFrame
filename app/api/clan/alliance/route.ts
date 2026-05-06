/**
 * @file app/api/clan/alliance/route.ts
 * @created 2025-10-18
 * @updated 2025-01-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * 
 * OVERVIEW:
 * API endpoints for creating, accepting, and breaking clan alliances.
 * Supports 4 alliance types: NAP (free), Trade (10K), Military (50K), Federation (200K).
 * 
 * ROUTES:
 * - POST /api/clan/alliance - Propose alliance to another clan
 * - PUT /api/clan/alliance - Accept alliance proposal
 * - DELETE /api/clan/alliance - Break existing alliance
 * - GET /api/clan/alliance - View clan's alliances
 * 
 * AUTHENTICATION:
 * - requireClanMembership() for all handlers
 * - Permission checks in service layer (Leader/Co-Leader for propose/accept, Leader only for break)
 * 
 * BUSINESS RULES:
 * - Alliance types: NAP (free), TRADE (10K metal+energy), MILITARY (50K), FEDERATION (200K)
 * - Proposals require Leader or Co-Leader permissions
 * - Acceptance requires matching permissions in target clan
 * - Breaking alliances requires Leader permission only
 * - 72-hour cooldown after breaking alliance before new proposal
 */

import { NextRequest, NextResponse } from 'next/server';

import { createServiceClient } from '@/lib/supabase/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import {
  proposeAlliance,
  acceptAlliance,
  breakAlliance,
  getAlliancesForClan,
  AllianceType,
} from '@/lib/clanAllianceService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode,
} from '@/lib';
import {
  ProposeAllianceSchema,
  AcceptAllianceSchema,
  BreakAllianceSchema,
} from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const putRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const deleteRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * POST /api/clan/alliance
 * Propose alliance to another clan
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with alliance proposal or error
 * 
 * @example
 * POST /api/clan/alliance
 * Body: { targetClanId: "676a1b2c3d4e5f6a7b8c9d0e", allianceType: "MILITARY" }
 * Response: {
 *   success: true,
 *   alliance: {
 *     _id: "...",
 *     clanIds: ["clan123", "clan456"],
 *     type: "MILITARY",
 *     status: "PROPOSED",
 *     cost: { metal: 50000, energy: 50000 },
 *     proposedAt: "2025-01-23T10:30:00Z"
 *   }
 * }
 * 
 * @throws {400} Missing fields, invalid alliance type, or not in clan
 * @throws {401} Not authenticated
 * @throws {403} Insufficient permissions (not Leader/Co-Leader)
 * @throws {500} Server error
 */
export const POST = withRequestLogging(postRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-alliance-post');
  const endTimer = log.time('propose-alliance');

  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Parse and validate request body with Zod
    const body = await request.json();
    const validatedData = ProposeAllianceSchema.parse(body);
    const { targetClanId, allianceType } = validatedData;

    // Propose alliance (service handles permissions)
    const alliance = await proposeAlliance(clanId, targetClanId, allianceType as AllianceType, auth.playerId);

    log.info('Alliance proposed', { allianceId: alliance._id?.toString(), targetClanId, type: allianceType });
    return NextResponse.json({
      success: true,
      alliance: {
        _id: alliance._id?.toString(),
        clanIds: alliance.clanIds,
        type: alliance.type,
        status: alliance.status,
        cost: alliance.cost,
        proposedAt: alliance.proposedAt,
        proposedBy: alliance.proposedBy,
      },
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Alliance proposal failed', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * PUT /api/clan/alliance
 * Accept alliance proposal
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with accepted alliance or error
 * 
 * @example
 * PUT /api/clan/alliance
 * Body: { allianceId: "alliance123" }
 * Response: {
 *   success: true,
 *   alliance: {
 *     _id: "alliance123",
 *     status: "ACTIVE",
 *     acceptedAt: "2025-01-23T11:00:00Z",
 *     contracts: []
 *   }
 * }
 * 
 * @throws {400} Missing allianceId or not in clan
 * @throws {401} Not authenticated
 * @throws {403} Insufficient permissions or not target clan
 * @throws {500} Server error
 */
export const PUT = withRequestLogging(putRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-alliance-put');
  const endTimer = log.time('accept-alliance');

  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Parse and validate request body with Zod
    const body = await request.json();
    const validatedData = AcceptAllianceSchema.parse(body);
    const { allianceId } = validatedData;

    // Accept alliance (service handles permissions and validation)
    const alliance = await acceptAlliance(allianceId, clanId, auth.playerId);

    log.info('Alliance accepted', { allianceId: alliance._id?.toString(), clanId });
    return NextResponse.json({
      success: true,
      alliance: {
        _id: alliance._id?.toString(),
        clanIds: alliance.clanIds,
        type: alliance.type,
        status: alliance.status,
        cost: alliance.cost,
        proposedAt: alliance.proposedAt,
        acceptedAt: alliance.acceptedAt,
        contracts: alliance.contracts,
      },
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Alliance acceptance failed', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * DELETE /api/clan/alliance
 * Break existing alliance
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with break confirmation or error
 * 
 * @example
 * DELETE /api/clan/alliance
 * Body: { allianceId: "alliance123" }
 * Response: {
 *   success: true,
 *   brokenAt: "2025-01-23T12:00:00Z",
 *   cooldownHours: 72,
 *   cooldownUntil: "2025-01-26T12:00:00Z"
 * }
 * 
 * @throws {400} Missing allianceId or not in clan
 * @throws {401} Not authenticated
 * @throws {403} Insufficient permissions (not Leader)
 * @throws {500} Server error
 */
export const DELETE = withRequestLogging(deleteRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-alliance-delete');
  const endTimer = log.time('break-alliance');

  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Parse and validate request body with Zod
    const body = await request.json();
    const validatedData = BreakAllianceSchema.parse(body);
    const { allianceId } = validatedData;

    // Break alliance (service handles Leader-only permission check)
    const alliance = await breakAlliance(allianceId, clanId, auth.playerId);

    log.info('Alliance broken', { allianceId, clanId });
    return NextResponse.json({
      success: true,
      brokenAt: alliance.brokenAt,
      cooldownHours: 72,
      cooldownUntil: alliance.cooldownUntil,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Alliance breaking failed', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * GET /api/clan/alliance
 * View alliances for player's clan
 * 
 * @param request - NextRequest with auth cookie and optional query params
 * @returns NextResponse with alliance list or error
 * 
 * @example
 * GET /api/clan/alliance?includeInactive=true
 * Response: {
 *   success: true,
 *   alliances: [
 *     {
 *       _id: "...",
 *       clanIds: ["clan1", "clan2"],
 *       type: "MILITARY",
 *       status: "ACTIVE",
 *       proposedAt: "...",
 *       acceptedAt: "..."
 *     }
 *   ],
 *   count: 3
 * }
 * 
 * @throws {400} Not in clan
 * @throws {401} Not authenticated
 * @throws {403} Not a clan member
 * @throws {500} Server error
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-alliance-get');
  const endTimer = log.time('get-alliances');

  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    
    const { clanId } = result;

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Get alliances
    const alliances = await getAlliancesForClan(clanId, includeInactive);

    log.info('Alliances retrieved', { clanId, count: alliances.length, includeInactive });
    return NextResponse.json({
      success: true,
      alliances: alliances.map((a) => ({
        _id: a._id?.toString(),
        clanIds: a.clanIds,
        type: a.type,
        status: a.status,
        cost: a.cost,
        proposedBy: a.proposedBy,
        proposedAt: a.proposedAt,
        acceptedAt: a.acceptedAt,
        contracts: a.contracts,
        brokenAt: a.brokenAt,
        brokenBy: a.brokenBy,
        cooldownUntil: a.cooldownUntil,
      })),
      count: alliances.length,
    });
  } catch (error: any) {
    log.error('Get alliances failed', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

