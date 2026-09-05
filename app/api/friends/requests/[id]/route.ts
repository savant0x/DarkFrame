/**
 * @file app/api/friends/requests/[id]/route.ts
 * @created 2026-09-04
 * @overview Cancel an outgoing pending friend request
 *           (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * DELETE /api/friends/requests/[id]
 * Session-authenticated. The requester can cancel their own pending request;
 * cancels are a hard delete (decline keeps history, cancel does not).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { friendRequests } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { FriendRequestStatus } from '@/types/friend';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { id: requestId } = await context.params;
    const userId = auth.playerId;

    // Delete only if the request exists, is the caller's, and is still pending —
    // the single conditioned statement is race-safe (no read-then-delete window)
    const deleted = await db
      .delete(friendRequests)
      .where(
        and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.from, userId),
          eq(friendRequests.status, FriendRequestStatus.PENDING)
        )
      )
      .returning({ id: friendRequests.id });

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pending request not found (it may have been responded to already)' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/friends/requests/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while cancelling the friend request' },
      { status: 500 }
    );
  }
}
