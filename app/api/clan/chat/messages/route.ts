/**
 * @file app/api/clan/chat/messages/route.ts
 * @created 2026-09-04
 * @overview Clan chat history (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/chat/messages?clanId=<id>&limit=100
 * Session-authenticated + clan membership required (chat is clan-private).
 * Returns { success, messages: ChatMessage[] } with sender* aliases the panel reads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { getClanChatMessages } from '@/lib/clanChatService';

export async function GET(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedClanId = searchParams.get('clanId');

    // Chat is clan-private: the session's clan is authoritative; a clanId param
    // that disagrees with membership is rejected rather than silently honored
    if (requestedClanId && requestedClanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, message: 'clanId does not match your clan' },
        { status: 403 }
      );
    }

    const limitRaw = Number(searchParams.get('limit') ?? 100);
    const limit = Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.min(100, Math.floor(limitRaw)) : 100;

    const messages = await getClanChatMessages(gate.clanId, limit);

    return NextResponse.json(
      {
        success: true,
        messages: messages.map((m) => ({
          ...m,
          senderId: m.playerId,
          senderUsername: m.username,
          senderRole: m.role,
        })),
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
