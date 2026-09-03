/**
 * @file app/api/auth/logout/route.ts
 * @created 2025-10-16
 * @updated 2025-01-17 - Consolidated to use authService.ts
 * @overview Logout endpoint to clear authentication cookie
 * 
 * Part of FID-20251017-004: Cookie-Based Authentication System.
 * Uses consolidated authService.ts for cookie management.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { clearAuthCookie } from '@/lib/authService';
import { endSession } from '@/lib/sessionTracker';
import { logActivity } from '@/lib/activityLogger';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.AUTH);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('LogoutAPI');
  const endTimer = log.time('logout');
  
  try {
    // Get user before clearing cookie
    const user = await getAuthenticatedUser();
    const sessionId = request.cookies.get('sessionId')?.value;
    
    // Log logout activity
    if (user && sessionId) {
      await logActivity({
        userId: user.username,
        action: 'logout',
        sessionId,
        metadata: { result: 'success' }
      });
      
      // End session tracking
      await endSession(sessionId);
    }
    
    // Clear the authentication cookie using consolidated authService
    await clearAuthCookie();
    
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
    
    // Clear session cookie
    response.cookies.delete('sessionId');
    
    // Clear playerId cookie
    response.cookies.delete('playerId');
    
    log.info('User logged out successfully', { username: user?.username });
    
    return response;
    
  } catch (error) {
    log.error('Logout error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
