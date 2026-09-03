/**
 * @file app/api/friends/requests/route.ts
 * @created 2025-10-26
 * @overview Friend Requests API endpoint
 * 
 * OVERVIEW:
 * Provides REST API endpoint for retrieving friend requests.
 * Returns both pending requests received and requests sent by the user.
 * 
 * KEY FEATURES:
 * - GET /api/friends/requests: Retrieve user's pending friend requests (incoming and outgoing)
 * - JWT authentication via requireAuth
 * - Returns requests with populated sender/recipient player data
 * - Comprehensive error handling with appropriate HTTP status codes
 * - Integration with lib/friendService.ts business logic layer
 * 
 * ENDPOINTS:
 * 
 * GET /api/friends/requests
 * - Get pending friend requests (both received and sent)
 * - Returns: { success: true, received: FriendRequestWithPlayer[], sent: FriendRequestWithPlayer[] }
 * - Status codes: 200 (success), 401 (unauthorized), 500 (server error)
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251026-019: Sprint 2 Phase 3 - Friend System
 * - Uses Next.js 14 App Router API route patterns
 * - Fetches both incoming and outgoing requests in single endpoint
 * - All errors return consistent JSON format: { success: false, error: string }
 * - ECHO v5.2 compliant: Production-ready, comprehensive docs, complete error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requireAuth } from '@/lib/authMiddleware';
import { getPendingRequests, getSentRequests } from '@/lib/friendService';
import { ValidationError } from '@/lib/common/errors';
import type { FriendRequestWithPlayer } from '@/types/friend';

// ============================================================================
// GET /api/friends/requests - Get Pending Friend Requests
// ============================================================================

/**
 * GET /api/friends/requests - Retrieve pending friend requests
 * 
 * Fetches both incoming requests (sent to user) and outgoing requests (sent by user).
 * All requests include populated player data (username, level, VIP, clan tag).
 * Returns empty arrays if no pending requests exist.
 * 
 * @param request - Next.js request object
 * @returns JSON response with received and sent requests arrays or error
 * 
 * @example
 * // Client request
 * const response = await fetch('/api/friends/requests');
 * const data = await response.json();
 * // data: {
 * //   success: true,
 * //   received: [
 * //     {_id: '...', from: '...', to: '...', fromUsername: 'Player1', fromLevel: 45, ...}
 * //   ],
 * //   sent: [
 * //     {_id: '...', from: '...', to: '...', fromUsername: 'Player2', fromLevel: 30, ...}
 * //   ]
 * // }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Get MongoDB connection
    const mongoClient = await clientPromise;
    const db = mongoClient.db(process.env.MONGODB_DB || 'darkframe');

    // 2. Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth; // Return 401 error
    
    const userId = auth.playerId;

    // 3. Fetch pending requests via service layer
    // Run both queries in parallel for better performance
    const [received, sent] = await Promise.all([
      getPendingRequests(userId),  // Requests TO this user
      getSentRequests(userId),     // Requests FROM this user
    ]);

    // 4. Return success response
    return NextResponse.json({
      success: true,
      received,
      sent,
    });

  } catch (error) {
    // Handle specific error types
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    // Log unexpected errors for debugging
    console.error('Unexpected error in GET /api/friends/requests:', error);
    
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while fetching friend requests' },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Dual Request Retrieval:
 *    - Single endpoint returns both received and sent requests
 *    - Parallel Promise.all execution for optimal performance
 *    - Cleaner API than separate endpoints for each direction
 *    - UI can display both lists from single API call
 * 
 * 2. Authentication Strategy:
 *    - Uses requireAuth from lib/authMiddleware.ts
 *    - JWT token validation on endpoint
 *    - Returns 401 Unauthorized if authentication fails
 *    - Consistent with other Friend API routes
 * 
 * 3. Request Validation:
 *    - GET endpoint requires no body validation
 *    - User ID comes from authenticated session
 *    - Service layer handles all business logic validation
 * 
 * 4. Service Layer Integration:
 *    - Calls getPendingRequests() for incoming requests
 *    - Calls getSentRequests() for outgoing requests
 *    - Service layer handles: MongoDB queries, player data population
 *    - API layer focuses on: HTTP concerns, auth, response formatting
 * 
 * 5. Error Handling Strategy:
 *    - Catches ValidationError (shouldn't occur in GET but handled)
 *    - Generic 500 errors for unexpected failures
 *    - Consistent error response format: { success: false, error: string }
 *    - Logs unexpected errors for debugging
 * 
 * 6. Response Format:
 *    - Success: { success: true, received: [...], sent: [...] }
 *    - Error: { success: false, error: string }
 *    - Each request includes populated player data
 *    - Empty arrays returned if no pending requests
 *    - TypeScript types ensure response consistency
 * 
 * 7. Player Data Population:
 *    - Received requests populate sender data (fromUsername, fromLevel, etc.)
 *    - Sent requests populate recipient data (also in fromUsername fields for consistency)
 *    - Service layer handles efficient batch queries (no N+1)
 *    - All player fields optional (defaults to 'Unknown', 1, false)
 * 
 * 8. Performance Optimization:
 *    - Parallel Promise.all reduces total response time
 *    - MongoDB indexes on (to, status) and (from, status)
 *    - Batch player data fetches in service layer
 *    - Sorted by createdAt DESC (newest first)
 * 
 * 9. Business Rules:
 *    - Only returns PENDING status requests
 *    - Expired requests not returned (handled by service layer)
 *    - Requests include optional message field (200 char max)
 *    - Each request has createdAt and expiresAt timestamps
 * 
 * 10. Future Enhancements:
 *     - Add pagination for users with many requests
 *     - Support filtering by request age or sender level
 *     - Add request count summary endpoint
 *     - Implement real-time notifications for new requests
 *     - Add batch accept/decline actions
 * 
 * 11. Security Considerations:
 *     - Authentication prevents unauthorized access
 *     - Only returns requests involving authenticated user
 *     - No sensitive data exposed in player fields
 *     - Service layer ensures users can only see their own requests
 * 
 * 12. ECHO Compliance:
 *     - ✅ Production-ready code (no pseudo-code)
 *     - ✅ TypeScript with strict types
 *     - ✅ Comprehensive JSDoc on all functions
 *     - ✅ Complete error handling
 *     - ✅ OVERVIEW section explaining file purpose
 *     - ✅ Implementation notes documenting decisions
 *     - ✅ Security best practices
 *     - ✅ Performance optimization (Promise.all)
 */
