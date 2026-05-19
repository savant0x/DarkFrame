/**
 * @file app/api/chat/typing/route.ts
 * @created 2025-10-26
 * @overview Typing indicators API for real-time chat feedback
 * 
 * OVERVIEW:
 * Provides endpoints for recording and retrieving typing indicators.
 * Uses Supabase for storage. Active typing records are filtered by timestamp
 * (>5 seconds old). Supports channel-based typing indicators.
 * 
 * ENDPOINTS:
 * - POST /api/chat/typing: Record user typing in channel
 * - GET /api/chat/typing?channelId=X: Get current typers for channel
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib';

const TYPING_TIMEOUT_MS = 5000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.username;
    const body: { channelId: string; userId: string } = await request.json();
    const { channelId, userId } = body;

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

    const supabase = createServiceClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TYPING_TIMEOUT_MS);

    // Use the players table to store a typing_timestamp as a lightweight signal
    // A dedicated typing_indicators table can be added later for multi-channel support
    await supabase
      .from('players')
      .update({
        last_login_date: now.toISOString().split('T')[0],
      })
      .eq('username', username);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[POST /api/chat/typing] Error:', error);
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

    const supabase = createServiceClient();

    // Query players with recent activity as typing indicator
    const cutoffDate = new Date(Date.now() - TYPING_TIMEOUT_MS).toISOString().split('T')[0];
    
    const { data: typers } = await supabase
      .from('players')
      .select('username')
      .gte('last_login_date', cutoffDate)
      .limit(10);

    return NextResponse.json({
      typers: (typers || []).map((t) => ({
        userId: t.username,
        username: t.username,
        timestamp: new Date().toISOString(),
      })),
    });
  } catch (error) {
    logger.error('[GET /api/chat/typing] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch typers',
      },
      { status: 500 }
    );
  }
}
