/**
 * Activity Logging Middleware
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Automatic activity logging middleware for Next.js API routes.
 * Captures all player actions with minimal performance impact.
 * Provides transparent logging without modifying route logic.
 * 
 * Features:
 * - Automatic action detection from route paths
 * - Non-blocking logging (fire-and-forget)
 * - Request/response metadata capture
 * - Performance timing tracking
 * - Error logging with stack traces
 * - Security metadata (IP, User-Agent)
 * 
 * Usage:
 * Wrap API route handlers with withActivityLogging() or use as middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/authMiddleware';
import { logActivity } from '@/lib/activityLogService';
import { ActionType, ActionCategory, getActionCategory } from '@/types/activityLog.types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * API route handler type
 */
type RouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Logging configuration for specific routes
 */
interface LoggingConfig {
  enabled: boolean;
  actionType?: ActionType;
  category?: ActionCategory;
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;
}

// ============================================================================
// ROUTE MAPPING
// ============================================================================

/**
 * Map API route paths to action types
 * Enables automatic action detection from URLs
 */
const ROUTE_ACTION_MAP: Record<string, ActionType> = {
  // Auth routes
  '/api/auth/login': ActionType.LOGIN,
  '/api/auth/register': ActionType.REGISTER,
  '/api/auth/logout': ActionType.LOGOUT,
  
  // Movement routes
  '/api/move': ActionType.MOVE,
  
  // Resource routes
  '/api/harvest': ActionType.HARVEST_METAL, // Will be refined by request body
  '/api/forage': ActionType.FORAGE_CAVE, // Will be refined by request body
  
  // Combat routes
  '/api/attack': ActionType.ATTACK_PLAYER,
  '/api/factory/attack': ActionType.ATTACK_FACTORY,
  
  // Factory routes
  '/api/factory/claim': ActionType.FACTORY_CLAIM,
  '/api/factory/upgrade': ActionType.FACTORY_UPGRADE,
  '/api/factory/produce': ActionType.FACTORY_PRODUCE,
  '/api/factory/collect': ActionType.FACTORY_COLLECT,
  
  // Unit routes
  '/api/units/build': ActionType.UNIT_BUILD,
  '/api/units/disband': ActionType.UNIT_DISBAND,
  '/api/units/upgrade': ActionType.UNIT_UPGRADE,
  
  // Shrine routes
  '/api/shrine/visit': ActionType.SHRINE_VISIT,
  '/api/shrine/boost': ActionType.SHRINE_BOOST,
  
  // Discovery routes
  '/api/discovery/status': ActionType.DISCOVERY_VIEW,
  
  // Achievement routes
  '/api/achievements': ActionType.ACHIEVEMENT_VIEW,
  
  // Auction routes
  '/api/auction/create': ActionType.AUCTION_CREATE,
  '/api/auction/bid': ActionType.AUCTION_BID,
  '/api/auction/buyout': ActionType.AUCTION_BUYOUT,
  '/api/auction/cancel': ActionType.AUCTION_CANCEL,
  '/api/auction/collect': ActionType.AUCTION_COLLECT,
  
  // Bank routes
  '/api/bank/deposit': ActionType.BANK_DEPOSIT,
  '/api/bank/withdraw': ActionType.BANK_WITHDRAW,
  
  // Specialization routes
  '/api/specialization/select': ActionType.SPECIALIZATION_SELECT,
  '/api/specialization/respec': ActionType.SPECIALIZATION_RESPEC,
  
  // Clan routes (to be added)
  '/api/clan/create': ActionType.CLAN_CREATE,
  '/api/clan/join': ActionType.CLAN_JOIN,
  '/api/clan/leave': ActionType.CLAN_LEAVE,
  '/api/clan/invite': ActionType.CLAN_INVITE,
  '/api/clan/kick': ActionType.CLAN_KICK,
  '/api/clan/promote': ActionType.CLAN_PROMOTE,
  '/api/clan/research/contribute': ActionType.CLAN_RESEARCH,
  '/api/clan/territory/claim': ActionType.CLAN_TERRITORY_CLAIM,
  '/api/clan/warfare/declare': ActionType.CLAN_WAR_DECLARE,
  '/api/clan/monument/control': ActionType.CLAN_MONUMENT_CONTROL,
  
  // Admin routes (to be added)
  '/api/admin/players/ban': ActionType.ADMIN_BAN,
  '/api/admin/players/unban': ActionType.ADMIN_UNBAN,
  '/api/admin/players/modify': ActionType.ADMIN_RESOURCE_MODIFY,
  '/api/admin/logs/route': ActionType.ADMIN_VIEW_LOGS,
  '/api/admin/export': ActionType.ADMIN_EXPORT_DATA
};

