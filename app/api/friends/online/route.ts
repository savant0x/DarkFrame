/**
 * @file app/api/friends/online/route.ts
 * @created 2026-09-16
 * @overview Friend online-status endpoint for FriendsList polling (FID-20260916-010).
 *
 * OVERVIEW:
 * FriendsList (components/friends/FriendsList.tsx:138) polls
 * `GET /api/friends/online?ids=<comma,separated>` and expects
 * `{ success: true, statuses: { [userId]: 'online' | 'offline' } }` — every
 * requested id present, silent failure tolerated client-side.
 *
 * Presence source: the `user_presence` table (lib/db/schema/config.ts:236),
 * upserted by the chat heartbeat with a 60-second `expiresAt`
 * (app/api/chat/heartbeat/route.ts:86-87). A friend is online iff an
 * unexpired row exists; unknown/expired ids map to 'offline' so the merged
 * status object is always total.
 *
 * ENDPOINT:
 * - GET /api/friends/online?ids=a,b,c   (≤200 ids; 400 over cap or empty)
 * - 401 unauthenticated (requireAuth, sibling friends-route pattern)
 * - 200 { success: true, statuses }
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, gt, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { userPresence } from '@/lib/db/schema';

/** Poll-list cap: the friends list cannot exceed 200; anything more is abuse. */
const MAX_IDS = 200;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth; // 401

  const idsParam = request.nextUrl.searchParams.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: 'ids parameter is required' }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { success: false, error: `ids is limited to ${MAX_IDS} entries` },
      { status: 400 }
    );
  }

  // Online iff presence row exists and has not expired (60s heartbeat TTL).
  const now = new Date();
  const onlineRows = await db
    .select({ userId: userPresence.userId })
    .from(userPresence)
    .where(and(inArray(userPresence.userId, ids), gt(userPresence.expiresAt, now)));

  const onlineSet = new Set(onlineRows.map((row) => row.userId));
  // Every requested id appears — unknown/expired friends are 'offline'.
  const statuses = Object.fromEntries(ids.map((id) => [id, onlineSet.has(id) ? 'online' : 'offline']));

  return NextResponse.json({ success: true, statuses });
}
