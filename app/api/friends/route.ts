/**
 * @file app/api/friends/route.ts
 * @created 2025-10-26
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Friend System base API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getFriends, sendFriendRequest } from '@/lib/friendService';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const friends = await getFriends(username);

    return NextResponse.json({ success: true, friends });

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Unexpected error in GET /api/friends:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while fetching friends' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const userId = (body as Record<string, unknown>).username as string;
    if (!userId) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Request body must be an object' }, { status: 400 });
    }

    const { recipientId, recipientUsername, message } = body as Record<string, unknown>;

    const targetIdentifier =
      (typeof recipientId === 'string' && recipientId.trim()) ||
      (typeof recipientUsername === 'string' && recipientUsername.trim()) ||
      '';

    if (!targetIdentifier) {
      return NextResponse.json({ success: false, error: 'recipientId or recipientUsername is required' }, { status: 400 });
    }

    if (message !== undefined && typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'message must be a string if provided' }, { status: 400 });
    }

    if (typeof message === 'string' && message.length > 200) {
      return NextResponse.json({ success: false, error: 'message must be 200 characters or fewer' }, { status: 400 });
    }

    const friendRequest = await sendFriendRequest(userId, targetIdentifier, message as string | undefined);

    return NextResponse.json({ success: true, request: friendRequest }, { status: 201 });

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

    console.error('Unexpected error in POST /api/friends:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while sending friend request' }, { status: 500 });
  }
}
