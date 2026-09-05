/**
 * @file app/api/clan/activities/route.ts
 * @created 2026-09-04
 * @overview Clan activity feed with pagination and incremental polling
 *           (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/activities?clanId=<id>&limit=50&offset=0 | &since=<ISO timestamp>
 * Session-authenticated + clan membership required. Serves ClanActivityFeed:
 * { success, activities: ClanActivity[] } — rows are mapped to the panel's
 * field names (_id/type aliases included).
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

    const sinceParam = searchParams.get('since');
    const limitRaw = Number(searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(200, Math.floor(limitRaw)) : 50;
    const offsetRaw = Number(searchParams.get('offset') ?? 0);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

    const activities = await getClanActivityFeed(gate.clanId, {
      limit,
      offset,
      // Polling mode: only rows newer than the newest one the client holds
      startDate: sinceParam ? new Date(sinceParam) : undefined,
    });

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
    console.error('[API /clan/activities GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load activities' },
      { status: 500 }
    );
  }
}
