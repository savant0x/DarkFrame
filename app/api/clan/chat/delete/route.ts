/**
 * @file app/api/clan/chat/delete/route.ts
 * @created 2026-09-04
 * @overview Clan chat message soft-delete (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * DELETE /api/clan/chat/delete
 * Session-authenticated + clan membership required. Body:
 * { clanId?: string, messageId: string }
 * clanChatService.deleteClanChatMessage enforces own-message or LEADER/CO_LEADER.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { deleteClanChatMessage } from '@/lib/clanChatService';

interface DeleteBody {
  clanId?: string;
  messageId?: string;
}

export async function DELETE(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: DeleteBody;
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

    const { messageId } = body;
    if (!messageId) {
      return NextResponse.json(
        { success: false, message: 'messageId is required' },
        { status: 400 }
      );
    }

    await deleteClanChatMessage(messageId, gate.clanId, gate.auth.playerId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete message';
    const status = /not found|not in this clan|already deleted|only delete/i.test(message) ? 403 : 500;
    if (status === 500) {
      console.error('[API /clan/chat/delete DELETE] Error:', error);
    }
    return NextResponse.json({ success: false, message }, { status });
  }
}