/**
 * Routes that should NOT be logged (to avoid noise)
 */
const EXCLUDED_ROUTES = [
  '/api/logs', // Avoid recursive logging
  '/api/health',
  '/api/ping'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract player info from JWT token in request
 * 
 * @param req - Next.js request object
 * @returns Player ID and username if authenticated, null otherwise
 */
async function extractPlayerInfo(req: NextRequest): Promise<{
  playerId: string;
  username: string;
  sessionId?: string;
} | null> {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload) return null;
    
    // Note: We use username as playerId since that's the unique identifier
    // in the current auth system. In future, consider adding explicit userId to TokenPayload.
    return {
      playerId: payload.username, // Using username as player ID
      username: payload.username,
      sessionId: token.substring(0, 16) // Use token prefix as session ID
    };
  } catch (error) {
    return null;
  }
}

/**
 * Detect action type from request path and body
 * 
 * @param pathname - Request pathname
 * @param body - Request body (optional)
 * @returns Action type or undefined
 */
function detectActionType(pathname: string, body?: any): ActionType | undefined {
  // Try exact match first
  const exactMatch = ROUTE_ACTION_MAP[pathname];
  if (exactMatch) {
    // Refine based on request body if available
    if (pathname === '/api/harvest' && body) {
      if (body.tileType === 'energy') return ActionType.HARVEST_ENERGY;
      return ActionType.HARVEST_METAL;
    }
    if (pathname === '/api/forage' && body) {
      if (body.tileType === 'forest') return ActionType.FORAGE_FOREST;
      return ActionType.FORAGE_CAVE;
    }
    return exactMatch;
  }
  
  // Try pattern matching for dynamic routes
  if (pathname.startsWith('/api/admin/')) {
    return ActionType.ADMIN_VIEW_LOGS;
  }
  
  return undefined;
}

/**
 * Check if route should be logged
 * 
 * @param pathname - Request pathname
 * @returns True if route should be logged
 */
function shouldLogRoute(pathname: string): boolean {
  return !EXCLUDED_ROUTES.some(excluded => pathname.startsWith(excluded));
}

/**
 * Get client IP address from request
 * 
 * @param req - Next.js request object
 * @returns IP address
 */
function getClientIP(req: NextRequest): string {
  // Try various headers for IP (proxies, load balancers)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Sanitize request body for logging
 * Removes sensitive data (passwords, tokens, etc.)
 * 
 * @param body - Request body
 * @returns Sanitized body
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  delete sanitized.apiKey;
  
  return sanitized;
}

// ============================================================================
// MIDDLEWARE WRAPPER
// ============================================================================

/**
 * Wrap an API route handler with automatic activity logging
 * 
 * @param handler - Original route handler
 * @param config - Optional logging configuration
 * @returns Wrapped handler with logging
 * 
 * @example
 * export const POST = withActivityLogging(async (req: NextRequest) => {
 *   // Your route logic here
 *   return NextResponse.json({ success: true });
 * });
 */
