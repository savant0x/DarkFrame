/**
 * 🛡️ Edge-Compatible Authentication Utilities for Middleware
 * 
 * Created: 2025-01-17 20:00:00
 * Updated: 2025-10-17 (FID-20251017-005: Migrated to jose for Edge Runtime)
 * 
 * OVERVIEW:
 * Edge Runtime-compatible authentication functions for Next.js middleware.
 * Uses jose library (pure JS, Edge-compatible) instead of jsonwebtoken.
 * Does NOT import bcrypt (Node.js native module incompatible with Edge).
 * Only handles JWT verification and cookie parsing.
 * 
 * Related: /lib/authService.ts (full auth with bcrypt for API routes)
 */

import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/jwt';

const JWT_SECRET = process.env.JWT_SECRET || 'darkframe-secret-change-in-production';
// FID-20260904-005 §5.0: cookie name now sourced from lib/jwt (single source of truth).
const COOKIE_NAME = SESSION_COOKIE_NAME;

export interface TokenPayload {
  username: string;
  email: string;
  rank?: number;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Get authentication cookie value
 * Edge-compatible cookie retrieval
 * 
 * @returns Cookie value or null if not found
 */
export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Verify JWT token and return payload
 * Edge-compatible JWT verification using jose library
 * 
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    // Convert JWT_SECRET to Uint8Array for jose
    const secret = new TextEncoder().encode(JWT_SECRET);
    
    // Verify JWT using jose (Edge Runtime compatible)
    const { payload } = await jwtVerify(token, secret);
    
    // Type assertion: jose returns JWTPayload, we know it's TokenPayload
    return payload as unknown as TokenPayload;
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return null;
  }
}

/**
 * Get authenticated user from cookie
 * Edge-compatible user authentication check
 * 
 * @returns User payload or null if not authenticated
 * 
 * @example
 * const user = await getAuthenticatedUser();
 * if (!user) {
 *   return NextResponse.redirect('/login');
 * }
 */
export async function getAuthenticatedUser(): Promise<TokenPayload | null> {
  try {
    const token = await getAuthCookie();
    
    if (!token) {
      return null;
    }
    
    // verifyToken is now async (jose requirement)
    const payload = await verifyToken(token);
    return payload;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return null;
  }
}

/**
 * Verify authentication (alias for getAuthenticatedUser)
 * Provided for backward compatibility with existing API routes
 */
export const verifyAuth = getAuthenticatedUser;

// ============================================================
// API ROUTE AUTH HELPERS (Added 2025-10-23)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, clans } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export interface AuthResult {
  username: string;
  playerId: string;
  player: any;
  isAdmin: boolean;
}

/**
 * Authenticate request and return player data
 * Comprehensive auth helper for API routes
 * 
 * @param request - NextRequest object
 * @param cookieName - Name of the auth cookie (default: SESSION_COOKIE_NAME — the cookie login actually sets)
 * @returns AuthResult or null if authentication fails
 * 
 * @example
 * const auth = await authenticateRequest(request);
 * if (!auth) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * console.log(auth.username, auth.playerId, auth.isAdmin);
 */
export async function authenticateRequest(
  request: NextRequest,
  cookieName: string = SESSION_COOKIE_NAME
): Promise<AuthResult | null> {
  try {
    // Test-only bypass for integration tests without JWT
    if (process.env.NODE_ENV === 'test') {
      const testUser = request.headers.get('x-test-user');
      if (testUser) {
        const player = await db.select().from(players).where(eq(players.username, testUser)).limit(1);
        if (player.length > 0) {
          return {
            username: testUser,
            playerId: player[0].username,
            player: player[0],
            isAdmin: request.headers.get('x-test-admin') === 'true',
          };
        }
      }
    }

    // Extract token from cookies
    const token = request.cookies.get(cookieName)?.value;
    if (!token) {
      return null;
    }

    // Verify token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const username = payload.username as string;
    const isAdmin = (payload.isAdmin as boolean) || false;

    // Get player from database
    const playerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
    if (playerResult.length === 0) {
      return null;
    }

    const player = playerResult[0];

    return {
      username,
      playerId: player.username,
      player,
      isAdmin,
    };
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    return null;
  }
}

/**
 * Require authentication middleware
 * Returns 401 response if not authenticated
 * 
 * @param request - NextRequest object
 * @param cookieName - Name of the auth cookie (default: SESSION_COOKIE_NAME — the cookie login actually sets)
 * @returns AuthResult or NextResponse (401 error)
 * 
 * @example
 * const auth = await requireAuth(request);
 * if (auth instanceof NextResponse) return auth; // Return 401 error
 * // Continue with auth.username, auth.playerId, etc.
 */
