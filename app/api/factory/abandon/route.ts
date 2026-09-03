/**
 * Factory Abandon API Endpoint
 * Created: 2025-10-17
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
 * - All player units at factory are LOST
 * 
 * USE CASES:
 * - Player at 10-factory limit wants to claim better location
 * - Strategic withdrawal from vulnerable position
 * - Consolidating production to fewer locations
 * - Abandoning low-level factories to invest in high-level ones
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { connectToDatabase } from '@/lib/mongodb';
import { getFactoryStats, FACTORY_UPGRADE } from '@/lib/factoryUpgradeService';
import { Factory, Unit, Player } from '@/types/game.types';

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

    // Connect to database
    const db = await connectToDatabase();
    const factoriesCollection = db.collection<Factory>('factories');
    const playersCollection = db.collection<Player>('players');
    const unitsCollection = db.collection<Unit>('units');

    // Find the factory
    const factory = await factoriesCollection.findOne({
      x: factoryX,
      y: factoryY
    });

    if (!factory) {
      return NextResponse.json(
        { success: false, error: 'Factory not found at these coordinates' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (factory.owner !== username) {
      return NextResponse.json(
        { success: false, error: 'You do not own this factory' },
        { status: 403 }
      );
    }

    // Get base stats for Level 1 factory
    const baseStats = getFactoryStats(FACTORY_UPGRADE.MIN_LEVEL);

    // Count units at this factory (they will be lost)
    const unitsAtFactory = await unitsCollection.countDocuments({
      owner: username,
      factoryX: factoryX,
      factoryY: factoryY
    });

    // Reset factory to unclaimed state
    const now = new Date();
    const updateResult = await factoriesCollection.updateOne(
      { x: factoryX, y: factoryY },
      {
        $set: {
          owner: null,
          level: FACTORY_UPGRADE.MIN_LEVEL,
          slots: baseStats.maxSlots,
          usedSlots: 0,
          lastSlotRegen: now,
          lastAttackedBy: null,
          lastAttackTime: null
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to abandon factory' },
        { status: 500 }
      );
    }

    // Delete all units that were produced at this factory
    // This is intentional - abandoning a factory loses all its units
    let unitsLost = 0;
    let strLost = 0;
    let defLost = 0;

    if (unitsAtFactory > 0) {
      const unitsToDelete = await unitsCollection
        .find({
          owner: username,
          factoryX: factoryX,
          factoryY: factoryY
        })
        .toArray();

      // Calculate total STR/DEF lost
      for (const unit of unitsToDelete) {
        strLost += unit.strength || 0;
        defLost += unit.defense || 0;
      }

      // Delete units
      const deleteResult = await unitsCollection.deleteMany({
        owner: username,
        factoryX: factoryX,
        factoryY: factoryY
      });

      unitsLost = deleteResult.deletedCount;

      // Update player's total strength and defense
      await playersCollection.updateOne(
        { username },
        {
          $inc: {
            totalStrength: -strLost,
            totalDefense: -defLost
          }
        }
      );
    }

    // Count remaining factories owned by player
    const factoriesOwned = await factoriesCollection.countDocuments({
      owner: username
    });

    // Fetch the reset factory
    const resetFactory = await factoriesCollection.findOne({
      x: factoryX,
      y: factoryY
    });

    // Build response message
    let message = `Factory abandoned successfully. You now own ${factoriesOwned}/${FACTORY_UPGRADE.MAX_FACTORIES_PER_PLAYER} factories.`;
    if (unitsLost > 0) {
      message += ` Warning: ${unitsLost} units were lost (${strLost} STR, ${defLost} DEF).`;
    }

    return NextResponse.json({
      success: true,
      message,
      factory: resetFactory,
      factoriesOwned,
      unitsLost: {
        count: unitsLost,
        strength: strLost,
        defense: defLost
      }
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
 *    - All units produced at factory are deleted
 *    - Player's STR/DEF totals updated accordingly
 * 
 * 2. Strategic Considerations:
 *    - Abandoning is permanent and costly
 *    - Should only be done when repositioning is critical
 *    - High-level factories represent significant investment
 *    - UI should show confirmation dialog before abandoning
 * 
 * 3. Unit Handling:
 *    - Units are tracked by factory coordinates
 *    - Abandoning factory deletes all its units
 *    - Player's total army stats are recalculated
 *    - Response includes units lost count for feedback
 * 
 * 4. Factory Limit Management:
 *    - Abandoning frees a factory slot (if at 10 limit)
 *    - Response includes updated factory count
 *    - Allows strategic reallocation of factory slots
 * 
 * 5. Future Enhancements:
 *    - Could add "relocate units" option before abandoning
 *    - Could add partial refund of upgrade costs
 *    - Could add cooldown period before re-claiming
 *    - Could add "downgrade" option instead of full abandon
 */
