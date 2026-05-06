/**
 * @file lib/middleware/requestLogger.ts
 * @created 2025-01-23 (FID-20251023-003: Phase 3.1 Request Logging Middleware)
 * @overview Automatic request/response logging for API routes
 * 
 * OVERVIEW:
 * Middleware for automatic logging of all API requests and responses.
 * Generates request IDs, tracks execution time, and logs payloads in dev mode.
 * 
 * FEATURES:
 * - Automatic request ID generation and propagation
 * - Execution time tracking
 * - Request/response payload logging (dev only)
 * - Error tracking and correlation
 * - User context when authenticated
 * 
 * USAGE:
 * import { withRequestLogging } from '@/lib/middleware/requestLogger';
 * 
 * export const GET = withRequestLogging(async (request) => {
 *   // Your handler code
 *   return NextResponse.json({ data });
 * });
 */

/* diagnostics-refresh: touched file to force VS Code diagnostics refresh */

import { NextRequest, NextResponse } from 'next/server';
import {
  createLogger,
  generateRequestId,
  setRequestContext,
  getRequestIdFromHeaders,
} from '../logger/productionLogger';

/**
 * API route handler type
 */
type RouteHandler = (
  request: NextRequest,
  context?: { params: any }
) => Promise<NextResponse> | NextResponse;

/**
 * Logger instance for request middleware
 */
const logger = createLogger({ context: 'RequestLogger' });

/**
 * Extract user ID from request (if authenticated)
 */
async function extractUserId(request: NextRequest): Promise<string | undefined> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return undefined;

    // Basic extraction - enhance with actual JWT parsing if needed
    const token = authHeader.replace('Bearer ', '');
    if (!token) return undefined;

    // For now, we'll add this after we have JWT utilities available
    // const decoded = await verifyToken(token);
    // return decoded.userId;

    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Sanitize request body for logging (remove sensitive fields)
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Log request details
 */
function isNoisyPath(path: string): boolean {
  return path.startsWith('/api/tutorial') || path.startsWith('/api/flag') ||
      path.startsWith('/api/chat/typing') || path.startsWith('/api/chat/online') ||
      path.startsWith('/api/chat/heartbeat') || path.includes('channelId=global') ||
      path.startsWith('/api/combat/logs') || path.startsWith('/api/wmd/status') ||
      path.startsWith('/api/bot-scanner') || path.startsWith('/api/admin/hotkeys') ||
      path.startsWith('/api/auth/session') || path.startsWith('/api/assets/images') ||
      path.startsWith('/api/player/inventory') || path.startsWith('/api/admin/wmd') ||
      path.startsWith('/api/admin/analytics') || path.startsWith('/api/admin/vip') ||
      path.startsWith('/api/admin/beer-bases') || path.startsWith('/api/admin/bot-config') ||
      path.startsWith('/api/admin/bot-stats') || path.startsWith('/api/admin/players') ||
      path.startsWith('/api/admin/anti-cheat');
}

async function logRequest(
  request: NextRequest,
  requestId: string
): Promise<void> {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname + url.search;

  if (isNoisyPath(path)) return;

  // Log basic request
  logger.info(`→ ${method} ${path}`, {
    requestId,
    method,
    path,
    userAgent: request.headers.get('user-agent'),
  });

  // In development, log request body
  if (process.env.NODE_ENV === 'development') {
    try {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        // CRITICAL: Clone request before reading body to avoid consuming the original stream
        const clonedRequest = request.clone();
        const body = await clonedRequest.json();
        logger.debug('Request body', {
          requestId,
          body: sanitizeBody(body),
        });
      }
    } catch (error) {
      // Body already consumed or not JSON
    }
  }
}

/**
 * Log response details
 */
function logResponse(
  request: NextRequest,
  response: NextResponse,
  requestId: string,
  duration: number
): void {
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  const status = response.status;

  if (isNoisyPath(path)) return;

  // Determine log level based on status code and log response
  if (status >= 500) {
    logger.error(`← ${method} ${path} ${status}`, undefined, {
      requestId,
      method,
      path,
      status,
      duration: Math.round(duration),
    });
  } else if (status >= 400) {
    logger.warn(`← ${method} ${path} ${status}`, {
      requestId,
      method,
      path,
      status,
      duration: Math.round(duration),
    });
  } else {
    logger.info(`← ${method} ${path} ${status}`, {
      requestId,
      method,
      path,
      status,
      duration: Math.round(duration),
    });
  }
}

/**
 * Wrap route handler with request logging
 * 
 * @param handler - The Next.js route handler to wrap
 * @returns Wrapped handler with automatic logging
 * 
 * @example
 * ```typescript
 * export const GET = withRequestLogging(async (request) => {
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withRequestLogging(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: { params: any }) => {
    const startTime = performance.now();
    
    // Generate or extract request ID
    const requestId = getRequestIdFromHeaders(request.headers);
    
    // Extract user ID if authenticated
    const userId = await extractUserId(request);
    
    // Set request context for async operations
    setRequestContext({
      requestId,
      userId,
      timestamp: Date.now(),
    });

    // Log incoming request
    await logRequest(request, requestId);

    try {
      // Execute handler
      const response = await handler(request, context);
      
      // Calculate duration
      const duration = performance.now() - startTime;
      
      // Log successful response
      logResponse(request, response, requestId, duration);
      
      // Add request ID to response headers
      response.headers.set('x-request-id', requestId);
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      const method = request.method;
      const url = new URL(request.url);
      const path = url.pathname + url.search;

      // Log error with additional context
      logger.error(
        `✗ ${method} ${path}`, 
        error as Error, 
        {
          method,
          path,
          duration: Math.round(duration),
        }
      );

      // Re-throw to let Next.js handle it
      throw error;
    }
  };
}

/**
 * Create a scoped logger for a specific API route
 * Includes request context automatically
 * 
 * @param context - The context name (e.g., 'PlayerAPI')
 * @returns Logger instance with request context
 * 
 * @example
 * ```typescript
 * export const GET = withRequestLogging(async (request) => {
 *   const log = createRouteLogger('PlayerAPI');
 *   log.info('Fetching player data');
 *   // ...
 * });
 * ```
 */
export function createRouteLogger(context: string) {
  return createLogger({ context });
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
//
// Usage Pattern:
// 1. Wrap route handlers with withRequestLogging()
// 2. Use createRouteLogger() for additional logging within handler
// 3. Request ID automatically propagates to all logs
//
// Example:
// ```typescript
// // app/api/player/stats/route.ts
// import { withRequestLogging, createRouteLogger } from '@/lib/middleware/requestLogger';
// import { getPlayerStats } from '@/lib/services/playerService';
//
// export const GET = withRequestLogging(async (request) => {
//   const log = createRouteLogger('PlayerStatsAPI');
//   
//   try {
//     log.debug('Fetching player stats');
//     const stats = await getPlayerStats();
//     log.info('Stats retrieved successfully');
//     return NextResponse.json(stats);
//   } catch (error) {
//     log.error('Failed to fetch stats', error as Error);
//     return NextResponse.json(
//       { error: 'Failed to retrieve stats' },
//       { status: 500 }
//     );
//   }
// });
// ```
//
// Benefits:
// - Automatic request/response logging
// - Request ID correlation across all logs
// - Performance tracking
// - Error tracking with context
// - Zero boilerplate in route handlers
//
// Future Enhancements:
// - Rate limiting integration
// - Request size limits
// - Suspicious pattern detection
// - Performance alerts (slow requests)
//
// ============================================================================
