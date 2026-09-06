/**
 * @file app/api/admin/anti-cheat/player-flags/route.ts
 * @created 2026-09-04
 * @overview Per-player anti-cheat flags for the admin PlayerDetailModal (SCOPE #22).
 *
 * Rebuild of the Mongo-pivot-era endpoint. Backed by the `player_flags` table
 * (written by lib/antiCheatDetector's recordFlag; domain columns added in
 * migration 0007_admin_flags_bans).
 *
 * GET /api/admin/anti-cheat/player-flags?username=<u>
 * Admin-only (rank >= 5, same gate as /api/admin/players/[username]).
 *
 * Response shape is fixed by components/admin/PlayerDetailModal.tsx:
 * { success, flags: [{ flagType, severity, timestamp, details }], maxSeverity, isBanned }
 * isBanned reflects the account-ban gate columns on players (migration 0007).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { playerFlags, players } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

const SEVERITY_ORDER: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminPlayerFlagsAPI');
  const endTimer = log.time('player-flags');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const url = new URL(request.url);
    const username = url.searchParams.get('username')?.trim();
    if (!username) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'username query parameter is required',
      });
    }

    const rows = await db
      .select({
        flagType: playerFlags.flagType,
        severity: playerFlags.severity,
        timestamp: playerFlags.createdAt,
        evidence: playerFlags.evidence,
        metadata: playerFlags.metadata,
      })
      .from(playerFlags)
      .where(eq(playerFlags.username, username))
      .orderBy(desc(playerFlags.createdAt))
      .limit(100);

    const flags = rows.map((r) => ({
      flagType: r.flagType ?? 'UNKNOWN',
      severity: r.severity ?? 'LOW',
      timestamp: r.timestamp,
      // details rendered as a string in the modal; evidence text or a compact metadata dump
      details: r.evidence ?? (r.metadata ? JSON.stringify(r.metadata) : ''),
    }));

    const maxSeverity = flags.reduce<string>(
      (max, f) => ((SEVERITY_ORDER[f.severity] ?? 0) > (SEVERITY_ORDER[max] ?? 0) ? f.severity : max),
      ''
    );

    const [player] = await db
      .select({ banned: players.banned, banExpiresAt: players.banExpiresAt })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    const banActive = !!player?.banned &&
      (!player?.banExpiresAt || new Date(player.banExpiresAt) > new Date());

    return NextResponse.json({
      success: true,
      flags,
      maxSeverity,
      isBanned: banActive,
    });
  } catch (error) {
    log.error('Failed to fetch player flags', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
