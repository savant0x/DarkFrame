/**
 * @file app/api/admin/beer-bases/list/route.ts
 * @created 2026-09-12
 * @overview FID-20260912-081 — the Beer Base roster the admin panel was missing.
 *
 * The admin Beer Base section had config sliders, schedules, and analytics, but
 * never a list of the actual bases — the operator had to query the DB by hand to
 * see what the weekly respawn produced. This route serves every special base:
 * name, power tier, level, position, power, resources, army size, sorted by
 * total strength descending (biggest threat first).
 *
 * Tier derivation: spawnBeerBase assigns rank 1–6 per tier (WEAK→LEGENDARY);
 * botConfig.tier was never written by the spawner (stale in rows). A level-band
 * fallback covers rows spawned before the rank contract existed.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { getAuthenticatedUser } from '@/lib/authService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/** rank 1–6 → WEAK/MID/STRONG/ELITE/ULTRA/LEGENDARY (spawnBeerBase contract). */
const RANK_TO_TIER = ['WEAK', 'MID', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'] as const;

/** Level-band fallback for rows spawned before the rank contract existed. */
function tierFromLevel(level: number): string {
  if (level < 5) return 'WEAK';
  if (level < 10) return 'MID';
  if (level < 20) return 'STRONG';
  if (level < 30) return 'ELITE';
  if (level < 40) return 'ULTRA';
  return 'LEGENDARY';
}

export const GET = withRequestLogging(rateLimiter(async (_req: Parameters<Parameters<typeof withRequestLogging>[0]>[0]) => {
  const log = createRouteLogger('AdminBeerBaseListAPI');
  const endTimer = log.time('get-beer-base-roster');

  try {
    const user = await getAuthenticatedUser();
    if (!user || !user.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    const rows = await db
      .select({
        username: players.username,
        rank: players.rank,
        level: players.level,
        baseX: players.baseX,
        baseY: players.baseY,
        totalStrength: players.totalStrength,
        totalDefense: players.totalDefense,
        resourcesMetal: players.resourcesMetal,
        resourcesEnergy: players.resourcesEnergy,
        units: players.units,
      })
      .from(players)
      .where(and(eq(players.isBot, 1), eq(players.isSpecialBase, 1)))
      .orderBy(desc(players.totalStrength));

    const bases = rows.map((row) => {
      const tier =
        row.rank && row.rank >= 1 && row.rank <= 6
          ? RANK_TO_TIER[row.rank - 1]
          : tierFromLevel(row.level);
      const armySize = (row.units || []).reduce(
        (sum: number, u: { quantity?: number }) => sum + (u.quantity || 0),
        0
      );
      return {
        username: row.username,
        tier,
        level: row.level,
        position: { x: row.baseX, y: row.baseY },
        totalStrength: row.totalStrength,
        totalDefense: row.totalDefense,
        resources: { metal: row.resourcesMetal, energy: row.resourcesEnergy },
        armySize,
      };
    });

    return NextResponse.json({ success: true, bases, total: bases.length });
  } catch (error) {
    log.error('Failed to list beer bases', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
