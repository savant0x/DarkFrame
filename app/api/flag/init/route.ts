/**
 * @file app/api/flag/init/route.ts
 * @created 2025-10-23
 * @overview Flag System Initialization Endpoint
 * 
 * OVERVIEW:
 * Ensures the flag system is initialized with a flag bot if no flag holder exists.
 * Should be called on application startup to guarantee there's always a flag bearer.
 * 
 * Endpoints:
 * - POST /api/flag/init - Initialize flag system if needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeFlagSystem } from '@/lib/flagBotService';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS 
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_INIT);

/**
 * POST /api/flag/init
 * 
 * Initialize flag system with first flag bot if needed
 * 
 * @returns Success message
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  const log = createRouteLogger('flag-init');
  const endTimer = log.time('flag-init');
  
  try {
    await initializeFlagSystem();
    
    endTimer();
    
    return NextResponse.json({
      success: true,
      message: 'Flag system initialized successfully'
    });
  } catch (error) {
    log.error('Error initializing flag system:', error instanceof Error ? error : new Error(String(error)));
    endTimer();
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize flag system'
      },
      { status: 500 }
    );
  }
}));
