/**
 * @file app/api/chat/read-state/route.ts
 * @created 2026-09-19 (FID-20260919-015 W1)
 * @overview GET the authenticated user's persistent channel read state.
 *
 * ChatPanel hydrates its channel unread badges from here on mount: per-channel
 * unread counts (messages newer than the last read, own excluded) plus the raw
 * read positions, so counts survive refresh (they were session-only before W1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { ChannelType } from '@/lib/channelService';
import { getChannelReadState, getReadStateSummary, toReadStateWire } from '@/lib/chatReadStatusService';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // 401
    }

    const state = await getChannelReadState(auth.username);
    const summary = await getReadStateSummary(auth.username, Object.values(ChannelType));

    return NextResponse.json(
      {
        success: true,
        readState: toReadStateWire(state),
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat/read-state GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while fetching read state' },
      { status: 500 }
    );
  }
}
