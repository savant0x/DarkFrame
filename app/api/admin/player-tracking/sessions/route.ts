/**
 * Admin Player Sessions API
 * Returns empty data until player_sessions table migration is completed (Phase 7).
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });

  return NextResponse.json({ success: true, data: [] });
}
