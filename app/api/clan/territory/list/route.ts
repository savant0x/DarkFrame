/**
 * @file app/api/clan/territory/list/route.ts
 * @created 2026-09-04
 * @overview Clan territory list (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/territory/list?clanId=<id>
 * Session-authenticated + clan membership required. Delegates to
 * territoryService.getClanTerritories (reads the clan's territories jsonb).
 * Serves ClanTerritoryPanel: { success, territories: ClanTerritory[] }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { getClanTerritories } from '@/lib/territoryService';

export async function GET(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedClanId = searchParams.get('clanId');

    if (requestedClanId && requestedClanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, message: 'clanId does not match your clan' },
        { status: 403 }
      );
    }

    const territories = await getClanTerritories(gate.clanId);

    return NextResponse.json(
      {
        success: true,
        territories: territories.map((t) => ({
          ...t,
          _id: t._id ?? `${t.tileX}-${t.tileY}`,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch territories';
    console.error('[API /clan/territory/list GET] Error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
