/**
 * @file lib/wmd/apiHelpers.ts
 * @created 2025-10-22
 * @overview WMD API Helper Functions
 * 
 * OVERVIEW:
 * Shared helper functions for WMD API routes including authentication,
 * database connection, and error handling.
 * 
 * Features:
 * - JWT authentication verification
 * - Drizzle ORM database queries
 * - Standardized error responses
 */

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key'
);

/**
 * Extract and verify JWT from cookies
 * Returns username if valid, null if invalid
 */
export async function verifyAuth(request: NextRequest): Promise<string | null> {
  try {
    // Read the real session cookie. This helper historically looked for a
    // cookie named 'auth-token', which no route ever sets (login sets
    // 'darkframe_session') — so every WMD feature returned AUTH_UNAUTHORIZED
    // for all logged-in users and the entire system was unreachable.
    const token =
      request.cookies.get('darkframe_session')?.value ??
      request.cookies.get('auth-token')?.value; // legacy fallback
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.username as string;
  } catch {
    return null;
  }
}

/**
 * Get authenticated player from database
 * Returns player document or null if not found/unauthorized
 */
export async function getAuthenticatedPlayer(
  request: NextRequest,
): Promise<{ username: string; playerId: string; player: typeof players.$inferSelect } | null> {
  const username = await verifyAuth(request);
  if (!username) return null;

  const playerRow = await db.select().from(players).where(eq(players.username, username)).limit(1);
  const player = playerRow[0];
  if (!player) return null;

  return {
    username,
    playerId: player.username,
    player,
  };
}
