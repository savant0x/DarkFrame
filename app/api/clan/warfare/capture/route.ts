/**
 * @file app/api/clan/warfare/capture/route.ts
 * @created 2025-10-18
 * @updated 2026-09-17 (FID-20260916-013: A3 error mapping + contract docstring)
 *
 * OVERVIEW:
 * POST endpoint for capturing enemy territory during an active war. The service
 * layer resolves the capture as a CONTESTED roll between real armies:
 * attacker clan army power (Σ strength × quantity, ±15% jitter) vs defender
 * clan army power floored at CAPTURE_BASE_WALL, scaled by the tile's adjacency
 * defense bonus (+10%/adjacent tile, max +50%). The 25k M/E treasury fee is
 * paid win or lose; captures are capped at 3/day per clan per war.
 *
 * ROUTES:
 * - POST /api/clan/warfare/capture - Attempt to capture enemy territory
 *
 * AUTHENTICATION:
 * - requireClanMembership() - Must be clan member
 * - Permission check in service layer (Officer, Co-Leader, Leader only)
 *
 * BUSINESS RULES:
 * - Active war must exist (attacker direction) between the two clans
 * - Territory must be owned by the target clan
 * - Treasury fee (CAPTURE_COST_METAL/ENERGY) paid win or lose
 * - Daily cap: CAPTURES_PER_CLAN_PER_DAY attempts per clan per war
 * - success ≡ captured: a repelled attempt returns success:false (200 OK),
 *   awards the defender CAPTURE_REPEL_POINTS, and the attacker still pays
 * - Permissions: Officer, Co-Leader, or Leader only
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireClanMembership } from '@/lib/authMiddleware';
import { captureTerritory } from '@/lib/clanWarfareService';

/**
 * POST /api/clan/warfare/capture
 * Attempt to capture enemy territory during an active war.
 *
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with capture result or error
 *
 * @example
 * POST /api/clan/warfare/capture
 * Body: { targetClanId: "...", tileX: 10, tileY: 15 }
 * Response (captured): {
 *   success: true,
 *   territory: { tileX: 10, tileY: 15, clanId: "..." },
 *   defenseBonus: 20,
 *   message: "Territory (10, 15) captured!"
 * }
 *
 * @example
 * POST /api/clan/warfare/capture
 * Body: { targetClanId: "...", tileX: 10, tileY: 15 }
 * Response (repelled — 200, success:false; defender +1 war point):
 * {
 *   success: false,
 *   defenseBonus: 40,
 *   message: "Capture repelled — defense bonus 40% (attempt 1/3 today). ..."
 * }
 *
 * @throws {400} Business rules: no active war, territory not owned by target,
 *               insufficient treasury, daily capture limit reached
 * @throws {401} Not authenticated
 * @throws {403} Not Officer/Co-Leader/Leader, or not a clan member
 * @throws {404} Capturing or target clan not found
 * @throws {500} Unexpected server error
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;

    const { auth, clanId } = result;

    // Parse and validate request body
    const body = await request.json();
    const { targetClanId, tileX, tileY } = body;

    if (!targetClanId || typeof targetClanId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid targetClanId. Must be a string.' },
        { status: 400 }
      );
    }

    if (typeof tileX !== 'number' || typeof tileY !== 'number') {
      return NextResponse.json(
        { success: false, message: 'Invalid coordinates. tileX and tileY must be numbers.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return NextResponse.json(
        { success: false, message: 'Coordinates must be integers' },
        { status: 400 }
      );
    }

    // Attempt territory capture via service (permissions, war validation,
    // contested army-power resolution, treasury fee, daily cap)
    const captureResult = await captureTerritory(
      clanId,
      targetClanId,
      tileX,
      tileY,
      auth.username
    );

    // Captured and repelled are both 200 OK — success mirrors `captured`.
    return NextResponse.json({
      success: captureResult.success,
      territory: captureResult.territory,
      defenseBonus: captureResult.defenseBonus,
      message: captureResult.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error capturing territory:', error);

    // 403 — role gate (requireRole) and membership refusals
    if (
      message.includes('Only Leaders') ||
      message.includes('Officer') ||
      message.includes('not in clan')
    ) {
      return NextResponse.json({ success: false, message }, { status: 403 });
    }

    // 400 — client-fixable business rules: war state, ownership, treasury
    // refusal, daily cap (FID-20260916-013 A3: these surfaced as 500s before)
    if (
      message.includes('No active war') ||
      message.includes('not owned by target') ||
      message.includes('Capture costs') ||
      message.includes('Daily capture limit')
    ) {
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    // 404 — referenced resources missing
    if (message.includes('not found')) {
      return NextResponse.json({ success: false, message }, { status: 404 });
    }

    return NextResponse.json(
      { success: false, message: 'Failed to capture territory' },
      { status: 500 }
    );
  }
}
