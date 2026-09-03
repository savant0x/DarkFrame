/**
 * @file app/api/player/greeting/route.ts
 * @created 2025-10-18
 * @overview Base greeting update API endpoint
 * 
 * OVERVIEW:
 * Allows players to set/update their base greeting message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { Player } from '@/types';

/**
 * POST /api/player/greeting
 * 
 * Update player's base greeting
 * Body: { greeting: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user from cookie
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
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

    // Update player's base greeting
    const playersCollection = await getCollection<Player>('players');
    const result = await playersCollection.updateOne(
      { username },
      { $set: { baseGreeting: sanitizedGreeting } }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Updated base greeting for ${username}`);

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
