/**
 * Factory Abandon API Endpoint
 * Created: 2025-10-17
 * Rewritten: 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * POST endpoint for abandoning a player-owned factory. Resets factory to
 * unclaimed state (Level 1, no owner), allowing player to free up a factory
 * slot when at the 10-factory limit. Strategic repositioning tool.
 *
 * REQUEST BODY:
 * {
 *   "factoryX": number,      // Factory X coordinate
 *   "factoryY": number       // Factory Y coordinate
 * }
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": "Factory abandoned successfully",
 *   "factory": Factory,      // Reset factory (Level 1, no owner)
 *   "factoriesOwned": number // Updated count of owned factories
 * }
 *
 * VALIDATION:
 * - User must be authenticated
 * - Factory must exist at coordinates
 * - Factory must be owned by user
 *
 * ABANDON BEHAVIOR:
 * - Owner set to null (becomes unclaimed)
 * - Level reset to 1
 * - Slots reset to base capacity (10)
 * - usedSlots reset to 0
 * - Defense unchanged (tile property)
 *
 * FID-20260914-009 Phase A: the former "units at the factory are lost"
 * accounting was removed. It queried the unmapped `units` collection (every
 * call silently no-oped on the shim) against a contract the live data
 * contradicts: units are a global army in players.units and carry no factory
 * stationing coordinates (0/57 players have producedAt), so there is nothing
 * per-factory to lose. Abandon costs the factory, never the army.
 *
 * USE CASES:
 * - Player at 10-factory limit wants to claim better location
 * - Strategic withdrawal from vulnerable position
 * - Consolidating production to fewer locations
 * - Abandoning low-level factories to invest in high-level ones
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { factories } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getFactoryStats, FACTORY_UPGRADE } from '@/lib/factoryUpgradeService';
import { recountPlayerFactoryCount } from '@/lib/factoryService';
import { Factory } from '@/types/game.types';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const username = authResult.username;

    // Parse request body
    const body = await request.json();
    const { factoryX, factoryY } = body;

    // Validate coordinates
    if (typeof factoryX !== 'number' || typeof factoryY !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid factory coordinates' },
        { status: 400 }
      );
    }

    // Find the factory (direct pg read)
    const factoryRows = (await db
      .select()
      .from(factories)
      .where(and(eq(factories.x, factoryX), eq(factories.y, factoryY)))
      .limit(1)) as unknown as Factory[];

    if (factoryRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Factory not found at these coordinates' },
        { status: 404 }
      );
    }
    const factory = factoryRows[0];

    // Verify ownership
    if (factory.owner !== username) {
      return NextResponse.json(
        { success: false, error: 'You do not own this factory' },
        { status: 403 }
      );
    }

    // Get base stats for Level 1 factory
    const baseStats = getFactoryStats(FACTORY_UPGRADE.MIN_LEVEL);

    // Reset factory to unclaimed state
    const now = new Date();
    const updated = await db
      .update(factories)
      .set({
        owner: null,
        level: FACTORY_UPGRADE.MIN_LEVEL,
        slots: baseStats.maxSlots,
        usedSlots: 0,
        lastSlotRegen: now,
        lastAttackedBy: null,
        lastAttackTime: null,
        // FID-20260917-004: parity with /release — reset the display-only
        // production rate so abandoned tiles don't carry stale values.
        productionRate: '1',
        // FID-20260909-032 §7: the factory forgets its owner and its spend.
        investedMetal: 0,
        investedEnergy: 0,
      })
      .where(and(eq(factories.x, factoryX), eq(factories.y, factoryY)))
      .returning({ x: factories.x });

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to abandon factory' },
        { status: 500 }
      );
    }

    // FID-20260914-009 Phase A: no unit deletions or STR/DEF deductions here.
    // The old block hit the unmapped `units` collection (silent no-op: counted
    // 0, deleted 0) and deducted totals that were never written — while the
    // player's REAL army in players.units was never touched. Units survive
    // abandon; the factory reset is the entire cost.

    // Count remaining factories owned by player — and persist the count to
    // players.factory_count, which no ownership transition used to maintain
    // (FID-20260908-004). The recount helper is the single writer of the column.
    const factoriesOwned = await recountPlayerFactoryCount(username);

    // Fetch the reset factory
    const resetFactoryRows = (await db
      .select()
      .from(factories)
      .where(and(eq(factories.x, factoryX), eq(factories.y, factoryY)))
      .limit(1)) as unknown as Factory[];

    // Build response message
    const message = `Factory abandoned successfully. You now own ${factoriesOwned}/${FACTORY_UPGRADE.MAX_FACTORIES_PER_PLAYER} factories. Your units are unaffected.`;

    return NextResponse.json({
      success: true,
      message,
      factory: resetFactoryRows[0],
      factoriesOwned
    });

  } catch (error) {
    console.error('Factory abandon error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while abandoning factory',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. Abandon Consequences:
 *    - Factory becomes immediately claimable by anyone
 *    - All upgrade progress lost (no refund)
 *    - Player units are NOT affected (army is global in players.units —
 *      FID-20260914-009 Phase A removed the obsolete per-factory accounting)
 *
 * 2. Strategic Considerations:
 *    - Abandoning is permanent and costly
 *    - Should only be done when repositioning is critical
 *    - High-level factories represent significant investment
 *    - UI should show confirmation dialog before abandoning
 *
 * 3. Unit Handling (FID-20260914-009 Phase A):
 *    - Units live in players.units as a global army — no per-factory stationing
 *    - Abandoning a factory never touches the army
 *    - The old unmapped-collection accounting silently no-oped and is removed
 *
 * 4. Factory Limit Management:
 *    - Abandoning frees a factory slot (if at 10 limit)
 *    - Response includes updated factory count
 *    - Allows strategic reallocation of factory slots
 */
