/**
 * Conversations API Route
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * API endpoint for fetching player conversations.
 * 
 * ENDPOINT:
 * GET /api/messages/conversations?playerId={id}&limit={n}&sortBy={type}
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConversations } from '@/lib/messagingService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const includeArchived = searchParams.get('includeArchived');
    const sortBy = searchParams.get('sortBy') as 'recent' | 'unread' | 'pinned' | undefined;

    if (!playerId) {
      return NextResponse.json(
        { success: false, error: 'playerId is required' },
        { status: 400 }
      );
    }

    const result = await getConversations({
      playerId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      includeArchived: includeArchived === 'true',
      sortBy,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/messages/conversations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
