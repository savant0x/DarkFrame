/**
 * @file app/api/friends/requests/route.ts
 * @created 2025-10-26
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Friend Requests API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPendingRequests, getSentRequests } from '@/lib/friendService';
import { ValidationError } from '@/lib/common/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get('username');
    if (!userId) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });

    const [received, sent] = await Promise.all([
      getPendingRequests(userId),
      getSentRequests(userId),
    ]);

    return NextResponse.json({ success: true, received, sent });

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Unexpected error in GET /api/friends/requests:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while fetching friend requests' }, { status: 500 });
  }
}
