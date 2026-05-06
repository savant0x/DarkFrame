/**
 * @file app/api/clan/leave/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Clan leave endpoint. Allows players to voluntarily leave their current clan.
 * Leaders must transfer leadership before leaving to prevent orphaned clans.
 * 
 * ROUTES:
 * - POST /api/clan/leave - Leave current clan
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token in 'token' cookie
 * - Uses requireClanMembership() middleware
 * 
 * BUSINESS RULES:
 * - Player must be in a clan to leave
 * - Clan leaders must transfer leadership first
 * - Automatically removes player from clan members array
 * - Updates clan member count
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership, withRequestLogging, createRouteLogger } from '@/lib';
import { leaveClan } from '@/lib/clanService';

/**
 * POST /api/clan/leave
 * Leave current clan
 * 
 * @param request - NextRequest with authentication cookie
 * @returns NextResponse with success status and message
 * 
 * @example
 * POST /api/clan/leave
 * Response: { success: true, message: "You have left Warriors" }
 * 
 * @throws {400} Not in a clan
 * @throws {400} Leader must transfer leadership first
 * @throws {401} Unauthorized
 * @throws {500} Failed to leave clan
 */
export const POST = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('ClanLeaveAPI');
  const endTimer = log.time('clanLeave');
  
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) {
      log.warn('Clan leave attempted without membership');
      return result;
    }
    
    const { auth, clan, clanId } = result;

    log.debug('Clan leave request', { playerId: auth.playerId, clanName: clan.name, clanId });

    await leaveClan(clanId, auth.playerId);

    log.info('Player left clan', { 
      playerId: auth.playerId, 
      clanName: clan.name,
      clanId 
    });

    return NextResponse.json({
      success: true,
      message: `You have left ${clan.name}`,
    });

  } catch (error: any) {
    log.error('Clan leave error', error instanceof Error ? error : new Error(String(error)));

    if (error.message?.includes('leader')) {
      return NextResponse.json(
        { success: false, error: 'Leaders must transfer leadership before leaving' },
        { status: 400 }
      );
    }

    if (error.message?.includes('not in clan')) {
      return NextResponse.json(
        { success: false, error: 'You are not in a clan' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to leave clan' },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});
