/**
 * @file app/api/clan/chat/messages/route.ts
 * @created 2026-09-04
 * @updated 2026-09-09 (FID-20260909-027 §3.1: `?since=<ISO>` delta mode — the panel's
 *   10 s poll no longer re-downloads the full 100-message history every tick.
 *   Delta >200 rows re-syncs to a full recent fetch so a stale cursor can never
 *   balloon the response. `since` + `limit` together is a 400: the contracts
 *   are mutually exclusive by design.)
 * @overview Clan chat history (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/chat/messages?clanId=<id>&limit=100   → full recent window
 * GET /api/clan/chat/messages?clanId=<id>&since=<ISO> → messages newer than cursor
 * Session-authenticated + clan membership required (chat is clan-private).
 * Returns { success, messages: ChatMessage[], resync? } with sender* aliases the panel reads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { getClanChatMessages, getMessagesSince, ChatMessage } from '@/lib/clanChatService';

/** Delta responses larger than this re-sync to a full recent fetch (FID-027 §2.3 belt). */
const DELTA_RESYNC_THRESHOLD = 200;

/** Wire shape: the sender* aliases the panel reads, applied uniformly to both modes. */
function toWire(m: ChatMessage) {
  return {
    ...m,
    senderId: m.playerId,
    senderUsername: m.username,
    senderRole: m.role,
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedClanId = searchParams.get('clanId');
    const sinceParam = searchParams.get('since');
    const hasLimitParam = searchParams.get('limit') !== null;

    // Chat is clan-private: the session's clan is authoritative; a clanId param
    // that disagrees with membership is rejected rather than silently honored
    if (requestedClanId && requestedClanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, message: 'clanId does not match your clan' },
        { status: 403 }
      );
    }

    // Delta mode: only messages newer than the caller's cursor.
    if (sinceParam !== null) {
      if (hasLimitParam) {
        return NextResponse.json(
          { success: false, message: 'since and limit are mutually exclusive' },
          { status: 400 }
        );
      }
      const since = new Date(sinceParam);
      if (Number.isNaN(since.getTime())) {
        return NextResponse.json(
          { success: false, message: 'Invalid since timestamp' },
          { status: 400 }
        );
      }

      const delta = await getMessagesSince(gate.clanId, since);

      // Stale/missing cursor with a chatty clan could unbound the delta —
      // re-sync to the full recent window instead of shipping it.
      if (delta.length > DELTA_RESYNC_THRESHOLD) {
        const fresh = await getClanChatMessages(gate.clanId, 100);
        return NextResponse.json(
          { success: true, messages: fresh.map(toWire), resync: true },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: true, messages: delta.map(toWire), resync: false },
        { status: 200 }
      );
    }

    const limitRaw = Number(searchParams.get('limit') ?? 100);
    const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(100, Math.floor(limitRaw)) : 100;

    const messages = await getClanChatMessages(gate.clanId, limit);

    return NextResponse.json(
      {
        success: true,
        messages: messages.map(toWire),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /clan/chat/messages GET] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
