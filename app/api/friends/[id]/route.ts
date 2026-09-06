/**
 * @file app/api/friends/[id]/route.ts
 * @created 2025-10-26
 * @overview Friend Actions API endpoints (accept, decline, remove)
 * 
 * OVERVIEW:
 * Provides REST API endpoints for friend request and friendship management.
 * Handles accepting/declining friend requests and removing existing friendships.
 * 
 * KEY FEATURES:
 * - PATCH /api/friends/[id]: Accept or decline a friend request
 * - DELETE /api/friends/[id]: Remove an existing friendship
 * - JWT authentication via requireAuth for all endpoints
 * - Request validation and action-based routing
 * - Comprehensive error handling with appropriate HTTP status codes
 * - Integration with lib/friendService.ts business logic layer
 * 
 * ENDPOINTS:
 * 
 * PATCH /api/friends/[id]
 * - Accept or decline a friend request by ID
 * - Request body: { action: 'accept' | 'decline' }
 * - Returns: { success: true, friendship?: Friend, request?: FriendRequest }
 * - Status codes: 200 (success), 400 (validation), 401 (unauthorized), 403 (permission), 404 (not found), 500 (server error)
 * 
 * DELETE /api/friends/[id]
 * - Remove an existing friendship by friend user ID
 * - Returns: { success: true }
 * - Status codes: 200 (success), 400 (validation), 401 (unauthorized), 404 (not found), 500 (server error)
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251026-019: Sprint 2 Phase 3 - Friend System
 * - Uses Next.js 14 App Router dynamic route patterns
 * - Action-based PATCH routing (accept vs decline)
 * - All errors return consistent JSON format: { success: false, error: string }
 * - ECHO v5.2 compliant: Production-ready, comprehensive docs, complete error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { acceptRequest, declineRequest, removeFriend } from '@/lib/friendService';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';


// ============================================================================
// PATCH /api/friends/[id] - Accept or Decline Friend Request
// ============================================================================

/**
 * PATCH /api/friends/[id] - Accept or decline a friend request
 * 
 * Routes to acceptRequest or declineRequest based on action parameter.
 * Validates that user is the recipient of the request before processing.
 * 
 * @param request - Next.js request object with JSON body
 * @param params - Route params containing request ID
 * @returns JSON response with friendship/request data or error
 * 
 * @example
 * // Accept friend request
 * const response = await fetch('/api/friends/req-123', {
 *   method: 'PATCH',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ action: 'accept' })
 * });
 * const data = await response.json();
 * // data: { success: true, friendship: {_id: '...', userId: '...', friendId: '...', ...} }
 * 
 * @example
 * // Decline friend request
 * const response = await fetch('/api/friends/req-456', {
 *   method: 'PATCH',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ action: 'decline' })
 * });
 * const data = await response.json();
 * // data: { success: true, request: {_id: '...', status: 'declined', ...} }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user (Postgres pivot: services own all persistence)
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth; // Return 401 error
    
    const userId = auth.playerId;

    // 3. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Request body must be an object' },
        { status: 400 }
      );
    }

    const { action } = body as Record<string, unknown>;

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { success: false, error: 'action is required and must be a string' },
        { status: 400 }
      );
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json(
        { success: false, error: 'action must be either "accept" or "decline"' },
        { status: 400 }
      );
    }

    // 4. Get request ID from route params
  const { id } = await context.params;
  const requestId = id;

    // 5. Route to appropriate service function
    if (action === 'accept') {
      // Accept request → creates friendship
      const friendship = await acceptRequest(userId, requestId);
      
      return NextResponse.json({
        success: true,
        friendship,
      });
    } else {
      // Decline request → updates request status
      const declinedRequest = await declineRequest(userId, requestId);
      
      return NextResponse.json({
        success: true,
        request: declinedRequest,
      });
    }

  } catch (error) {
    // Handle specific error types
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof PermissionError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    // Log unexpected errors for debugging
    console.error('Unexpected error in PATCH /api/friends/[id]:', error);
    
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while processing friend request' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/friends/[id] - Remove Friendship
// ============================================================================

/**
 * DELETE /api/friends/[id] - Remove an existing friendship
 * 
 * Removes bidirectional friendship between authenticated user and friend.
 * Validates that friendship exists before attempting removal.
 * 
 * @param request - Next.js request object
 * @param params - Route params containing friend user ID
 * @returns JSON response with success status or error
 * 
 * @example
 * // Remove friend
 * const response = await fetch('/api/friends/player-456', {
 *   method: 'DELETE'
 * });
 * const data = await response.json();
 * // data: { success: true }
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user (Postgres pivot: services own all persistence)
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth; // Return 401 error
    
    const userId = auth.playerId;

    // 3. Get friend ID from route params
  const { id } = await context.params;
  const friendId = id;

    // 4. Remove friendship via service layer
    await removeFriend(userId, friendId);

    // 5. Return success response
    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    // Handle specific error types
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    // Log unexpected errors for debugging
    console.error('Unexpected error in DELETE /api/friends/[id]:', error);
    
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while removing friend' },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Dynamic Route Parameters:
 *    - Uses Next.js 14 dynamic route [id] pattern
 *    - PATCH endpoint: [id] = friend request ID
 *    - DELETE endpoint: [id] = friend user ID
 *    - Different semantics but same route pattern
 * 
 * 2. Action-Based Routing (PATCH):
 *    - Single endpoint handles accept and decline actions
 *    - Action parameter determines service function call
 *    - Cleaner API than separate POST endpoints
 *    - RESTful pattern (PATCH updates request status)
 * 
 * 3. Authentication Strategy:
 *    - Uses requireAuth from lib/authMiddleware.ts
 *    - JWT token validation on all endpoints
 *    - Returns 401 Unauthorized if authentication fails
 *    - Consistent with other Friend API routes
 * 
 * 4. Request Validation:
 *    - PATCH validates action field (must be 'accept' or 'decline')
 *    - DELETE requires no body validation
 *    - Request/friend ID from route params (no validation needed)
 *    - Returns 400 Bad Request with specific error messages
 * 
 * 5. Service Layer Integration:
 *    - Delegates all business logic to lib/friendService.ts
 *    - Service layer validates: request ownership, pending status, friend limits
 *    - API layer focuses on: HTTP concerns, auth, routing
 *    - Clean separation of concerns
 * 
 * 6. Error Handling Strategy:
 *    - Catches specific error types (ValidationError, PermissionError, NotFoundError)
 *    - Maps service errors to HTTP status codes:
 *      * ValidationError → 400 Bad Request
 *      * PermissionError → 403 Forbidden
 *      * NotFoundError → 404 Not Found
 *    - Generic 500 errors for unexpected failures
 *    - Consistent error response format
 * 
 * 7. Response Format:
 *    - Success responses: { success: true, ...data }
 *    - Error responses: { success: false, error: string }
 *    - PATCH accept returns friendship object
 *    - PATCH decline returns updated request object
 *    - DELETE returns simple success confirmation
 * 
 * 8. Business Rules (Enforced by Service Layer):
 *    - Accept: Only recipient can accept request
 *    - Accept: Request must be pending status
 *    - Accept: Neither user exceeds 100 friends limit
 *    - Decline: Only recipient can decline request
 *    - Remove: User must be part of friendship
 *    - Remove: Friendship must exist
 * 
 * 9. Security Considerations:
 *    - Authentication prevents unauthorized actions
 *    - Service layer validates user permissions
 *    - No sensitive data exposed in error messages
 *    - Cannot accept/decline requests not sent to you
 *    - Cannot remove friendships you're not part of
 * 
 * 10. ECHO Compliance:
 *     - ✅ Production-ready code (no pseudo-code)
 *     - ✅ TypeScript with strict types
 *     - ✅ Comprehensive JSDoc on all functions
 *     - ✅ Complete error handling
 *     - ✅ OVERVIEW section explaining file purpose
 *     - ✅ Implementation notes documenting decisions
 *     - ✅ Security best practices
 */
