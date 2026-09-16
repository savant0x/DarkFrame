/**
 * @file app/api/friends/block/route.ts
 * @created 2026-09-16
 * @overview Block-user endpoint for FriendActionsMenu (FID-20260916-010).
 *
 * OVERVIEW:
 * FriendActionsMenu (components/friends/FriendActionsMenu.tsx:142) posts
 * `POST /api/friends/block` with body `{ userId: <target> }` and expects
 * `{ success: boolean, error?: string }` — the session caller is NEVER taken
 * from the body (a body-supplied caller would let anyone block as anyone).
 * `lib/friendService.blockUser` validates both ids, refuses self-block, and
 * removes the friendship rows before inserting the block (doc contract at
 * FriendActionsMenu.tsx:329: "Blocking automatically removes friendship").
 *
 * ENDPOINT:
 * - POST /api/friends/block  body: { userId: string }
 * - 400 validation (missing/invalid target, self-block) · 404 unknown user ·
 *   403 permission · 401 unauthenticated · 500 typed error
 * - 200 { success: true } / error paths { success: false, error }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { blockUser } from '@/lib/friendService';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth; // 401

  try {
    const body = await request.json();
    const targetId =
      body && typeof body === 'object' && typeof (body as { userId?: unknown }).userId === 'string'
        ? ((body as { userId: string }).userId).trim()
        : '';

    if (!targetId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    // Caller is the session user; body supplies only the target.
    const blocked = await blockUser(auth.playerId, targetId);
    return NextResponse.json({ success: blocked === true ? true : Boolean(blocked) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof PermissionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to block user' },
      { status: 500 }
    );
  }
}
