/**
 * @file app/api/debug/tile/route.ts
 * @created 2025-10-18
 * @overview Debug endpoint to inspect specific tile data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { createRateLimiter, ENDPOINT_RATE_LIMITS, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = request.nextUrl;
    
    const x = parseInt(searchParams.get('x') || '0');
    const y = parseInt(searchParams.get('y') || '0');
    
    const supabase = createServiceClient();
    const { data: tile, error } = await supabase
      .from('tiles')
      .select('*')
      .eq('x', x)
      .eq('y', y)
      .maybeSingle();
    
    return NextResponse.json({ 
      success: true, 
      tile 
    });
    
  } catch (error) {
    logger.error('Debug tile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tile' },
      { status: 500 }
    );
  }
});
