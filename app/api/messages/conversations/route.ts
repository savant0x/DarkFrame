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
import { getAuthenticatedUser } from '@/lib/authMiddleware';

export async function GET(request: NextRequest) {
  try {
    // FID-20260904-005 §5.1: the inbox is the SESSION user's inbox — the query
    // playerId (impersonation live-proven in the FID RED) is ignored.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const playerId = authUser.username;

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const includeArchived = searchParams.get('includeArchived');
    const sortBy = searchParams.get('sortBy') as 'recent' | 'unread' | 'pinned' | undefined;

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
