/**
 * @file app/api/auth/login/route.ts
 * @created 2025-10-16
 * @updated 2025-10-24 (Phase 2: Production infrastructure - validation, errors, rate limiting)
 * @overview Login endpoint with JWT authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerByEmail } from '@/lib/playerService';
import { getTileAt } from '@/lib/movementService';
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/authService';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  LoginSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { startSession } from '@/lib/sessionTracker';
import { logActivity } from '@/lib/activityLogger';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.login);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuthLogin');
  const endTimer = log.time('loginProcess');
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = LoginSchema.parse(body);
    const { email, password, rememberMe } = validated;
    
    log.debug('Login attempt', { email, rememberMe });
    
    // Get player by email
    const player = await getPlayerByEmail(email);
    if (!player) {
      log.warn('Login failed', { reason: 'user_not_found', email });
      return createErrorResponse(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }
    
    // Verify password
    const passwordValid = await verifyPassword(password, player.password);
    if (!passwordValid) {
      log.warn('Login failed', { reason: 'invalid_password', username: player.username });
      return createErrorResponse(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }
    
    // Generate JWT token with isAdmin flag
    const token = generateToken(player.username, player.email, rememberMe || false, player.isAdmin || false);
    
    // Set HTTP-only cookie
    await setAuthCookie(token, rememberMe || false);
    
    // Start session tracking
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const sessionId = await startSession(player.username, clientIp);
    
    // Log login activity
    await logActivity({
      userId: player.username,
      action: 'login',
      sessionId,
      metadata: { result: 'success' }
    });
    
    // Get current tile
    const currentTile = await getTileAt(
      player.currentPosition.x,
      player.currentPosition.y
    );
    
    // Remove password from response
    const { password: _, ...playerWithoutPassword } = player;
    
    log.info('Login successful', { 
      username: player.username, 
      rememberMe: rememberMe || false,
      isAdmin: player.isAdmin || false
    });
    
    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      data: {
        player: playerWithoutPassword,
        currentTile
      }
    });

    // Update lastActive timestamp on login
    try {
      const { getCollection } = await import('@/lib/mongodb');
      const playersCollection = await getCollection('players');
      await playersCollection.updateOne({ username: player.username }, { $set: { lastActive: new Date() } });
    } catch (err) {
      log.debug('Failed to update lastActive', { error: String(err) });
    }
    
    // Set session ID cookie for activity tracking
    response.cookies.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // 30 days or 24 hours
    });
    
    // Set playerId cookie for inventory and other endpoints
    response.cookies.set('playerId', player.username, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // 30 days or 24 hours
    });
    
    return response;
    
  } catch (error) {
    log.error('Login error', error as Error);
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    
    // Handle all other errors
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
