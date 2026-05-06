/**
 * @file app/api/clan/join/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Clan join endpoint. Allows players to accept invitations and join clans.
 * Validates invitation validity, expiration, and membership constraints.
 * 
 * ROUTES:
 * - POST /api/clan/join - Accept clan invitation
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token in 'token' cookie
 * - Uses requireAuth() middleware
 * 
 * BUSINESS RULES:
 * - Invitation must exist and not be expired
 * - Player must not already be in a clan
 * - Clan must not be at member capacity
 * - Automatically removes invitation after acceptance
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  requireAuth, 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  JoinClanSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { joinClan, joinClanDirectly } from '@/lib/clanService';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.clanAction);

/**
 * POST /api/clan/join
 * Accept a clan invitation
 * 
 * @param request - NextRequest with authentication cookie and invitation ID in body
 * @returns NextResponse with joined clan data
 * 
 * @example
 * POST /api/clan/join
 * Body: { invitationId: "inv_123" }
 * Response: { success: true, clan: {...}, message: "Welcome to Warriors!" }
 * 
 * @throws {400} Invitation ID required
 * @throws {400} Already in a clan
 * @throws {400} Clan is full
 * @throws {401} Unauthorized
 * @throws {404} Invitation not found or expired
 * @throws {500} Failed to join clan
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ClanJoinAPI');
  const endTimer = log.time('clanJoin');
  
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      log.warn('Unauthenticated clan join attempt');
      return auth;
    }

    const body = await request.json();

    // Direct join by clanId (no invitation needed for public clans)
    if (body.clanId) {
      const result = await joinClanDirectly(body.clanId, auth.playerId);
      log.info('Player joined clan directly', { 
        playerId: auth.playerId, 
        clanId: body.clanId
      });
      return NextResponse.json({
        success: true,
        clan: result.clan,
        message: `Welcome to ${result.clan.name}!`,
      });
    }

    // Invitation-based join
    const validated = JoinClanSchema.parse(body);
    log.debug('Processing clan invitation', { 
      playerId: auth.playerId, 
      invitationId: validated.invitationId 
    });

    const result = await joinClan(validated.invitationId, auth.playerId);

    log.info('Player joined clan', { 
      playerId: auth.playerId, 
      clanName: result.clan.name,
      clanId: result.clan.id 
    });

    return NextResponse.json({
      success: true,
      clan: result.clan,
      message: `Welcome to ${result.clan.name}!`,
    });

  } catch (error: any) {
    if (error instanceof ZodError) {
      log.warn('Clan join validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Clan join error', error instanceof Error ? error : new Error(String(error)));

    if (error.message?.includes('not found')) {
      return createErrorResponse(ErrorCode.CLAN_INVITATION_INVALID, {
        message: 'Invitation not found or expired'
      });
    }

    if (error.message?.includes('already in a clan')) {
      return createErrorResponse(ErrorCode.CLAN_ALREADY_MEMBER, {
        message: 'You are already in a clan'
      });
    }

    if (error.message?.includes('full')) {
      return createErrorResponse(ErrorCode.CLAN_FULL, {
        message: 'Clan is full'
      });
    }

    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