export async function requireAuth(
  request: NextRequest,
  cookieName: string = SESSION_COOKIE_NAME
): Promise<AuthResult | NextResponse> {
  const auth = await authenticateRequest(request, cookieName);
  
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return auth;
}

/**
 * Require admin role middleware
 * Returns 401 if not authenticated, 403 if not admin
 * 
 * @param request - NextRequest object
 * @param cookieName - Name of the auth cookie (default: SESSION_COOKIE_NAME — the cookie login actually sets)
 * @returns AuthResult or NextResponse (401/403 error)
 * 
 * @example
 * const auth = await requireAdmin(request);
 * if (auth instanceof NextResponse) return auth; // Return error
 * // Continue with admin-only operations
 */
export async function requireAdmin(
  request: NextRequest,
  cookieName: string = SESSION_COOKIE_NAME
): Promise<AuthResult | NextResponse> {
  const auth = await requireAuth(request, cookieName);
  
  if (auth instanceof NextResponse) {
    return auth; // Return 401 error
  }
  
  if (!auth.isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }
  
  return auth;
}

/**
 * Get clan for authenticated player
 * Helper that combines auth + clan lookup
 * 
 * @param request - NextRequest object
 * @returns Object with auth and clan data, or NextResponse (error)
 * 
 * @example
 * const result = await requireClanMembership(request);
 * if (result instanceof NextResponse) return result;
 * const { auth, clan, clanId } = result;
 */
export async function requireClanMembership(
  request: NextRequest
): Promise<{ auth: AuthResult; clan: any; clanId: string } | NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth;
  }
  
  // Find clan by playerId - clans.members is a JSON column, need to check if playerId is in it
  const clanResult = await db.select().from(clans).where(sql`JSON_CONTAINS(${clans.members}, JSON_ARRAY(${auth.playerId}))`).limit(1);
  
  if (clanResult.length === 0) {
    return NextResponse.json(
      { success: false, error: 'You are not in a clan' },
      { status: 400 }
    );
  }
  
  const clan = clanResult[0];
  
  return {
    auth,
    clan,
    clanId: clan.id,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Updated: 2025-10-23 (FID-20251023-001: Added API route auth helpers)
 * 
 * Edge Runtime Compatibility:
 * - NO bcrypt imports (native Node.js module)
 * - NO jsonwebtoken imports (has native dependencies via node-gyp-build)
 * - NO fs/path imports (file system not available in Edge)
 * - Uses Next.js cookies() API (Edge-compatible)
 * - Uses jose library (pure JavaScript, fully Edge-compatible)
 * 
 * API Route Helpers (Added 2025-10-23):
 * - authenticateRequest(): Get auth data from request + DB
 * - requireAuth(): Return 401 if not authenticated
 * - requireAdmin(): Return 401/403 if not admin
 * - requireClanMembership(): Return error if not in clan
 * 
 * Why jose Instead of jsonwebtoken?
 * - jsonwebtoken has native module dependencies (node-gyp-build → bcrypt chain)
 * - jose is built specifically for Edge Runtime and Web Crypto API
 * - jose is async-first, more secure, and follows modern standards
 * - jose is the recommended JWT library for Next.js middleware
 * 
 * Why Separate File?
 * - authService.ts uses jsonwebtoken for token generation (Node.js runtime)
 * - Middleware runs in Edge Runtime (no native modules allowed)
 * - This file provides Edge-compatible subset of auth functions
 * - Both files use same JWT_SECRET for consistency
 * 
 * Security:
 * - JWT signature verification prevents tampering
 * - Same JWT_SECRET as authService.ts ensures token compatibility
 * - Automatic expiration handling via JWT exp claim
 * - HTTP-only cookie not accessible via client JavaScript
 * - jose provides more robust crypto than jsonwebtoken
 * 
 * Migration Notes (FID-20251017-005):
 * - Migrated from jsonwebtoken to jose on 2025-10-17
 * - Reason: Edge Runtime incompatibility with native modules
 * - verifyToken() changed from sync to async (jose requirement)
 * - No breaking changes to middleware.ts (already async)
 * 
 * Deduplication Notes (FID-20251023-001):
 * - Added comprehensive API route helpers on 2025-10-23
 * - Consolidates auth patterns from 50+ API routes
 * - Reduces duplicate code by ~500+ lines across codebase
 * - Standardizes error responses (401, 403)
 * 
 * Related Files:
 * - /lib/authService.ts - Full auth with bcrypt (API routes)
 * - /middleware.ts - Protected route authentication (uses this file)
 * - /app/api/auth/login/route.ts - Login endpoint (uses authService.ts)
 * - /app/api/auth/logout/route.ts - Logout endpoint (uses authService.ts)
 * - /app/api/clan/** - Clan routes (should use requireClanMembership)
 * - /app/api/admin/** - Admin routes (should use requireAdmin)
 */

