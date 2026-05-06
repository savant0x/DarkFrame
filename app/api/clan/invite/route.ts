/**
 * @file app/api/clan/invite/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Clan invitation endpoint. Allows clan members with permission to invite other players.
 * Validates clan membership, permissions, and capacity before sending invitations.
 * 
 * ROUTES:
 * - POST /api/clan/invite - Send clan invitation
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token in 'token' cookie
 * - Uses requireClanMembership() middleware
 * 
 * BUSINESS RULES:
 * - Player must be in a clan to invite others
 * - Player must have invitation permission (leader or officer)
 * - Target player must not already be in a clan
 * - Clan must not be at member capacity
 * - Invitation expires after configured time period
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireClanMembership } from '@/lib';
import { invitePlayerToClan } from '@/lib/clanService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * POST /api/clan/invite
 * Invite a player to the clan
 * 
 * @param request - NextRequest with authentication cookie and target username in body
 * @returns NextResponse with invitation data
 * 
 * @example
 * POST /api/clan/invite
 * Body: { targetUsername: "newplayer123" }
 * Response: { success: true, invitation: {...}, message: "Invitation sent to newplayer123" }
 * 
 * @throws {400} Target username required
 * @throws {400} Player already in a clan
 * @throws {400} Clan is full
 * @throws {401} Unauthorized
 * @throws {403} No permission to invite members
 * @throws {404} Target player not found
 * @throws {500} Failed to send invitation
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan/invite');
  const endTimer = log.time('send-invite');
  
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { auth, clan, clanId } = result;

    const body = await request.json();
    const { targetUsername } = body;

    if (!targetUsername) {
      return NextResponse.json(
        { success: false, error: 'Target username is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: targetPlayer } = await supabase
      .from('players')
      .select('username')
      .eq('username', targetUsername)
      .maybeSingle();

    if (!targetPlayer) {
      return NextResponse.json(
        { success: false, error: 'Target player not found' },
        { status: 404 }
      );
    }

    const invitation = await invitePlayerToClan(clanId, auth.playerId, targetPlayer.username);

    log.info('Clan invitation sent', { clanId, targetUsername, inviterId: auth.playerId });
    return NextResponse.json({
      success: true,
      invitation,
      message: `Invitation sent to ${targetUsername}`,
    });

  } catch (error: any) {
    log.error('Clan invite error', error instanceof Error ? error : new Error(String(error)));

    // Handle specific errors
    if (error.message?.includes('permission')) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to invite members' },
        { status: 403 }
      );
    }

    if (error.message?.includes('full')) {
      return NextResponse.json(
        { success: false, error: 'Clan is full' },
        { status: 400 }
      );
    }

    if (error.message?.includes('already in a clan')) {
      return NextResponse.json(
        { success: false, error: 'Player is already in a clan' },
        { status: 400 }
      );
    }

    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
