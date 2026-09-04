/**
 * @file app/api/factory/attack/route.ts
 * @overview Factory attack endpoint - R key action.
 * Session-authenticated: the attacker is resolved from the JWT, never from the
 * body (the body `username` allowed attacking as another player). Presence is
 * enforced server-side against the DB position: you must be standing on the
 * factory tile to attack it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { attackFactory } from '@/lib/factoryService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { verifyPresence } from '@/lib/presenceCheck';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { x, y } = await request.json();

    if (x === undefined || y === undefined) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: x, y' },
        { status: 400 }
      );
    }

    // Convert coordinates to numbers to ensure database consistency
    const xNum = typeof x === 'number' ? x : parseInt(x, 10);
    const yNum = typeof y === 'number' ? y : parseInt(y, 10);
    if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) {
      return NextResponse.json(
        { success: false, message: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Presence: attacker must be standing on the factory tile (DB position, not client claim)
    const presence = await verifyPresence(auth.username, { x: xNum, y: yNum });
    if (!presence.ok) {
      return NextResponse.json(
        { success: false, message: presence.reason },
        { status: 403 }
      );
    }

    const result = await attackFactory(auth.username, xNum, yNum);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Factory attack error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// END OF FILE
// ============================================================
