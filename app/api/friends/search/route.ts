/**
 * @file app/api/friends/search/route.ts
 * @created 2025-10-26
 * @overview Friend Search API endpoint
 * 
 * OVERVIEW:
 * Provides REST API endpoint for searching users to send friend requests.
 * Returns matching players with their current friend status relative to authenticated user.
 * 
 * KEY FEATURES:
 * - GET /api/friends/search?q=username: Search for users by username
 * - Returns players with friend status (already friends, pending request, or none)
 * - Excludes blocked users and current user from results
 * - JWT authentication via requireAuth
 * - Comprehensive error handling with appropriate HTTP status codes
 * - Integration with lib/friendService.ts business logic layer
 * 
 * ENDPOINTS:
 * 
 * GET /api/friends/search?q=username&limit=20
 * - Search for users by username with friend status
 * - Query params: q (search query, required), limit (max results, optional, default 20)
 * - Returns: { success: true, results: PlayerSearchResult[] }
 * - Status codes: 200 (success), 400 (validation), 401 (unauthorized), 500 (server error)
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251026-019: Sprint 2 Phase 3 - Friend System
 * - Uses Next.js 14 App Router API route patterns
 * - URL query parameter parsing for search term and limit
 * - All errors return consistent JSON format: { success: false, error: string }
 * - ECHO v5.2 compliant: Production-ready, comprehensive docs, complete error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { requireAuth } from '@/lib/authMiddleware';
import { searchUsers } from '@/lib/friendService';
import { ValidationError } from '@/lib/common/errors';


// ============================================================================
// GET /api/friends/search - Search Users
// ============================================================================

/**
 * GET /api/friends/search - Search for users by username
 * 
 * Performs case-insensitive username search and returns matching players
 * with their friend status relative to authenticated user. Excludes current
 * user and blocked users from results.
 * 
 * @param request - Next.js request object with URL search params
 * @returns JSON response with search results array or error
 * 
 * @example
 * // Client request
 * const response = await fetch('/api/friends/search?q=warrior&limit=10');
 * const data = await response.json();
 * // data: {
 * //   success: true,
 * //   results: [
 * //     {
 * //       _id: 'player-123',
 * //       username: 'WarriorKing',
 * //       level: 50,
 * //       vip: true,
 * //       clanTag: '[WK]',
 * //       friendStatus: 'accepted',  // Already friends
 * //       hasPendingRequest: false
 * //     },
 * //     {
 * //       _id: 'player-456',
 * //       username: 'DarkWarrior',
 * //       level: 35,
 * //       vip: false,
 * //       hasPendingRequest: true  // Pending request exists
 * //     }
 * //   ]
 * // }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Get MongoDB connection
    const mongoClient = await clientPromise;
    const _db = mongoClient.db(process.env.MONGODB_DB || 'darkframe');

    // 2. Authenticate user
  const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth; // Return 401 error
    
  // Support both shapes in tests/prod (playerId vs userId)
  const authRec = auth as unknown as Record<string, unknown>;
    const userId = (authRec.playerId ?? authRec.userId) as string;

    // 3. Parse URL search params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limitParam = searchParams.get('limit');

    // 4. Validate query parameter
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Enforce max length (<= 50) at API layer per tests and docs
    if (query.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Search query must be 50 characters or fewer' },
        { status: 400 }
      );
    }

    // 5. Parse and validate limit parameter (optional)
    let limit = 20; // Default limit
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        return NextResponse.json(
          { success: false, error: 'limit must be a number between 1 and 50' },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    // 6. Search users via service layer
    const results = await searchUsers(userId, query, limit);

    // 7. Return success response
    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error) {
    // Handle specific error types
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : String(error) },
        { status: 400 }
      );
    }

    // Log unexpected errors for debugging
    console.error('Unexpected error in GET /api/friends/search:', error);
    
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while searching users' },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. URL Query Parameters:
 *    - Uses Next.js URL searchParams API
 *    - Required param: q (search query)
 *    - Optional param: limit (max results, default 20, max 50)
 *    - RESTful GET pattern for search functionality
 * 
 * 2. Authentication Strategy:
 *    - Uses requireAuth from lib/authMiddleware.ts
 *    - JWT token validation on endpoint
 *    - Returns 401 Unauthorized if authentication fails
 *    - User ID used to determine friend status in results
 * 
 * 3. Request Validation:
 *    - Validates 'q' parameter exists and is non-empty
 *    - Validates 'limit' parameter is number between 1-50
 *    - Returns 400 Bad Request with specific error messages
 *    - Service layer handles additional validation (query length)
 * 
 * 4. Service Layer Integration:
 *    - Calls searchUsers(userId, query, limit)
 *    - Service layer handles:
 *      * Case-insensitive regex search on username
 *      * Exclusion of current user and blocked users
 *      * Friend status lookup (are friends, pending request)
 *      * Player data population
 *      * MongoDB indexed search
 *    - API layer focuses on: HTTP concerns, auth, param parsing
 * 
 * 5. Error Handling Strategy:
 *    - Catches ValidationError from service layer
 *    - Maps to 400 Bad Request
 *    - Generic 500 errors for unexpected failures
 *    - Consistent error response format: { success: false, error: string }
 *    - Logs unexpected errors for debugging
 * 
 * 6. Response Format:
 *    - Success: { success: true, results: PlayerSearchResult[] }
 *    - Error: { success: false, error: string }
 *    - Each result includes:
 *      * Player data: _id, username, level, vip, clanTag
 *      * Friend status: friendStatus (if friends), hasPendingRequest (boolean)
 *    - Empty array if no matches found
 * 
 * 7. Search Behavior:
 *    - Case-insensitive username matching
 *    - Partial match support (regex pattern)
 *    - Results sorted by level DESC (highest level first)
 *    - Max query length: 50 characters
 *    - Max results: 50 (configurable via limit param)
 * 
 * 8. Friend Status Indicators:
 *    - friendStatus: 'accepted' if already friends
 *    - hasPendingRequest: true if pending request exists (either direction)
 *    - Both undefined if no relationship exists
 *    - Enables UI to show appropriate action buttons (Add Friend, Pending, Message)
 * 
 * 9. Performance Optimization:
 *    - MongoDB index on username field for fast regex search
 *    - Service layer uses batch queries (no N+1)
 *    - Limit parameter prevents excessive result sets
 *    - Excluded users fetched in single query
 * 
 * 10. Security Considerations:
 *     - Authentication prevents unauthorized searches
 *     - Regex pattern escaped to prevent injection
 *     - Blocked users not returned in results
 *     - Current user excluded from results
 *     - Query length limited to prevent abuse
 * 
 * 11. Use Cases:
 *     - Add Friend modal search input
 *     - Friend discovery feature
 *     - Autocomplete for @mentions (filter to non-friends)
 *     - Player lookup for clan invites
 *     - Social features requiring user search
 * 
 * 12. Future Enhancements:
 *     - Add advanced filters (level range, VIP only, clan)
 *     - Support multiple search fields (username, clan tag)
 *     - Implement search history/suggestions
 *     - Add "Suggested Friends" (mutual friends)
 *     - Support searching by partial level or stats
 *     - Add rate limiting to prevent abuse
 * 
 * 13. ECHO Compliance:
 *     - ✅ Production-ready code (no pseudo-code)
 *     - ✅ TypeScript with strict types
 *     - ✅ Comprehensive JSDoc on all functions
 *     - ✅ Complete error handling
 *     - ✅ OVERVIEW section explaining file purpose
 *     - ✅ Implementation notes documenting decisions
 *     - ✅ Security best practices (auth, validation, sanitization)
 *     - ✅ Performance optimization (indexes, limits)
 */
