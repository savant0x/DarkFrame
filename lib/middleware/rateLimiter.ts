/**
 * @file lib/middleware/rateLimiter.ts
 * @created 2025-10-23 (FID-20251023-005: Rate Limiting Middleware)
 * @overview In-memory rate limiting for API endpoints
 * 
 * OVERVIEW:
 * Simple yet effective rate limiting using in-memory store.
 * Tracks requests per IP address and user ID with configurable windows.
 * 
 * FEATURES:
 * - Sliding window rate limiting
 * - Per-IP and per-user tracking
 * - Configurable limits and windows
 * - Automatic cleanup of old entries
 * - Integration with logging system
 * 
 * USAGE:
 * import { withRateLimit, createRateLimiter } from '@/lib';
 * 
 * // Use preset limiter
 * export const POST = withRateLimit('strict')(async (request) => {
 *   // Your handler
 * });
 * 
 * // Custom limiter
 * const customLimiter = createRateLimiter({ maxRequests: 100, windowMs: 60000 });
 * export const GET = customLimiter(async (request) => {
 *   // Your handler
 * });
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '../logger/productionLogger';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum requests allowed in the time window
   */
  maxRequests: number;
  
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  
  /**
   * Custom message for rate limit errors
   */
  message?: string;
  
  /**
   * Whether to include user ID in rate limiting (requires auth)
   */
  trackByUser?: boolean;
  
  /**
   * Skip rate limiting for specific IPs (e.g., localhost)
   */
  skipIPs?: string[];
}

/**
 * Request record for tracking
 */
interface RequestRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory store for rate limiting
 */
const requestStore = new Map<string, RequestRecord>();

/**
 * Logger instance
 */
const logger = createLogger({ context: 'RateLimiter' });

/**
 * Cleanup interval (every 5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Preset rate limit configurations
 */
export const RATE_LIMIT_PRESETS = {
  /**
   * Very strict: 10 requests per minute
   * Use for: Authentication, admin actions
   */
  strict: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    message: 'Too many requests. Please wait a minute before trying again.'
  },
  
  /**
   * Standard: 100 requests per minute
   * Use for: Most API endpoints
   */
  standard: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded. Please slow down your requests.'
  },
  
  /**
   * Relaxed: 500 requests per minute
   * Use for: Read-only endpoints, public data
   */
  relaxed: {
    maxRequests: 500,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded. Please try again shortly.'
  },
  
  /**
   * Per-user: 1000 requests per hour per user
   * Use for: Authenticated user-specific actions
   */
  perUser: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'You have exceeded your hourly request limit.'
  }
} as const;

/**
 * Extract client IP from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp.trim();
  }
  
  return 'unknown';
}

/**
 * Extract user ID from request (if authenticated)
 */
