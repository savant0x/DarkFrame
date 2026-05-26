/**
 * @file app/api/chat/typing/route.ts
 * @created 2025-10-26
 * @overview Typing indicators API for real-time chat feedback
 * 
 * OVERVIEW:
 * Provides endpoints for recording and retrieving typing indicators.
 * Uses an in-memory Map with TTL for lightweight, DB-free typing state.
 * Expired entries are cleaned up on each GET request.
 * 
 * ENDPOINTS:
 * - POST /api/chat/typing: Record user typing in channel
 * - GET /api/chat/typing?channelId=X: Get current typers for channel
 */

import { NextRequest, NextResponse } from 'next/server';

const TYPING_TTL_MS = 10_000;

interface TypingEntry {
  username: string;
  channelId: string;
  expiresAt: number;
}

const typingUsers = new Map<string, TypingEntry>();

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of typingUsers) {
    if (now > entry.expiresAt) {
      typingUsers.delete(key);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: { channelId: string; userId: string; username: string } = await request.json();
    const { channelId, userId, username } = body;

    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'channelId is required' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'username is required' },
        { status: 400 }
      );
    }

    typingUsers.set(userId, {
      username,
      channelId,
      expiresAt: Date.now() + TYPING_TTL_MS,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/chat/typing] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record typing',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'channelId is required' },
        { status: 400 }
      );
    }

    cleanExpired();

    const typers: { userId: string; username: string; timestamp: string }[] = [];
    for (const [userId, entry] of typingUsers) {
      if (entry.channelId === channelId) {
        typers.push({
          userId,
          username: entry.username,
          timestamp: new Date(entry.expiresAt - TYPING_TTL_MS).toISOString(),
        });
      }
    }

    return NextResponse.json({ typers });
  } catch (error) {
    console.error('[GET /api/chat/typing] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch typers',
      },
      { status: 500 }
    );
  }
}
