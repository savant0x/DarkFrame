/**
 * @file app/api/friends/[id]/route.ts
 * @created 2025-10-26
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Friend Actions API endpoints (accept, decline, remove)
 */

import { NextRequest, NextResponse } from 'next/server';
import { acceptRequest, declineRequest, removeFriend } from '@/lib/friendService';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    const { action } = body as Record<string, unknown>;

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ success: false, error: 'action is required and must be a string' }, { status: 400 });
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ success: false, error: 'action must be either "accept" or "decline"' }, { status: 400 });
    }

    const { id } = await context.params;

    if (action === 'accept') {
      const friendship = await acceptRequest(userId, id);
      return NextResponse.json({ success: true, friendship });
    } else {
      const declinedRequest = await declineRequest(userId, id);
      return NextResponse.json({ success: true, request: declinedRequest });
    }

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
    console.error('Unexpected error in PATCH /api/friends/[id]:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while processing friend request' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const userId = (body as Record<string, unknown>).username as string;
    if (!userId) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });
    const { id } = await context.params;

    await removeFriend(userId, id);

    return NextResponse.json({ success: true });

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    console.error('Unexpected error in DELETE /api/friends/[id]:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while removing friend' }, { status: 500 });
  }
}
