/**
 * @file app/api/debug/tile/route.ts
 * @created 2025-10-18
 * @overview Debug endpoint to inspect specific tile data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const username = searchParams.get('username');
    if (!username || username !== 'FAME') return NextResponse.json({ success: false, error: 'Admin only' }, { status: 403 });
    
    const x = parseInt(searchParams.get('x') || '0');
    const y = parseInt(searchParams.get('y') || '0');
    
    const supabase = createServiceClient();
    const { data: tile, error } = await supabase
      .from('tiles')
      .select('*')
      .eq('x', x)
      .eq('y', y)
      .single();
    
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
