/**
 * @file app/api/player/greeting/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Base greeting update API endpoint
 * 
 * OVERVIEW:
 * Allows players to set/update their base greeting message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/player/greeting
 * Update player's base greeting
 * Body: { username, greeting: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { greeting, username } = body;
    if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

    if (typeof greeting !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid greeting format' }, { status: 400 });
    }

    const sanitizedGreeting = greeting.trim().slice(0, 500);

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('players')
      .update({ base_greeting: sanitizedGreeting })
      .eq('username', username);

    if (error) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    console.log(`Updated base greeting for ${username}`);

    return NextResponse.json({ success: true, data: { greeting: sanitizedGreeting } });

  } catch (error) {
    console.error('Error updating greeting:', error);
    return NextResponse.json({ success: false, error: 'Failed to update greeting' }, { status: 500 });
  }
}
