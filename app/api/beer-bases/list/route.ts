// ============================================================
// FILE: app/api/beer-bases/list/route.ts
// CREATED: 2025-01-23
// UPDATED: 2026-09-04 — intel gating (organic discovery)
// ============================================================
// OVERVIEW:
// API endpoint for fetching active Beer Bases. Intel is hidden until the
// requesting player stands on a base's tile ("scanned"): army size, strength,
// defense, loot, exact position, specialization and tier are only revealed by
// physical presence. Always visible: the base's name (it is the attack handle
// and is visible on the map), its power tier (embedded in the name), and
// coarse distance — a hot/cold compass that rewards exploration without
// handing over coordinates.
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { chebyshevDistance } from '@/lib/presenceCheck';

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // FID-20260911-048: projections — the caller needs position only; bases
    // need the ~10 rendered fields (plus units solely for the scanned one).
    // A full read ships a ~30 KB units blob per special base as the population
    // grows; keep this endpoint O(rendered fields), not O(row).
    const playerResult = await db
      .select({
        username: players.username,
        currentPositionX: players.currentPositionX,
        currentPositionY: players.currentPositionY,
      })
      .from(players)
      .where(eq(players.username, auth.username))
      .limit(1);
    const player = playerResult[0];
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const playerPos = { x: player.currentPositionX, y: player.currentPositionY };

    const beerBases = await db
      .select({
        username: players.username,
        rank: players.rank,
        level: players.level,
        currentPositionX: players.currentPositionX,
        currentPositionY: players.currentPositionY,
        totalStrength: players.totalStrength,
        totalDefense: players.totalDefense,
        resourcesMetal: players.resourcesMetal,
        resourcesEnergy: players.resourcesEnergy,
        specialization: players.specialization,
        units: players.units,
      })
      .from(players)
      .where(eq(players.isSpecialBase, 1));

    const beerBasesPayload = beerBases.map((base) => {
      const dx = Math.abs(base.currentPositionX - playerPos.x);
      const dy = Math.abs(base.currentPositionY - playerPos.y);
      const distance = Math.sqrt(dx * dx + dy * dy);

      // FID-20260912-081: tier comes from rank (1–6 = WEAK→LEGENDARY, set by
      // spawnBeerBase) with a level-band fallback — the old username-slug parse
      // ('-ELITE-' etc.) matches nothing since FID-20260906-007 renamed bases
      // to themed place names, so every base rendered as WEAK.
      const RANK_TO_TIER = ['WEAK', 'MID', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'] as const;
      const tierFromLevel = (lvl: number): string =>
        lvl < 5 ? 'WEAK' : lvl < 10 ? 'MID' : lvl < 20 ? 'STRONG' : lvl < 30 ? 'ELITE' : lvl < 40 ? 'ULTRA' : 'LEGENDARY';
      const powerTier =
        base.rank && base.rank >= 1 && base.rank <= 6
          ? RANK_TO_TIER[base.rank - 1]
          : tierFromLevel(base.level);

      // Scanned = the player stands on the base's tile (Chebyshev, 8-directional grid).
      const scanned = chebyshevDistance(playerPos, { x: base.currentPositionX, y: base.currentPositionY }) === 0;

      if (!scanned) {
        // Unscanned: only what exploration itself reveals.
        return {
          username: base.username,
          powerTier,
          distance: Math.round(distance),
          scanned,
        };
      }

      const units = base.units || [];
      const armySize = units.reduce((sum: number, u: { quantity?: number }) => sum + (u.quantity || 0), 0);

      return {
        username: base.username,
        position: { x: base.currentPositionX, y: base.currentPositionY },
        distance: Math.round(distance),
        totalStrength: base.totalStrength,
        totalDefense: base.totalDefense,
        resources: {
          metal: Number(base.resourcesMetal),
          energy: Number(base.resourcesEnergy),
        },
        armySize,
        powerTier,
        specialization: base.specialization || 'balanced',
        tier: base.rank || 1,
        scanned,
      };
    });

    beerBasesPayload.sort((a, b) => a.distance - b.distance);

    return NextResponse.json({
      success: true,
      beerBases: beerBasesPayload,
      totalCount: beerBasesPayload.length,
    });
  } catch (error) {
    console.error('Error fetching Beer Bases:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Beer Bases' },
      { status: 500 }
    );
  }
}
