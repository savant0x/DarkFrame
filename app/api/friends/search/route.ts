/**
 * @file app/api/friends/search/route.ts
 * @created 2025-10-26
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Friend Search API endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchUsers } from '@/lib/friendService';
import { ValidationError } from '@/lib/common/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get('username');
    if (!userId) return NextResponse.json({ success: false, error: 'Username parameter required' }, { status: 400 });
    const query = searchParams.get('q');
    const limitParam = searchParams.get('limit');

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Search query parameter "q" is required' }, { status: 400 });
    }

    if (query.length > 50) {
      return NextResponse.json({ success: false, error: 'Search query must be 50 characters or fewer' }, { status: 400 });
    }

    let limit = 20;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        return NextResponse.json({ success: false, error: 'limit must be a number between 1 and 50' }, { status: 400 });
      }
      limit = parsedLimit;
    }

    const results = await searchUsers(userId, query, limit);

    return NextResponse.json({ success: true, results });

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error('Unexpected error in GET /api/friends/search:', error);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred while searching users' }, { status: 500 });
  }
}
