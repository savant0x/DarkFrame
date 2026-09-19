/**
 * @file app/api/player/greeting/route.ts
 * @created 2025-10-18
 * @rewritten 2026-09-18 (FID-20260917-017 slice 3: Mongo shim → direct drizzle/pg)
 * @overview Base greeting update API endpoint
 *
 * OVERVIEW:
 * Allows players to set/update their base greeting message.
 *
 * PERSISTENCE (PostgreSQL): base_greeting varchar(500) on `players`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/connection';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logger as structuredLogger } from '@/lib/logger';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

/**
 * POST /api/player/greeting
 *
 * Update player's base greeting
 * Body: { greeting: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user from cookie
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const username = user.username;

    // Parse request body
    const body = await request.json();
    const { greeting } = body;

    // Validate greeting
    if (typeof greeting !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid greeting format' },
        { status: 400 }
      );
    }

    // Trim and limit length
    const sanitizedGreeting = greeting.trim().slice(0, 500);

    // Update player's base greeting (honest affected-row count — the
    // shim's updateOne counted MATCHED rows; returning() counts exactly
    // what the UPDATE touched, so an unknown user 404s as before).
    const updated = await db
      .update(players)
      .set({ baseGreeting: sanitizedGreeting })
      .where(eq(players.username, username))
      .returning({ username: players.username });

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    structuredLogger.info('Base greeting updated', { username });

    return NextResponse.json({
      success: true,
      data: { greeting: sanitizedGreeting }
    });

  } catch (error) {
    console.error('❌ Error updating greeting:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update greeting' },
      { status: 500 }
    );
  }
}

// ============================================================
// END OF FILE
// ============================================================
