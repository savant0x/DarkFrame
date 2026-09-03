// ============================================================
// FILE: app/api/beer-bases/list/route.ts
// CREATED: 2025-01-23
// ============================================================
// OVERVIEW:
// API endpoint for fetching active Beer Bases with distance
// calculations from requesting player. Returns sorted list
// of Beer Bases with stats, location, and loot information.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username required' },
        { status: 400 }
      );
    }

    const playerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
    const player = playerResult[0];
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const playerPos = { x: player.currentPositionX, y: player.currentPositionY };

    const beerBases = await db.select().from(players).where(eq(players.isSpecialBase, 1));

    const beerBasesWithDistance = beerBases.map((base) => {
      const dx = Math.abs(base.currentPositionX - playerPos.x);
      const dy = Math.abs(base.currentPositionY - playerPos.y);
      const distance = Math.sqrt(dx * dx + dy * dy);

      const powerTier = base.username.includes('-LEGENDARY-')
        ? 'LEGENDARY'
        : base.username.includes('-ULTRA-')
        ? 'ULTRA'
        : base.username.includes('-ELITE-')
        ? 'ELITE'
        : base.username.includes('-STRONG-')
        ? 'STRONG'
        : base.username.includes('-MID-')
        ? 'MID'
        : 'WEAK';

      const units = base.units || [];
      const armySize = units.reduce((sum: number, u: any) => sum + (u.quantity || 0), 0);

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
      };
    });

    beerBasesWithDistance.sort((a: any, b: any) => a.distance - b.distance);

    return NextResponse.json({
      success: true,
      beerBases: beerBasesWithDistance,
      totalCount: beerBasesWithDistance.length,
    });
  } catch (error) {
    console.error('Error fetching Beer Bases:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Beer Bases' },
      { status: 500 }
    );
  }
}
