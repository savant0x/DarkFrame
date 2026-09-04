/**
 * WebSocket Authentication Utilities
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * JWT-based authentication for Socket.io connections with dual strategy:
 * 1. Cookie-based (automatic, secure) - HTTP-only cookies from existing auth
 * 2. Token handshake (manual fallback) - For clients that can't send cookies
 * 
 * Security Features:
 * - JWT signature verification using jose library
 * - Token expiration validation
 * - User existence verification in database
 * - Rate limiting preparation hooks
 * 
 * Usage:
 * - Called during Socket.io connection handshake
 * - Attaches authenticated user data to socket instance
 * - Denies connection if authentication fails
 */

import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { players, clans } from '@/lib/db/schema';
import type { Socket } from 'socket.io';
import { eq } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedUser {
  userId: string;
  username: string;
  level: number;
  clanId?: string;
  clanName?: string;
  role?: string;
}

export interface AuthenticationResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}
import { JOSE_SECRET } from '@/lib/jwt';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Must match the session cookie set by lib/authService.ts and read by middleware.ts
const JWT_COOKIE_NAME = 'darkframe_session';

// ============================================================================
// COOKIE PARSER
// ============================================================================

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as Record<string, string>);
}

// ============================================================================
// JWT VERIFICATION
// ============================================================================

async function verifyJWT(token: string): Promise<{
  userId: string;
  username: string;
  iat: number;
  exp: number;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JOSE_SECRET);
    
    // Real tokens minted by lib/authService.generateToken carry { username, email, isAdmin }
    // — there is no userId claim. Require only username.
    if (!payload.username) {
      return null;
    }
    
    return {
      userId: (payload.userId as string) || (payload.username as string),
      username: payload.username as string,
      iat: payload.iat || 0,
      exp: payload.exp || 0,
    };
  } catch (error) {
    console.error('[WebSocket Auth] JWT verification failed:', error);
    return null;
  }
}

// ============================================================================
// USER DATA FETCHING
// ============================================================================

async function fetchUserData(userId: string): Promise<AuthenticatedUser | null> {
  try {
    const user = await db.query.players.findFirst({
      where: eq(players.username, userId),
      columns: {
        username: true,
        level: true,
        clanId: true,
        clanRole: true,
      }
    });
    
    if (!user) {
      return null;
    }
    
    let clanName: string | undefined;
    if (user.clanId) {
      const clan = await db.query.clans.findFirst({
        where: eq(clans.id, user.clanId),
        columns: { name: true }
      });
      clanName = clan?.name;
    }
    
    return {
      userId: user.username,
      username: user.username,
      level: user.level || 1,
      clanId: user.clanId || undefined,
      clanName,
      role: user.clanRole || undefined,
    };
  } catch (error) {
    console.error('[WebSocket Auth] Failed to fetch user data:', error);
    return null;
  }
}

// ============================================================================
// MAIN AUTHENTICATION FUNCTION
// ============================================================================

export async function authenticateSocket(
  socket: Socket
): Promise<AuthenticationResult> {
  try {
    let token: string | undefined;
    
    const cookies = parseCookies(socket.handshake.headers.cookie);
    token = cookies[JWT_COOKIE_NAME];
    
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token as string;
    }
    
    if (!token) {
      return {
        success: false,
        error: 'No authentication token provided',
      };
    }
    
    const jwtPayload = await verifyJWT(token);
    if (!jwtPayload) {
      return {
        success: false,
        error: 'Invalid or expired authentication token',
      };
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (jwtPayload.exp && jwtPayload.exp < now) {
      return {
        success: false,
        error: 'Authentication token has expired',
      };
    }
    
    const user = await fetchUserData(jwtPayload.userId);
    if (!user) {
      return {
        success: false,
        error: 'User not found or account disabled',
      };
    }
    
    return {
      success: true,
      user,
    };
    
  } catch (error) {
    console.error('[WebSocket Auth] Authentication error:', error);
    return {
      success: false,
      error: 'Internal authentication error',
    };
  }
}

// ============================================================================
// AUTHORIZATION HELPERS
// ============================================================================

export function isClanMember(user: AuthenticatedUser, clanId: string): boolean {
  return user.clanId === clanId;
}

export function isClanAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin' || user.role === 'officer';
}

export function isSystemAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin' || user.role === 'super_admin';
}

export function validateClanAction(
  user: AuthenticatedUser,
  clanId: string,
  requireAdmin: boolean = false
): { valid: boolean; error?: string } {
  if (!isClanMember(user, clanId)) {
    return {
      valid: false,
      error: 'User is not a member of this clan',
    };
  }
  
  if (requireAdmin && !isClanAdmin(user)) {
    return {
      valid: false,
      error: 'User does not have admin privileges in this clan',
    };
  }
  
  return { valid: true };
}
