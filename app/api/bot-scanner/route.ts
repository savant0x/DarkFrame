/**
 * Bot Scanner API - Scan for Bots Within Radius
 * Created: 2024-10-18
 * 
 * GET /api/bot-scanner?username=player
 * - Scans for bots within radius
 * - Returns bot list, nest locations, scanner status
 * - Applies cooldown after scan
 * 
 * GET /api/bot-scanner/status?username=player
 * - Returns scanner unlock status and cooldown info
 * - No cooldown applied (just checking status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanForBots, getScannerStatus } from '@/lib/botScannerService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('bot-scanner-get');
  const endTimer = log.time('bot-scanner-get');
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const action = searchParams.get('action');
    
    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');
    }
    
    // Status check (no cooldown applied)
    if (action === 'status') {
      const status = await getScannerStatus(username);
      log.info('Bot scanner status retrieved', { username });
      return NextResponse.json({ success: true, status });
    }
    
    // Execute scan (applies cooldown)
    const result = await scanForBots(username);
    
    if (!result.success) {
      log.warn('Bot scan failed', { username, reason: result.message });
      return NextResponse.json(result, { status: 400 });
    }
    
    log.info('Bot scan completed', { username, botsFound: result.bots?.length || 0 });
    return NextResponse.json(result);
    
  } catch (error) {
    log.error('Bot scanner error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
