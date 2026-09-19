/**
 * @file app/api/chat/typing/route.ts
 * @created 2025-10-26
 * @rewritten 2026-09-18 (FID-20260917-017 slice 3: Mongo shim → direct drizzle/pg)
 * @overview Typing indicators API for real-time chat feedback
 *
 * OVERVIEW:
 * Records and retrieves typing indicators per channel, backed by the
 * `typing_indicators` table (5-second window). Returns usernames for the
 * "X is typing..." UI.
 *
 * ENDPOINTS:
 * - POST /api/chat/typing: Record user typing in channel
 * - GET /api/chat/typing?channelId=X: Get current typers for channel
 *
 * KEY FEATURES:
 * - Session-bound identity (FID-20260904-005 §5.1, presence writers)
 * - Atomic upsert on the UNIQUE (channel_id, user_id) index (migration 0034)
 * - Read-time window filter: pg has no TTL engine, so GET only returns rows
 *   whose 5s window is still open — the Mongo TTL used to hide stale rows
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { typingIndicators } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { eq, and, gt, desc } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

/**
 * POST request body
 */
interface PostTypingRequest {
  channelId: string;
  userId?: string;
  username?: string;
}

/**
 * GET response
 */
interface GetTypingResponse {
  typers: Array<{
    userId: string;
    username: string;
    timestamp: string;
  }>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPING_TIMEOUT_MS = 5000; // 5 seconds

// ============================================================================
// POST /api/chat/typing
// ============================================================================

/**
 * Record user typing in channel
 *
 * @param request - Next.js request object
 * @returns Success response
 *
 * @example
 * ```
 * POST /api/chat/typing
 * Body: { channelId: 'global', userId: 'alice', username: 'alice' }
 * Response: { success: true }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: PostTypingRequest = await request.json();
    const { channelId, userId: bodyUserId, username: bodyUsername } = body;

    // FID-20260904-005 §5.1 (presence writers): identity from the SESSION, not the body.
    const auth = await getAuthenticatedUser();
    if (!auth?.username) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const userId = auth.username;
    const username = auth.username;
    if ((bodyUserId && bodyUserId !== userId) || (bodyUsername && bodyUsername !== username)) {
      return NextResponse.json(
        { success: false, error: 'Identity mismatch' },
        { status: 403 }
      );
    }

    // Validate inputs
    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'channelId is required' },
        { status: 400 }
      );
    }

    // Upsert typing indicator (atomic on the unique (channel_id, user_id)
    // index added by migration 0034; the pre-0034 table carried a non-unique
    // index, so the shim's select-then-insert could race two rows per pair).
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TYPING_TIMEOUT_MS);

    await db
      .insert(typingIndicators)
      .values({ id: generateId(), channelId, userId, expiresAt })
      .onConflictDoUpdate({
        target: [typingIndicators.channelId, typingIndicators.userId],
        set: { expiresAt },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/chat/typing] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to complete the request. Please try again.',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/chat/typing
// ============================================================================

/**
 * Get current typers for channel
 *
 * @param request - Next.js request object
 * @returns List of current typers
 *
 * @example
 * ```
 * GET /api/chat/typing?channelId=global
 * Response: {
 *   typers: [
 *     { userId: 'alice', username: 'alice', timestamp: '2026-09-18T10:30:00.000Z' },
 *     { userId: 'bob', username: 'bob', timestamp: '2026-09-18T10:30:02.000Z' }
 *   ]
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    // Validate inputs
    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'channelId is required' },
        { status: 400 }
      );
    }

    // Current typers: the 5s window must still be open. On the pg table there
    // is no TTL engine to delete expired rows, so the read-time filter is what
    // makes a stopped-typing row invisible; the presence cleanup reaps the
    // dead rows.
    const windowFloor = new Date(Date.now() - TYPING_TIMEOUT_MS);
    const typers = await db
      .select({
        userId: typingIndicators.userId,
        expiresAt: typingIndicators.expiresAt,
      })
      .from(typingIndicators)
      .where(and(eq(typingIndicators.channelId, channelId), gt(typingIndicators.expiresAt, windowFloor)))
      .orderBy(desc(typingIndicators.expiresAt));

    // Format response
    // FID-20260905-001: typing_indicators carries (userId, expiresAt) only — no
    // username/timestamp columns (userId IS the username on the Postgres pivot).
    const response: GetTypingResponse = {
      typers: typers.map((t) => ({
        userId: t.userId,
        username: t.userId,
        timestamp: new Date(t.expiresAt).toISOString(),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/chat/typing] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to complete the request. Please try again.',
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. Window (replaces the Mongo TTL):
 *    - expires_at = now + 5s on every write; GET filters expires_at > now - 5s
 *    - a user who stops POSTing drops off the list within 5s
 *
 * 2. Upsert Strategy:
 *    - INSERT … ON CONFLICT (channel_id, user_id) DO UPDATE — one row per
 *      user per channel, race-safe (unique index from migration 0034)
 *
 * 3. Typing Timeout:
 *    - 5 seconds; client sends typing events every 2-3s while typing
 *
 * 4. Security:
 *    - Session-bound identity; forged body identity is refused with 403
 *
 * 5. UI Integration:
 *    - Client polls GET every 2s while the channel is open
 *    - UI shows "Alice, Bob, and Charlie are typing..." (max 3 names)
 */
