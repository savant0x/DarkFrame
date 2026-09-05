/**
 * @file app/api/clan/territory/unclaim/route.ts
 * @created 2026-09-04
 * @overview Clan territory abandonment (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/territory/unclaim
 * Session-authenticated + clan membership required. Body (ClanTerritoryPanel):
 * { clanId?: string, tileX: number, tileY: number }
 * Delegates to territoryService.abandonTerritory — the service re-verifies
 * membership and LEADER/CO_LEADER/OFFICER role, so this route stays a thin
 * session gate over it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { abandonTerritory } from '@/lib/territoryService';

interface UnclaimBody {
  clanId?: string;
  tileX?: number;
  tileY?: number;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: UnclaimBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (body.clanId && body.clanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, message: 'clanId does not match your clan' },
        { status: 403 }
      );
    }

    const { tileX, tileY } = body;
    if (
      !Number.isInteger(tileX) ||
      !Number.isInteger(tileY) ||
      (tileX as number) < 0 ||
      (tileY as number) < 0
    ) {
      return NextResponse.json(
        { success: false, message: 'Integer tileX and tileY are required' },
        { status: 400 }
      );
    }

    const result = await abandonTerritory(
      gate.clanId,
      gate.auth.playerId,
      tileX as number,
      tileY as number
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unclaim territory';
    const status = /not a member|not found|insufficient|no territory/i.test(message) ? 403 : 500;
    if (status === 500) {
      console.error('[API /clan/territory/unclaim POST] Error:', error);
    }
    return NextResponse.json({ success: false, message }, { status });
  }
}
