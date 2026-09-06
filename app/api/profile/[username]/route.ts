/**
 * @file app/api/profile/[username]/route.ts
 * @created 2026-09-06
 * @overview Public player profile API (FID-20260906-008 R1).
 *
 * GET /api/profile/:username
 *
 * Public identity layer for the Flag Tracker's Track action ("view Flag
 * Bearer's profile" — docs/FLAG_TRACKER_INTEGRATION_COMPLETE.md:100) and any
 * future profile-link surface (leaderboard, battle logs, clan rosters).
 *
 * SECURITY:
 * - Identity comes from the URL param, not the session; reads are public by
 *   design (any visitor can view a player's public identity).
 * - Data passes through getPlayerByUsername's default public projection
 *   (FID-20260904-005 §5.0 allowlist): password/email/signupIp/stripe ids can
 *   NEVER ride along, and `includePrivate` is never passed here.
 * - Unknown names (including bot names) get the same 404 shape — no existence
 *   oracle.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerByUsername } from '@/lib/playerService';
import { isLookupableUsername } from '@/lib/authService';
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

/**
 * Username validation uses the shared lookup-side rule (lib/authService):
 * a superset of registration's charset that also accepts themed bot names
 * with internal spaces ("Thundering Depot"), while rejecting hostile URL
 * segments (quotes/semicolons/comment sequences) before any DB access.
 */

/**
 * The explicit public profile shape (FID-20260906-008 R1). Built field by
 * field from the sanitized projection — never spread — so a compile-time
 * change here is the single gate every future profile surface must pass.
 */
export interface PublicProfile {
  username: string;
  level: number;
  xp: number;
  rank: number;
  isBot: boolean;
  isAdmin: boolean;
  vip: boolean;
  clanId: string | null;
  clanName: string | null;
  base: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
  totalStrength: number;
  totalDefense: number;
  battleStats: unknown;
  achievements: unknown;
  createdAt: string | null;
}

export const GET = withRequestLogging(
  rateLimiter(async (_request: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const log = createRouteLogger('profile-public-get');
    const endTimer = log.time('profile-public-get');

    try {
      const rawName = (await context.params).username ?? '';
      const username = decodeURIComponent(rawName ?? '');

      if (!isLookupableUsername(username)) {
        // Malformed names: same generic validation error for any bad input.
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'Invalid username');
      }

      const player = await getPlayerByUsername(username);
      if (!player) {
        // Unknown and bot-unreachable names share one body — no existence oracle.
        return createErrorResponse(ErrorCode.NOT_FOUND, 'Profile not found');
      }

      // Build the public shape explicitly from the sanitized projection's fields.
      const profile: PublicProfile = {
        username: player.username,
        level: player.level ?? 1,
        xp: player.xp ?? 0,
        rank: player.rank ?? 1,
        isBot: player.isBot === true,
        isAdmin: player.isAdmin === true,
        vip: player.vip === true,
        clanId: player.clanId ?? null,
        clanName: player.clanName ?? null,
        base: player.base ? { x: player.base.x, y: player.base.y } : null,
        currentPosition: player.currentPosition
          ? { x: player.currentPosition.x, y: player.currentPosition.y }
          : null,
        totalStrength: player.totalStrength ?? 0,
        totalDefense: player.totalDefense ?? 0,
        battleStats: player.battleStats ?? null,
        achievements: player.achievements ?? [],
        createdAt: player.createdAt ? new Date(player.createdAt).toISOString() : null,
      };

      return NextResponse.json({ success: true, profile });
    } catch (error) {
      log.error(
        'Failed to load public profile',
        error instanceof Error ? error : new Error(String(error))
      );
      return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
    } finally {
      endTimer();
    }
  })
);
