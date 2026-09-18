/**
 * /api/chat/block (FID-20260917-012) - GLOBAL block API.
 *
 * POST   { userId }  -> block (idempotent; self-block refused)
 * DELETE { userId }  -> unblock
 * GET                -> the caller's blocked list
 *
 * Enforcement is server-side (blockService reads in chatService +
 * messagingService), so a block applies to global chat AND DMs immediately.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authMiddleware';
import { blockUser, unblockUser, getBlockedUsernames } from '@/lib/blockService';

// Route-local context getter, mirroring app/api/chat/route.ts's private one.
async function getChatPlayerContext(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return null;
  return { username: auth.username };
}

// FID-20260917-012: tagged pair (boolean discriminant) instead of `as const` —
// the dual-optional const merge made tsc infer a `| undefined` handler
// fall-through under exactOptionalPropertyTypes even though every path returns.
type BlockAuth =
  | { ok: false; error: NextResponse }
  | { ok: true; user: { username: string } };

async function requireUser(request: NextRequest): Promise<BlockAuth> {
  const user = await getChatPlayerContext(request);
  if (!user) {
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user };
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.error;

  const body = (await request.json().catch(() => null)) as { userId?: string } | null;
  if (!body?.userId) {
    return NextResponse.json(
      { success: false, error: 'userId is required' },
      { status: 400 }
    );
  }
  if (body.userId === auth.user.username) {
    return NextResponse.json(
      { success: false, error: 'You cannot block yourself' },
      { status: 400 }
    );
  }

  const ok = await blockUser(auth.user.username, body.userId);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: 'Failed to block user' },
      { status: 500 }
    );
  }
  return NextResponse.json(
    { success: true, message: `Blocked ${body.userId}` },
    { status: 200 }
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.error;

  const body = (await request.json().catch(() => null)) as { userId?: string } | null;
  if (!body?.userId) {
    return NextResponse.json(
      { success: false, error: 'userId is required' },
      { status: 400 }
    );
  }

  const ok = await unblockUser(auth.user.username, body.userId);
  return NextResponse.json(
    { success: ok, message: ok ? `Unblocked ${body.userId}` : 'Was not blocked' },
    { status: ok ? 200 : 404 }
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.error;

  const blocked = await getBlockedUsernames(auth.user.username);
  return NextResponse.json(
    { success: true, blocked, count: blocked.length },
    { status: 200 }
  );
}