async function getUserId(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    // Basic extraction - enhance with actual JWT parsing if needed
    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;

    // For now, return null - can be enhanced with JWT verification
    // const decoded = await verifyToken(token);
    // return decoded.userId;
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Generate rate limit key
 */
function generateKey(ip: string, userId: string | null, trackByUser: boolean): string {
  if (trackByUser && userId) {
    return `user:${userId}`;
  }
  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 */
function shouldRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = requestStore.get(key);

  // No record or window expired
  if (!record || now >= record.resetTime) {
    const newResetTime = now + windowMs;
    requestStore.set(key, { count: 1, resetTime: newResetTime });
    return { limited: false, remaining: maxRequests - 1, resetTime: newResetTime };
  }

  // Increment counter
  record.count++;
  requestStore.set(key, record);

  const remaining = Math.max(0, maxRequests - record.count);
  const limited = record.count > maxRequests;

  return { limited, remaining, resetTime: record.resetTime };
}

/**
 * Periodic cleanup of expired entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of requestStore.entries()) {
    if (now >= record.resetTime) {
      requestStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Cleaned up expired rate limit entries', { count: cleaned, totalRemaining: requestStore.size });
  }
}

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
}

/**
 * Route handler type
 */
type RouteHandler = (
  request: NextRequest,
  context?: { params: any }
) => Promise<NextResponse> | NextResponse;

/**
 * Create rate limiter middleware
 * 
 * @param config - Rate limit configuration
 * @returns Middleware function
 * 
 * @example
 * ```typescript
 * const limiter = createRateLimiter({ maxRequests: 50, windowMs: 60000 });
 * export const POST = limiter(async (request) => {
 *   // Handler code
 * });
 * ```
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    message = 'Rate limit exceeded. Please try again later.',
    trackByUser = false,
    skipIPs = ['127.0.0.1', '::1', 'localhost']
  } = config;

  return (handler: RouteHandler): RouteHandler => {
    return async (request: NextRequest, context?: { params: any }) => {
      const ip = getClientIP(request);

      // Skip rate limiting for whitelisted IPs
      if (skipIPs.includes(ip)) {
        return handler(request, context);
      }

      // Get user ID if tracking by user
      const userId = trackByUser ? await getUserId(request) : null;

      // Generate key
      const key = generateKey(ip, userId, trackByUser);

      // Check rate limit
      const { limited, remaining, resetTime } = shouldRateLimit(key, maxRequests, windowMs);

      // Log rate limit check
      logger.debug('Rate limit check', {
        key,
        limited,
        remaining,
        maxRequests,
        windowMs: `${windowMs}ms`
      });

      // If limited, return 429 error
      if (limited) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        
        logger.warn('Rate limit exceeded', {
          key,
          ip,
          userId,
          maxRequests,
          windowMs: `${windowMs}ms`,
          retryAfter: `${retryAfter}s`
        });

        const response = NextResponse.json(
          {
            success: false,
            error: message,
            retryAfter
          },
          { status: 429 }
        );

        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', '0');
        response.headers.set('X-RateLimit-Reset', resetTime.toString());
        response.headers.set('Retry-After', retryAfter.toString());

        return response;
      }

      // Execute handler
      const response = await handler(request, context);

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', resetTime.toString());

      return response;
    };
  };
}

/**
 * Convenience function for preset rate limiters
 * 
 * @param preset - Preset name
 * @returns Rate limiter middleware
 * 
 * @example
 * ```typescript
 * export const POST = withRateLimit('strict')(async (request) => {
 *   // Handler code
 * });
 * ```
 */
export function withRateLimit(preset: keyof typeof RATE_LIMIT_PRESETS) {
  return createRateLimiter(RATE_LIMIT_PRESETS[preset]);
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getRateLimitStats() {
  return {
    totalKeys: requestStore.size,
    entries: Array.from(requestStore.entries()).map(([key, record]) => ({
      key,
      count: record.count,
      resetTime: new Date(record.resetTime).toISOString()
    }))
  };
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
//
// Usage Patterns:
//
// 1. Strict Rate Limiting (Auth endpoints):
// ```typescript
// export const POST = withRateLimit('strict')(async (request) => {
//   // Login/register logic
// });
// ```
//
// 2. Standard Rate Limiting (Most endpoints):
// ```typescript
// export const GET = withRateLimit('standard')(async (request) => {
//   // API logic
// });
// ```
//
// 3. Custom Rate Limiting:
// ```typescript
// const customLimiter = createRateLimiter({
//   maxRequests: 5,
//   windowMs: 10 * 60 * 1000, // 10 minutes
//   message: 'Custom rate limit message',
//   trackByUser: true
// });
//
// export const POST = customLimiter(async (request) => {
//   // Handler logic
// });
// ```
//
// 4. Combining with Request Logging:
// ```typescript
// import { withRequestLogging, withRateLimit } from '@/lib';
//
// export const POST = withRateLimit('strict')(
//   withRequestLogging(async (request) => {
//     // Handler logic
//   })
// );
// ```
//
// Response Headers:
// - X-RateLimit-Limit: Maximum requests allowed
// - X-RateLimit-Remaining: Requests remaining in window
// - X-RateLimit-Reset: Unix timestamp when window resets
// - Retry-After: Seconds until retry (only on 429 errors)
//
// Limitations:
// - In-memory store (resets on server restart)
// - Not suitable for multi-instance deployments without shared store
// - Consider Redis for production multi-instance setups
//
// Future Enhancements:
// - Redis backend for distributed rate limiting
// - Different limits for authenticated vs anonymous users
// - Burst allowance (token bucket algorithm)
// - Dynamic rate limits based on user tier
// - Rate limit bypass for admin users
// - Prometheus metrics export
//
// ============================================================================
