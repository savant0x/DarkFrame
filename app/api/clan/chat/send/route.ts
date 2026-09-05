/**
 * @file app/api/clan/chat/send/route.ts
 * @created 2026-09-04
 * @overview Clan chat message send (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/chat/send
 * Session-authenticated + clan membership required. Body:
 * { clanId?: string, content: string }
 * Identity (playerId/username/role) comes exclusively from the session;
 * clanChatService enforces membership, recruit wait, and rate limits.
 * Returns the persisted ChatMessage (the panel appends it to local state).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { sendClanChatMessage, MessageType } from '@/lib/clanChatService';

interface SendBody {
  clanId?: string;
  content?: string;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: SendBody;
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

    const content = (body.content || '').trim();
    if (!content) {
      return NextResponse.json(
        { success: false, message: 'Message content is required' },
        { status: 400 }
      );
    }

    const message = await sendClanChatMessage(
      gate.clanId,
      gate.auth.playerId,
      content,
      MessageType.USER
    );

    return NextResponse.json(
      { success: true, message: { ...message, senderId: message.playerId, senderUsername: message.username, senderRole: message.role } },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    const status = /not a member|not found|wait|too long|cannot be empty|rate limit/i.test(message) ? 400 : 500;
    if (status === 500) {
      console.error('[API /clan/chat/send POST] Error:', error);
    }
    return NextResponse.json({ success: false, message }, { status });
  }
}
