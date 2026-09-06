/**
 * @file app/api/flag/route.ts
 * @created 2025-10-20
 * @overview Flag Bearer API endpoint (rewritten per FID-20260905-001 §7.2)
 *
 * OVERVIEW:
 * GET /api/flag — current Flag Bearer data (position, level, HP, hold duration,
 * trail). Postgres-native via lib/flagState: holder identity comes from the
 * flags row; position/level/HP are derived from the holder's `players` row at
 * read time (single source of truth). The previous implementation read a
 * Mongo-era nested `currentHolder` doc that the Postgres schema never carried,
 * so it always returned data:null and the client's FlagTrackerPanel never
 * mounted.
 *
 * The legacy POST handler here was a dead duplicate of POST /api/flag/attack
 * (no client caller; shim-based writes; no presence check) and has been removed.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { FlagBearer, FlagAPIResponse } from '@/types/flag.types';
import { getFlagState } from '@/lib/flagState';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_DATA);

/**
 * GET /api/flag
 *
 * Retrieve current Flag Bearer information
 *
 * @returns FlagAPIResponse<FlagBearer | null>
 *
 * @example
 * ```ts
 * const response = await fetch('/api/flag');
 * const data: FlagAPIResponse<FlagBearer> = await response.json();
 *
 * if (data.success && data.data) {
 *   console.log('Flag Bearer:', data.data.username);
 * }
 * ```
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest): Promise<NextResponse<FlagAPIResponse<FlagBearer | null>>> => {
  const log = createRouteLogger('flag-get');
  const endTimer = log.time('flag-get');

  try {
    const state = await getFlagState();

    if (!state) {
      // No holder (flag unclaimed or holder row missing) — client shows the
      // flag module as unclaimed. Lazy init is handled by /api/flag/init and
      // server boot; an empty read here is a valid steady state.
      return NextResponse.json({
        success: true,
        data: null,
        timestamp: new Date()
      });
    }

    const holdDuration = Math.floor((Date.now() - state.claimedAt.getTime()) / 1000);

    const bearer: FlagBearer = {
      playerId: state.holderUsername,
      username: state.holderUsername,
      level: state.level,
      position: state.position,
      claimedAt: state.claimedAt,
      holdDuration,
      currentHP: state.currentHP,
      maxHP: state.maxHP,
      trail: state.trail,
    };

    log.info('Flag bearer retrieved', { holderId: state.holderUsername, holdDuration });
    return NextResponse.json({
      success: true,
      data: bearer,
      timestamp: new Date()
    });
  } catch (error) {
    log.error('Failed to fetch flag bearer', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Flag Bearer data',
      timestamp: new Date()
    }, { status: 500 });
  } finally {
    endTimer();
  }
}));