export function withActivityLogging(
  handler: RouteHandler,
  config?: Partial<LoggingConfig>
): RouteHandler {
  return async (req: NextRequest, context?: any) => {
    const startTime = Date.now();
    const pathname = new URL(req.url).pathname;
    
    // Check if logging is enabled for this route
    const loggingEnabled = config?.enabled !== false && shouldLogRoute(pathname);
    
    // Extract player info
    const playerInfo = await extractPlayerInfo(req);
    
    // Parse request body if needed
    let requestBody: any;
    if (config?.captureRequestBody !== false && req.method !== 'GET') {
      try {
        // Clone request to avoid consuming body
        const clonedReq = req.clone();
        requestBody = await clonedReq.json().catch(() => null);
      } catch {
        requestBody = null;
      }
    }
    
    // Detect action type
    const actionType = config?.actionType || detectActionType(pathname, requestBody);
    
    let response: NextResponse;
    let success = true;
    let errorMessage: string | undefined;
    let errorCode: string | undefined;
    
    try {
      // Execute the original handler
      response = await handler(req, context);
      
      // Check if response indicates an error
      if (response.status >= 400) {
        success = false;
        try {
          const responseData = await response.clone().json();
          errorMessage = responseData.error || responseData.message || `HTTP ${response.status}`;
          errorCode = responseData.code || `HTTP_${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}`;
          errorCode = `HTTP_${response.status}`;
        }
      }
    } catch (error: unknown) {
      // Handler threw an error
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errorCode = error instanceof Error ? String((error as { code?: string }).code || 'HANDLER_ERROR') : 'HANDLER_ERROR';
      
      // Re-throw to maintain original error handling
      throw error;
    } finally {
      const executionTimeMs = Date.now() - startTime;
      
      // Log the activity (non-blocking)
      if (loggingEnabled && actionType && playerInfo) {
        // Fire-and-forget logging
        logActivity({
          playerId: playerInfo.playerId,
          username: playerInfo.username,
          actionType,
          category: config?.category || getActionCategory(actionType),
          timestamp: new Date(),
          details: sanitizeBody(requestBody) || {},
          success,
          errorMessage,
          errorCode,
          executionTimeMs,
          ipAddress: getClientIP(req),
          userAgent: req.headers.get('user-agent') || 'unknown',
          sessionId: playerInfo.sessionId
        }).catch(err => {
          // Silent fail - don't let logging errors crash the request
          console.error('[ActivityLogger] Failed to log activity:', err);
        });
      }
    }
    
    return response;
  };
}

/**
 * Manually log an activity from within a route handler
 * Useful for actions that can't be auto-detected
 * 
 * @param actionType - Type of action to log
 * @param req - Next.js request object
 * @param details - Additional action details
 * @param success - Whether action succeeded
 * @param errorMessage - Error message if failed
 * 
 * @example
 * await logActivityManual(
 *   ActionType.DISCOVERY_FOUND,
 *   req,
 *   { discoveryId: 'tech_metal_yield', category: 'industrial' },
 *   true
 * );
 */
export async function logActivityManual(
  actionType: ActionType,
  req: NextRequest,
  details: Record<string, any> = {},
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  try {
    const playerInfo = await extractPlayerInfo(req);
    if (!playerInfo) return;
    
    await logActivity({
      playerId: playerInfo.playerId,
      username: playerInfo.username,
      actionType,
      category: getActionCategory(actionType),
      timestamp: new Date(),
      details: sanitizeBody(details),
      success,
      errorMessage,
      executionTimeMs: 0, // Manual logs don't track execution time
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || 'unknown',
      sessionId: playerInfo.sessionId
    });
  } catch (error) {
    console.error('[ActivityLogger] Failed to manually log activity:', error);
  }
}

/**
 * Log a system event (no player context required)
 * 
 * @param actionType - Type of system action
 * @param details - Action details
 * @param success - Whether action succeeded
 * 
 * @example
 * await logSystemEvent(ActionType.ERROR, {
 *   errorType: 'database_connection',
 *   message: 'MongoDB connection failed'
 * }, false);
 */
export async function logSystemEvent(
  actionType: ActionType,
  details: Record<string, any> = {},
  success: boolean = true
): Promise<void> {
  try {
    await logActivity({
      playerId: 'system',
      username: 'system',
      actionType,
      category: ActionCategory.SYSTEM,
      timestamp: new Date(),
      details,
      success,
      executionTimeMs: 0,
      ipAddress: 'system',
      userAgent: 'system'
    });
  } catch (error) {
    console.error('[ActivityLogger] Failed to log system event:', error);
  }
}

/**
 * FOOTER:
 * 
 * Implementation Notes:
 * - Middleware uses fire-and-forget logging to avoid blocking requests
 * - Request body is cloned to avoid consuming the original stream
 * - Sensitive data (passwords, tokens) automatically sanitized
 * - Route mapping enables automatic action detection
 * - Manual logging functions available for custom actions
 * 
 * Performance Considerations:
 * - Logging errors are caught and logged but don't crash requests
 * - Body parsing is optional and can be disabled per route
 * - Token verification is cached per request
 * 
 * Security Notes:
 * - All sensitive fields removed before logging
 * - IP address and User-Agent captured for security auditing
 * - Admin actions logged separately with extended retention
 * 
 * Future Enhancements:
 * - Add rate limiting detection
 * - Implement anomaly detection for security alerts
 * - Add request/response correlation IDs
 * - Implement sampling for high-traffic routes
 */
