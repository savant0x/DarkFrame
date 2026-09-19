/**
 * @file app/api/chat/heartbeat/route.ts
 * @created 2025-10-26
 * @rewritten 2026-09-18 (FID-20260917-017 slice 3: Mongo shim → direct drizzle/pg)
 * @overview User heartbeat API for online presence tracking
 *
 * OVERVIEW:
 * Records the authenticated user's "I'm alive" heartbeat into the `user_presence`
 * table (60-second window). Foundation for online status, friend presence, and
 * "who's online" features.
 *
 * ENDPOINTS:
 * - POST /api/chat/heartbeat: Update user presence timestamp
 *
 * KEY FEATURES:
 * - Session-bound identity: presence is written for the SESSION user only
 *   (FID-20260904-005 §5.1, presence writers); body identity fields are accepted
 *   for backwards compatibility but MUST match the session when present.
 * - Atomic upsert: single row per user, keyed on the unique user_id column.
 * - Sliding 60s window: expires_at = now + 60s. There is no Mongo TTL engine on
 *   Postgres — /api/chat/online enforces the window at read time and expired
 *   rows are removed by the presence cleanup, so heartbeat writes stay a single
 *   upsert.
 *
 * PERSISTENCE (PostgreSQL — lib/db/schema/config.ts `user_presence`):
 * - id varchar(24) PK (generated), user_id varchar(20) UNIQUE, last_seen,
 *   expires_at.
 * - The Mongo-era document carried username/level/isVIP/status; those map to NO
 *   column (identity lives in user_id, which IS the username on the pg pivot —
 *   FID-20260905-001) and level/VIP are joined from `players` at read time by
 *   /api/chat/online. Body fields beyond identity are validated for match
 *   compatibility only — never persisted — so the shim's silent key-drop is now
 *   an explicit contract.
 *
 * USAGE EXAMPLE:
 * ```tsx
 * // Send heartbeat every 30s
 * await fetch('/api/chat/heartbeat', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ userId, username, status: 'Online' }),
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { userPresence } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

// ============================================================================
// TYPES
// ============================================================================

/**
 * POST request body
 */
interface PostHeartbeatRequest {
  userId?: string;
  username?: string;
  /** Accepted for body-compat; derived from players at read time. */
  level?: number;
  /** Accepted for body-compat; derived from players at read time. */
  isVIP?: boolean;
  status?: 'Online' | 'Away' | 'Busy';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds

// ============================================================================
// POST /api/chat/heartbeat
// ============================================================================

/**
 * Update user presence timestamp
 *
 * @param request - Next.js request object
 * @returns Success response
 *
 * @example
 * ```
 * POST /api/chat/heartbeat
 * Body: { userId: 'alice', username: 'alice', status: 'Online' }
 * Response: { success: true, lastSeen: '2026-09-18T10:30:00.000Z' }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: PostHeartbeatRequest = await request.json();
    const { userId: bodyUserId, username: bodyUsername, status = 'Online' } = body;

    // FID-20260904-005 §5.1 (presence writers): identity comes from the SESSION — a
    // client-supplied userId/username lets any caller write presence as anyone else
    // (impersonation of the online list). Body identity fields are accepted for
    // backwards compatibility but MUST match the session when present.
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

    // Validate status
    const validStatuses = ['Online', 'Away', 'Busy'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Upsert presence (atomic on the user_id unique index; userPresence.userId
    // IS the username on the pg pivot, so one row per user carries everything
    // /api/chat/online needs — level/VIP are joined from players at read time).
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HEARTBEAT_TIMEOUT_MS);

    await db
      .insert(userPresence)
      .values({ id: generateId(), userId, lastSeen: now, expiresAt })
      .onConflictDoUpdate({
        target: userPresence.userId,
        set: { lastSeen: now, expiresAt },
      });

    return NextResponse.json({
      success: true,
      lastSeen: now.toISOString(),
    });
  } catch {
    // Silently fail - heartbeat errors are non-critical
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
 * 1. Presence window (replaces the Mongo TTL index):
 *    - expires_at = now + 60s on every write
 *    - /api/chat/online filters `last_seen >= now - 60s`, so a client that stops
 *      heartbeating drops out of the online list after 60s
 *    - stale rows are not reader-visible regardless of cleanup timing
 *
 * 2. Heartbeat Interval:
 *    - 60 seconds timeout (HEARTBEAT_TIMEOUT_MS)
 *    - Client sends heartbeat every 30s (50% safety margin)
 *    - If client crashes/closes, the user appears offline after 60s
 *
 * 3. Upsert Strategy:
 *    - INSERT … ON CONFLICT (user_id) DO UPDATE — atomic, race-safe
 *      (the shim rode the same unique index via its CONFLICT_TARGETS registry)
 *    - Single row per user (user_id unique)
 *    - last_seen/expires_at are the only mutable columns
 *
 * 4. Status Field:
 *    - Validated ('Online' | 'Away' | 'Busy') but not persisted — no column
 *      carries it on the pg table; 'Online' is the de-facto state of any user
 *      inside the presence window (future: add a status column if Away/Busy ship)
 *
 * 5. Security Considerations:
 *    - Session-bound identity (FID-20260904-005 §5.1): body identity must match
 *      the session or the write is refused with 403
 *    - Rate limiting recommended (e.g., max 1 request per 10s per user)
 *
 * 6. UI Integration:
 *    - Client sends heartbeat every 30s while game open (ChatPanel usePolling)
 *    - Friend list shows green dot if lastSeen < 60s
 *
 * 7. Performance:
 *    - Unique index on user_id for fast upserts
 *    - Index on expires_at for the cleanup sweep
 *    - Minimal database load (1 upsert per user per 30s)
 *
 * 8. Friend/Online Integration:
 *    - /api/chat/online reads this table (joined with players for level/VIP)
 *    - Counts rows with last_seen >= now - 60s
 */
