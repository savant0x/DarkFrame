/**
 * @file app/api/factory/release/route.ts
 * @created 2025-11-03
 * @overview Factory release endpoint - abandon individual or batch factories
 * 
 * OVERVIEW:
 * POST endpoint to release (abandon) one or more factories owned by the player.
 * Supports individual release or batch release based on slot threshold.
 * 
 * REQUEST BODY:
 * {
 *   "mode": "single" | "batch",
 *   "factoryX"?: number,        // Required for single mode
 *   "factoryY"?: number,        // Required for single mode
 *   "slotThreshold"?: number    // Required for batch mode (release factories with <= this many slots)
 * }
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "message": string,
 *   "releasedCount": number,    // Number of factories released
 *   "releasedFactories": Array<{x: number, y: number}>
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { connectToDatabase } from '@/lib/mongodb';
import { db as gameDb, factories } from '@/lib/db';
import { and, eq, lte, sql } from 'drizzle-orm';
import type { Factory } from '@/types/game.types';
import { getMaxSlots } from '@/lib/factoryUpgradeService';

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
    const body = await request.json();
    const { mode, factoryX, factoryY, slotThreshold } = body;

    // Validate mode
    if (!mode || (mode !== 'single' && mode !== 'batch')) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be "single" or "batch"' },
        { status: 400 }
      );
    }

    // Validate single mode parameters
    if (mode === 'single' && (factoryX === undefined || factoryY === undefined)) {
      return NextResponse.json(
        { success: false, error: 'factoryX and factoryY required for single mode' },
        { status: 400 }
      );
    }

    // Validate batch mode parameters
    if (mode === 'batch' && slotThreshold === undefined) {
      return NextResponse.json(
        { success: false, error: 'slotThreshold required for batch mode' },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const factoriesCollection = db.collection<Factory>('factories');
    
    let releasedFactories: Array<{x: number, y: number}> = [];
    let releasedCount = 0;
    let message = '';

    if (mode === 'single') {
      // Single factory release
      const factory = await factoriesCollection.findOne({ 
        x: factoryX, 
        y: factoryY,
        owner: username 
      });

      if (!factory) {
        return NextResponse.json(
          { success: false, error: 'Factory not found or not owned by you' },
          { status: 404 }
        );
      }

      // Reset factory to neutral state
      await factoriesCollection.updateOne(
        { x: factoryX, y: factoryY },
        {
          $set: {
            owner: null,
            level: 1,
            slots: getMaxSlots(1),
            usedSlots: 0,
            productionRate: 1,
            lastSlotRegen: new Date(),
            lastAttackedBy: null,
            lastAttackTime: null
          }
        }
      );

      releasedFactories.push({ x: factoryX, y: factoryY });
      releasedCount = 1;
      message = `Factory at (${factoryX}, ${factoryY}) has been released and reset to Level 1`;
      
      console.log(`🏭 ${username} released factory at (${factoryX}, ${factoryY})`);
      
    } else {
      // Batch release based on slot threshold
      const threshold = parseInt(String(slotThreshold), 10);
      
      if (isNaN(threshold) || threshold < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid slotThreshold value' },
          { status: 400 }
        );
      }

      // Find all owned factories with available slots <= threshold (capacity - used <= threshold).
      // Drizzle directly: the Mongo-seam $expr form was silently unsupported (matched nothing filtered).
      const matchingFactories = await gameDb
        .select({ x: factories.x, y: factories.y })
        .from(factories)
        .where(
          and(
            eq(factories.owner, username),
            lte(sql`${factories.slots} - COALESCE(${factories.usedSlots}, 0)`, threshold)
          )
        );

      if (matchingFactories.length === 0) {
        return NextResponse.json({
          success: true,
          message: `No factories found with ${threshold} or fewer slots`,
          releasedCount: 0,
          releasedFactories: []
        });
      }

      // Release all matching factories in one statement, same predicate as the select
      await gameDb
        .update(factories)
        .set({
          owner: null,
          level: 1,
          slots: getMaxSlots(1),
          usedSlots: 0,
          productionRate: '1',
          lastSlotRegen: new Date(),
          lastAttackedBy: null,
          lastAttackTime: null,
        })
        .where(
          and(
            eq(factories.owner, username),
            lte(sql`${factories.slots} - COALESCE(${factories.usedSlots}, 0)`, threshold)
          )
        );

      const factoryCoords = matchingFactories;

      releasedFactories = factoryCoords;
      releasedCount = matchingFactories.length;
      message = `Released ${releasedCount} ${releasedCount === 1 ? 'factory' : 'factories'} with ${threshold} or fewer slots`;
      
      console.log(`🏭 ${username} batch released ${releasedCount} factories (threshold: ${threshold} slots)`);
    }

    return NextResponse.json({
      success: true,
      message,
      releasedCount,
      releasedFactories
    });

  } catch (error) {
    console.error('Factory release error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while releasing factories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Single Mode:
 *    - Validates ownership before release
 *    - Resets factory to Level 1 neutral state
 *    - All slots and production reset
 * 
 * 2. Batch Mode:
 *    - Finds all owned factories with slots <= threshold
 *    - Releases all matching factories in one operation
 *    - Useful for clearing low-level factories
 * 
 * 3. Reset State:
 *    - owner: null (neutral)
 *    - level: 1
 *    - slots: 20 (base slots)
 *    - usedSlots: 0
 *    - productionRate: 1 (base rate)
 *    - All timestamps and attack data cleared
 * 
 * 4. Strategic Use:
 *    - Free up factory slots for new captures
 *    - Remove underperforming factories
 *    - Batch clear to reorganize factory empire
 */
