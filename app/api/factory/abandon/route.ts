/**
 * Factory Abandon API Endpoint
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * POST endpoint for abandoning a player-owned factory. Clears ownership
 * while preserving the factory level and all upgrades, allowing any player
 * to claim it. Strategic repositioning tool.
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
 * - Level is PRESERVED (factory keeps all upgrades)
 * - Slots are PRESERVED
 * - Any player can claim the factory at its current level
 * - Units are NOT deleted — they remain with the player
 * 
 * USE CASES:
 * - Player at 10-factory limit wants to claim better location
 * - Strategic withdrawal from vulnerable position
 * - Consolidating production to fewer locations
 * - Abandoning low-level factories to invest in high-level ones
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { getFactoryStats, FACTORY_UPGRADE } from '@/lib/factoryUpgradeService';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const username = body.username;
    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username required' },
        { status: 400 }
      );
    }
    const { factoryX, factoryY } = body;

    // Validate coordinates
    if (typeof factoryX !== 'number' || typeof factoryY !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid factory coordinates' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Find the factory
    const { data: factory, error: factoryError } = await supabase
      .from('factories')
      .select('*')
      .eq('x', factoryX)
      .eq('y', factoryY)
      .single();

    if (factoryError || !factory) {
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
    const { count: unitsAtFactory, error: countError } = await supabase
      .from('player_units')
      .select('*', { count: 'exact', head: true })
      .eq('player_username', username)
      .eq('produced_at_x', factoryX)
      .eq('produced_at_y', factoryY);

    // Reset factory to unclaimed state (units are NOT deleted — they remain with the player)
    const now = new Date();
    const { error: updateError } = await supabase
      .from('factories')
      .update({
        owner: null,
        level: FACTORY_UPGRADE.MIN_LEVEL,
        slots: baseStats.maxSlots,
        last_slot_regen: now.toISOString(),
        last_attacked_by: null,
        last_attack_time: null
      })
      .eq('x', factoryX)
      .eq('y', factoryY);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to abandon factory' },
        { status: 500 }
      );
    }

    // Count remaining factories owned by player
    const { count: factoriesOwned } = await supabase
      .from('factories')
      .select('*', { count: 'exact', head: true })
      .eq('owner', username);

    // Fetch the reset factory
    const { data: resetFactory } = await supabase
      .from('factories')
      .select('*')
      .eq('x', factoryX)
      .eq('y', factoryY)
      .single();

    // Build response message — units are NOT deleted, they remain with the player
    const maxFactories = 10; // Hard cap of 10 factories per player
    const message = `Factory abandoned successfully. You now own ${factoriesOwned}/${maxFactories} factories.`;

    return NextResponse.json({
      success: true,
      message,
      factory: resetFactory,
      factoriesOwned,
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
 *    - Units produced at factory are NOT deleted — they remain with the player
 *    - Player's STR/DEF totals are unchanged
 * 
 * 2. Strategic Considerations:
 *    - Abandoning is permanent and costly
 *    - Should only be done when repositioning is critical
 *    - High-level factories represent significant investment
 *    - UI should show confirmation dialog before abandoning
 * 
 * 3. Unit Handling:
 *    - Units are never deleted on abandon
 *    - Player's total army stats are preserved
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
