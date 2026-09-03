/**
 * @file app/api/debug/tile/route.ts
 * @created 2025-10-18
 * @overview Debug endpoint to inspect specific tile data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { Tile } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    
    if (!user || user.username !== 'FAME') {
      return NextResponse.json(
        { success: false, error: 'Admin only' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const x = parseInt(searchParams.get('x') || '0');
    const y = parseInt(searchParams.get('y') || '0');
    
    const tilesCollection = await getCollection<Tile>('tiles');
    const tile = await tilesCollection.findOne({ x, y });
    
    return NextResponse.json({ 
      success: true, 
      tile 
    });
    
  } catch (error) {
    console.error('Debug tile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tile' },
      { status: 500 }
    );
  }
}
