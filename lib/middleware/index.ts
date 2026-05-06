/**
 * @file lib/middleware/index.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-001: Full ECHO Architecture Compliance)
 * @overview Middleware Services - Barrel Export
 * 
 * OVERVIEW:
 * Central export point for all middleware utilities including request logging,
 * activity tracking, rate limiting, and rate limit configuration.
 * 
 * Usage:
 * ```typescript
 * import { withRequestLogging, withRateLimit, logActivity } from '@/lib/middleware';
 * ```
 */

// ============================================================================
// MIDDLEWARE SERVICES
// ============================================================================

// Request logging middleware (HTTP request/response logging)
export * from './requestLogger';

// Activity logging (user action tracking)
export * from './activityLogger';

// Rate limiting middleware (request throttling)
export * from './rateLimiter';

// Rate limit configuration (endpoint-specific limits)
export * from './rateLimitConfig';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Middleware Usage:
 * 
 * 1. Request Logging:
 * ```typescript
 * import { withRequestLogging } from '@/lib/middleware';
 * 
 * export async function GET(request: Request) {
 *   return withRequestLogging(request, async () => {
 *     // Your route logic
 *   });
 * }
 * ```
 * 
 * 2. Rate Limiting:
 * ```typescript
 * import { withRateLimit, ENDPOINT_RATE_LIMITS } from '@/lib/middleware';
 * 
 * export async function POST(request: Request) {
 *   return withRateLimit(request, ENDPOINT_RATE_LIMITS.api.clan.chat, async () => {
 *     // Your route logic
 *   });
 * }
 * ```
 * 
 * 3. Activity Logging:
 * ```typescript
 * import { logActivity } from '@/lib/middleware';
 * 
 * await logActivity({
 *   userId,
 *   action: 'BATTLE_INITIATED',
 *   category: 'COMBAT',
 *   metadata: { targetId, outcome }
 * });
 * ```
 * 
 * Middleware Chain:
 * - Request → requestLogger (logs request) → rateLimiter (throttles) → route handler → activityLogger (logs action)
 * 
 * Performance:
 * - Request logging should be fast (< 5ms overhead)
 * - Rate limiting uses in-memory cache (Redis recommended for production)
 * - Activity logging uses MongoDB (async, non-blocking)
 */

// ============================================================================
// END OF FILE
// ============================================================================
