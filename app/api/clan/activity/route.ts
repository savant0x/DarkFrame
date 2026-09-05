/**
 * @file app/api/clan/activity/route.ts
 * @created 2026-09-04
 * @overview Clan activity single-source endpoint (FID-20260904-005 §5.3).
 *
 * GET /api/clan/activity?clanId=<id>&limit=50
 * Session-authenticated + clan membership required. Serves ClanChatPanel's
 * activity feed and TopNavBar's latest-event poll (limit=1), both reading
 * { success, activities }.
 *
 * NOTE: /api/clan/activities (plural) is the paginated variant for
 * ClanActivityFeed; both share clanActivityService.getClanActivityFeed.
 * Consolidation candidate under Law 13 once client paths are unified.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { getClanActivityFeed } from '@/lib/clanActivityService';

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
        { success: false, error: 'clanId does not match your clan' },
        { status: 403 }
      );
    }

    const limitRaw = Number(searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(200, Math.floor(limitRaw)) : 50;

    const activities = await getClanActivityFeed(gate.clanId, { limit });

    return NextResponse.json(
      {
        success: true,
        activities: activities.map((a) => ({
          ...a,
          _id: a._id ?? '',
          type: a.activityType,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /clan/activity GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
