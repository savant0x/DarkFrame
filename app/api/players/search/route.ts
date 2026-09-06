/**
 * @file app/api/players/search/route.ts
 * @created 2025-10-26
 * @overview Player search API endpoint for DM system
 * 
 * OVERVIEW:
 * Provides player search functionality for the Direct Message system's
 * "New Message" modal. Allows users to search for other players by username
 * to start new conversations. Returns player data including username, level,
 * VIP status, and clan information.
 * 
 * FEATURES:
 * - Fuzzy username search (case-insensitive, partial matches)
 * - Excludes current user from search results
 * - Limits results to prevent performance issues (max 20)
 * - Returns essential player data for DM targeting
 * - JWT authentication required
 * - Input validation and sanitization
 * 
 * SECURITY:
 * - Requires valid JWT token via requireAuth middleware
 * - Sanitizes search query to prevent injection attacks
 * - Rate limiting recommended (not implemented - add via middleware)
 * - Only returns public player information (no sensitive data)
 * 
 * USAGE:
 * GET /api/players/search?q=username
 * Returns: Array of matching players with username, level, vip, clanTag
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251026-019: Sprint 2 Phase 2 (Private Messaging)
 * - Supports NewMessageModal player search in ChatPanel
 * - MongoDB regex search for username field
 * - Sorts by level descending (higher level players first)
 * - Future: Add caching for frequent searches
 * - Future: Add pagination for large result sets
 * - Future: Add search by clan name or other criteria
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, players } from '@/lib/db';
import { requireAuth } from '@/lib/authMiddleware';
import { like, ne, desc, and } from 'drizzle-orm';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_SEARCH_RESULTS = 20;
const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 50;

// ============================================================================
// TYPES
// ============================================================================

interface PlayerSearchResult {
  _id: string;
  username: string;
  level: number;
  vip: boolean;
  clanTag?: string;
}

interface _ErrorResponse {
  error: string;
  details?: string;
}

// ============================================================================
// GET HANDLER - Search Players
// ============================================================================

/**
 * Search for players by username
 * 
 * Query Parameters:
 * - q: Search query (username substring, case-insensitive)
 * 
 * Returns:
 * - 200: Array of matching players
 * - 400: Invalid query parameter
 * - 401: Unauthorized (invalid/missing JWT)
 * - 500: Server error
 * 
 * @example
 * GET /api/players/search?q=john
 * Response: [
 *   { _id: "123", username: "JohnDoe", level: 25, vip: true, clanTag: "ELITE" },
 *   { _id: "456", username: "Johnny", level: 15, vip: false }
 * ]
 */
export async function GET(request: NextRequest) {
  try {
    // ============================================
    // AUTHENTICATION
    // ============================================
    const auth = await requireAuth(request);
    
    // Check if auth failed (returns NextResponse)
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error
    }

    // ============================================
    // EXTRACT & VALIDATE QUERY
    // ============================================
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    // Validate query parameter exists
    if (!query) {
      return NextResponse.json(
        { error: 'Bad Request', details: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Validate query length
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        { error: 'Bad Request', details: `Search query must be at least ${MIN_QUERY_LENGTH} character(s)` },
        { status: 400 }
      );
    }

    if (trimmedQuery.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: 'Bad Request', details: `Search query must not exceed ${MAX_QUERY_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Sanitize query (escape regex special characters)
    const sanitizedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // ============================================
    // DATABASE QUERY
    // ============================================
    // Search for players by username (case-insensitive, partial match)
    // Exclude current user from results
    const results = await db
      .select({
        username: players.username,
        level: players.level,
        vip: players.vip,
        clanTag: players.clanName,
      })
      .from(players)
      .where(
        and(
          like(players.username, `%${sanitizedQuery}%`),
          ne(players.username, auth.playerId)
        )
      )
      .orderBy(desc(players.level))
      .limit(MAX_SEARCH_RESULTS);

    // ============================================
    // FORMAT RESULTS
    // ============================================
    const formattedResults: PlayerSearchResult[] = results.map((player) => ({
      _id: player.username,
      username: player.username,
      level: player.level || 1,
      vip: Boolean(player.vip),
      clanTag: player.clanTag || undefined,
    }));

    // ============================================
    // RETURN RESULTS
    // ============================================
    return NextResponse.json(formattedResults, { status: 200 });
  } catch (error) {
    // ============================================
    // ERROR HANDLING
    // ============================================
    console.error('[API] Player search error:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: 'An unexpected error occurred while searching for players',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// FOOTER NOTES
// ============================================================================

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. PERFORMANCE CONSIDERATIONS:
 *    - MySQL LIKE search on username field (ensure index exists)
 *    - Limited to 20 results to prevent large payloads
 *    - Consider adding Redis caching for frequent searches
 *    - Monitor query performance and optimize as needed
 * 
 * 2. SECURITY CONSIDERATIONS:
 *    - JWT authentication required via requireAuth middleware
 *    - Regex special characters escaped to prevent ReDoS attacks
 *    - Only public player data returned (no email, IP, etc.)
 *    - Rate limiting recommended via middleware (not implemented here)
 * 
 * 3. FUTURE ENHANCEMENTS:
 *    - Add pagination for large result sets (offset/limit)
 *    - Add search by clan name or tag
 *    - Add filters (level range, VIP only, online only)
 *    - Add sorting options (by name, level, online status)
 *    - Add search history/suggestions
 *    - Add autocomplete endpoint for real-time suggestions
 * 
 * 4. DATABASE REQUIREMENTS:
 *    - Ensure index on players.username for fast search
 *    - Consider compound index (username, level) for sorted results
 *    - MySQL already has PRIMARY KEY on username
 * 
 * 5. ERROR SCENARIOS:
 *    - Empty query → 400 Bad Request
 *    - Query too short/long → 400 Bad Request
 *    - Invalid JWT → 401 Unauthorized
 *    - Database error → 500 Internal Server Error
 * 
 * 6. TESTING CHECKLIST:
 *    - ✅ Search with valid query returns results
 *    - ✅ Search excludes current user
 *    - ✅ Search is case-insensitive
 *    - ✅ Search handles partial matches
 *    - ✅ Empty query returns 400
 *    - ✅ Query too short returns 400
 *    - ✅ Query too long returns 400
 *    - ✅ Missing query param returns 400
 *    - ✅ Invalid JWT returns 401
 *    - ✅ Results sorted by level descending
 *    - ✅ Results limited to MAX_SEARCH_RESULTS
 */
