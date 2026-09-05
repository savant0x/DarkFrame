/**
 * @file app/api/chat/heartbeat/route.ts
 * @created 2025-10-26
 * @overview User heartbeat API for online presence tracking
 * 
 * OVERVIEW:
 * Provides endpoint for recording user "I'm alive" heartbeats.
 * Uses MongoDB with TTL (time-to-live) for automatic cleanup of stale
 * presence records (>60 seconds old). Foundation for online status,
 * friend presence, and "who's online" features.
 * 
 * ENDPOINTS:
 * - POST /api/chat/heartbeat: Update user presence timestamp
 * 
 * KEY FEATURES:
 * - Auto-cleanup: Records expire after 60 seconds
 * - Last seen tracking: Records timestamp of last activity
 * - Status support: Online, Away, Busy (future feature)
 * - Minimal database load: Single upsert per heartbeat
 * 
 * USAGE EXAMPLE:
 * ```tsx
 * // Send heartbeat every 30s
 * await fetch('/api/chat/heartbeat', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ userId: '123', username: 'Alice' }),
 * });
 * ```
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251026-017: HTTP Polling Infrastructure
 * - ECHO v5.2 compliant: Complete REST API, error handling, docs
 * - MongoDB collection: user_presence (with TTL index)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

// ============================================================================
// TYPES
// ============================================================================

/**
 * User presence record in MongoDB
 */
interface UserPresence {
  /** User ID (unique) */
  userId: string;
  
  /** Username for display */
  username: string;
  
  /** User level */
  level?: number;
  
  /** VIP status */
  isVIP?: boolean;
  
  /** Current status (Online, Away, Busy) */
  status: 'Online' | 'Away' | 'Busy';
  
  /** Last heartbeat timestamp */
  lastSeen: Date;
  
  /** Auto-delete after 60 seconds (MongoDB TTL) */
  expiresAt: Date;
}

/**
 * POST request body
 */
interface PostHeartbeatRequest {
  userId: string;
  username: string;
  level?: number;
  isVIP?: boolean;
  status?: 'Online' | 'Away' | 'Busy';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds
const COLLECTION_NAME = 'user_presence';

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
 * Body: { userId: '123', username: 'Alice', level: 42, isVIP: true }
 * Response: { success: true, lastSeen: '2025-10-26T10:30:00Z' }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: PostHeartbeatRequest = await request.json();
    const { userId: bodyUserId, username: bodyUsername, level, isVIP, status = 'Online' } = body;

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

    // Validate inputs
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

    // Connect to database
    const db = await getDatabase();
    const collection = db.collection<UserPresence>(COLLECTION_NAME);

    // Upsert presence record (update if exists, insert if not)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HEARTBEAT_TIMEOUT_MS);

    await collection.updateOne(
      { userId },
      {
        $set: {
          userId,
          username,
          level: level ?? 1,
          isVIP: isVIP ?? false,
          status,
          lastSeen: now,
          expiresAt,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      lastSeen: now.toISOString(),
    });
  } catch (error) {
    // Silently fail - heartbeat errors are non-critical
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update presence',
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. MongoDB TTL (Time-To-Live):
 *    - Index on expiresAt field with expireAfterSeconds: 0
 *    - MongoDB automatically deletes documents where expiresAt < now
 *    - No manual cleanup needed
 *    - Index creation: db.user_presence.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
 * 
 * 2. Heartbeat Interval:
 *    - 60 seconds timeout (HEARTBEAT_TIMEOUT_MS)
 *    - Client should send heartbeat every 30s (50% safety margin)
 *    - If client crashes/closes, record expires after 60s
 *    - User appears offline after 60s of no heartbeat
 * 
 * 3. Upsert Strategy:
 *    - updateOne with upsert: true
 *    - Single record per user (userId unique)
 *    - Updates all fields on each heartbeat (username, level, VIP may change)
 *    - Ensures presence data always fresh
 * 
 * 4. Status Field:
 *    - Default: 'Online' (user active)
 *    - 'Away': User idle (future feature with idle detection)
 *    - 'Busy': User in battle/dungeon (future feature)
 *    - Can be set explicitly by client
 * 
 * 5. Security Considerations:
 *    - No authentication check (relies on game being authenticated)
 *    - Could add JWT validation if needed
 *    - Rate limiting recommended (e.g., max 1 request per 10s per user)
 *    - Prevents heartbeat spam
 * 
 * 6. UI Integration:
 *    - Client sends heartbeat every 30s while game open
 *    - Client sends heartbeat on tab visible (Page Visibility API)
 *    - usePolling hook can trigger heartbeat automatically
 *    - Friend list shows green dot if lastSeen < 60s
 * 
 * 7. Performance:
 *    - Unique index on userId for fast upserts
 *    - TTL index for automatic cleanup
 *    - Collection stays small (only active users)
 *    - Minimal database load (1 upsert per user per 30s)
 * 
 * 8. Scalability:
 *    - Presence records are temporary (60s lifetime)
 *    - Collection size ≈ concurrent users (not total users)
 *    - With 1000 concurrent users: ~1000 documents
 *    - Automatic cleanup prevents unbounded growth
 * 
 * 9. Future Enhancements:
 *    - Add current channel field (where user is chatting)
 *    - Add activity type (idle, chatting, battling, etc.)
 *    - Add last action timestamp (for "typing" vs "idle")
 *    - Add geolocation/timezone (for "local time" display)
 *    - Add device type (mobile, desktop)
 * 
 * 10. Friend System Integration:
 *     - Friend list queries user_presence for friend IDs
 *     - Shows online/offline status based on lastSeen
 *     - Shows status icon (green=Online, yellow=Away, red=Busy)
 *     - Shows "Last seen 5 minutes ago" if offline
 * 
 * 11. Online Count Integration:
 *     - /api/chat/online queries user_presence collection
 *     - Counts documents with lastSeen > (now - 60s)
 *     - Can filter by channel permissions (VIP, Clan, etc.)
 *     - Returns real-time online user count
 * 
 * 12. ECHO Compliance:
 *     - ✅ Complete REST API implementation
 *     - ✅ TypeScript with interfaces
 *     - ✅ Comprehensive documentation
 *     - ✅ Error handling with user-friendly messages
 *     - ✅ Input validation
 *     - ✅ Production-ready code
 */
