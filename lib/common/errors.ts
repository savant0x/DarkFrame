/**
 * Common Error Classes
 * Created: 2025-10-26
 * Feature: FID-20251026-001 (ECHO Compliance Refactor - Phase 5)
 * 
 * OVERVIEW:
 * Shared error classes used across multiple service layers. Extracted from
 * friendService, dmService, and other services to follow DRY principle.
 * These error classes provide semantic error types for consistent error handling
 * across the application.
 * 
 * KEY FEATURES:
 * - ValidationError: Invalid input data (400 Bad Request)
 * - NotFoundError: Resource doesn't exist (404 Not Found)
 * - PermissionError: User lacks authorization (403 Forbidden)
 * 
 * USAGE:
 * Import from @/lib/common/errors instead of defining in each service:
 * 
 * @example
 * import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';
 * 
 * if (!isValidObjectId(userId)) {
 *   throw new ValidationError('Invalid user ID format');
 * }
 * 
 * if (!user) {
 *   throw new NotFoundError('User not found');
 * }
 * 
 * if (!hasPermission) {
 *   throw new PermissionError('Insufficient permissions');
 * }
 * 
 * API INTEGRATION:
 * These errors should be caught at the API layer and mapped to HTTP status codes:
 * - ValidationError → 400 Bad Request
 * - NotFoundError → 404 Not Found
 * - PermissionError → 403 Forbidden
 * - Generic Error → 500 Internal Server Error
 * 
 * DEPENDENCIES:
 * - None (pure TypeScript error classes)
 * 
 * EXPORTED BY:
 * - lib/common/index.ts (barrel export)
 * - lib/index.ts (re-exported for convenience)
 */

/**
 * Error thrown when validation fails due to invalid input data
 * 
 * Use this for:
 * - Invalid format (email, phone, ObjectId, etc.)
 * - Out of range values
 * - Missing required fields
 * - Invalid data types
 * - Business rule violations (max length, min value, etc.)
 * 
 * @class ValidationError
 * @extends Error
 * 
 * @example
 * // Invalid ObjectId format
 * if (!isValidObjectId(userId)) {
 *   throw new ValidationError('Invalid user ID format');
 * }
 * 
 * @example
 * // Message too long
 * if (message.length > 1000) {
 *   throw new ValidationError('Message cannot exceed 1000 characters');
 * }
 * 
 * @example
 * // Missing required field
 * if (!username || username.trim().length === 0) {
 *   throw new ValidationError('Username is required');
 * }
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Error thrown when a requested resource doesn't exist
 * 
 * Use this for:
 * - Database queries returning null/undefined
 * - File not found
 * - Route/endpoint not found
 * - Referenced entity missing (foreign key doesn't exist)
 * 
 * @class NotFoundError
 * @extends Error
 * 
 * @example
 * // User not found in database
 * const user = await db.collection('users').findOne({ _id: userId });
 * if (!user) {
 *   throw new NotFoundError('User not found');
 * }
 * 
 * @example
 * // Friend request doesn't exist
 * const request = await db.collection('friendRequests').findOne({ _id: requestId });
 * if (!request) {
 *   throw new NotFoundError('Friend request not found');
 * }
 * 
 * @example
 * // Conversation not found
 * if (!conversation) {
 *   throw new NotFoundError('Conversation not found');
 * }
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotFoundError);
    }
  }
}

/**
 * Error thrown when user lacks permission for an operation
 * 
 * Use this for:
 * - Unauthorized access to resources
 * - Insufficient role/privileges
 * - Blocked/banned users
 * - Business rule restrictions (can't friend yourself, can't delete other's messages, etc.)
 * 
 * @class PermissionError
 * @extends Error
 * 
 * @example
 * // Can only edit own messages
 * if (message.senderId !== currentUserId) {
 *   throw new PermissionError('Can only edit your own messages');
 * }
 * 
 * @example
 * // Not a clan member
 * if (!isClanMember) {
 *   throw new PermissionError('You must be a clan member to access this');
 * }
 * 
 * @example
 * // Blocked user
 * if (isBlocked) {
 *   throw new PermissionError('Cannot send friend request to this user');
 * }
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionError);
    }
  }
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. ERROR HANDLING PATTERN:
 *    These error classes should be caught at the API route level and
 *    mapped to appropriate HTTP status codes:
 * 
 *    try {
 *      await someService.doSomething();
 *    } catch (error) {
 *      if (error instanceof ValidationError) {
 *        return res.status(400).json({ error: error.message });
 *      }
 *      if (error instanceof NotFoundError) {
 *        return res.status(404).json({ error: error.message });
 *      }
 *      if (error instanceof PermissionError) {
 *        return res.status(403).json({ error: error.message });
 *      }
 *      // Unexpected error
 *      console.error('Unexpected error:', error);
 *      return res.status(500).json({ error: 'Internal server error' });
 *    }
 * 
 * 2. STACK TRACES:
 *    Error.captureStackTrace() ensures proper stack traces in Node.js/V8.
 *    This helps with debugging by showing where the error originated.
 * 
 * 3. EXTENSIBILITY:
 *    If you need additional error types, follow this pattern:
 *    - Extend Error class
 *    - Set this.name to class name
 *    - Call Error.captureStackTrace if available
 *    - Add comprehensive JSDoc with usage examples
 * 
 * 4. CENTRALIZED LOCATION:
 *    These errors are in lib/common/ to emphasize they're shared utilities.
 *    This prevents duplication across service layers and ensures consistency.
 * 
 * 5. TYPESCRIPT BENEFITS:
 *    Using instanceof checks with these custom error classes enables
 *    type narrowing in TypeScript, improving type safety in error handling.
 * 
 * 6. MIGRATION FROM EXISTING CODE:
 *    Services that previously defined these errors locally should:
 *    - Remove local error class definitions
 *    - Import from '@/lib/common/errors'
 *    - Update any catch blocks to use imported types
 * 
 * 7. FUTURE ENHANCEMENTS:
 *    - Add error codes for programmatic error handling
 *    - Add metadata field for additional context
 *    - Add logging integration
 *    - Add error serialization for API responses
 * 
 * ECHO v5.2 Compliance:
 * ✅ Complete implementation (no pseudo-code)
 * ✅ TypeScript with proper types
 * ✅ JSDoc on all exported classes
 * ✅ OVERVIEW section
 * ✅ Error handling pattern documented
 * ✅ Usage examples provided
 * ✅ Implementation notes
 * 
 * FID-20251026-001: ECHO Architecture Compliance Refactor - Phase 5
 * Created: 2025-10-26
 */
