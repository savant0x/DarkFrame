/**
 * @file app/api/clan/warfare/capture/targets/route.ts
 * @created 2026-09-16 (FID-20260916-013 §5.2)
 * @updated 2026-09-17 (FID-20260916-013: multi-war enumeration shape)
 *
 * OVERVIEW:
 * GET endpoint enumerating ALL of the caller's outgoing ACTIVE wars with the
 * defender's territory tiles for the capture UI. Declarations enforce per-pair
 * uniqueness only, so a clan can hold several outgoing wars — every one is
 * returned. Read-only: no treasury or daily-cap interaction. defenseBonus per
 * tile mirrors attemptTerritoryCapture's adjacency math exactly, so UI previews
 * match server resolution.
 *
 * ROUTES:
 * - GET /api/clan/warfare/capture/targets
 *
 * AUTHENTICATION:
 * - requireClanMembership() — session-authenticated, clan member only.
 *
 * RESPONSE SHAPE:
 * { success: true, activeWars: [{
 *     warId, defenderClanId, defenderTag,
 *     capturesToday, capturesCap,
 *     targets: [{ tileX, tileY, defenseBonus }, ...]
 *   }] }
 * - Empty activeWars array = no outgoing wars: the UI renders "declare war
 *   first" guidance, not an error.
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireClanMembership } from '@/lib/authMiddleware';
import { getCaptureTargets } from '@/lib/clanWarfareService';

export async function GET(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    const result = await getCaptureTargets(gate.clanId);
    return NextResponse.json(
      {
        success: true,
        activeWars: result.activeWars,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /clan/warfare/capture/targets GET] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load capture targets' },
      { status: 500 }
    );
  }
}
