/**
 * Bot Scanner API - Scan for Bots Within Radius
 * Created: 2024-10-18
 * 
 * GET /api/bot-scanner?action=status
 * - Returns scanner unlock status and cooldown info
 * - No cooldown applied (just checking status)
 * 
 * GET /api/bot-scanner
 * - Scans for bots within radius
 * - Returns bot list, nest locations, scanner status
 * - Applies cooldown after scan
 * 
 * FID-20260909-023 §3.1a: session identity — the `username` query parameter is
 * IGNORED. Identity comes from the authenticated session (query-string identity
 * let any caller trigger scans and read intelligence for any other player).
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanForBots, getScannerStatus } from '@/lib/botScannerService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('bot-scanner-get');
  const endTimer = log.time('bot-scanner-get');
  try {
    // FID-20260909-023 §3.1a: session identity — query username ignored.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const username = authUser.username;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
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
