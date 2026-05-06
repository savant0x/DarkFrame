/**
 * @file app/api/clan/warfare/capture/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * POST endpoint for capturing enemy territory during an active war. Validates war status,
 * territory ownership, and permissions. Integrates with warfare service for capture logic
 * including success rate calculation based on defense bonuses.
 * 
 * ROUTES:
 * - POST /api/clan/warfare/capture - Attempt to capture enemy territory
 * 
 * AUTHENTICATION:
 * - requireClanMembership() - Must be clan member
 * - Permission check in service layer (Officer, Co-Leader, Leader only)
 * 
 * BUSINESS RULES:
 * - Active war must exist between attacker and defender clans
 * - Territory must be owned by target clan
 * - Capture success rate: 70% base, reduced by defense bonuses
 * - Defense bonus impact: 50% of enemy defense bonus reduces capture rate
 * - Minimum 30% capture rate guaranteed
 * - Permissions: Officer, Co-Leader, or Leader only
 * - Failed captures are logged but don't transfer territory
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { captureTerritory } from '@/lib/clanWarfareService';

/**
 * POST /api/clan/warfare/capture
 * Attempt to capture enemy territory during active war
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with capture result or error
 * 
 * @example
 * POST /api/clan/warfare/capture
 * Body: { targetClanId: "676a1b2c3d4e5f6a7b8c9d0e", tileX: 10, tileY: 15 }
 * Response (success): {
 *   success: true,
 *   territory: { tileX: 10, tileY: 15, clanId: "..." },
 *   defenseBonus: 20,
 *   message: "Successfully captured territory (10, 15)!"
 * }
 * 
 * @example
 * POST /api/clan/warfare/capture
 * Body: { targetClanId: "...", tileX: 10, tileY: 15 }
 * Response (failed capture): {
 *   success: false,
 *   defenseBonus: 40,
 *   message: "Failed to capture territory. Enemy defense bonus: 40%"
 * }
 * 
 * @throws {400} Invalid coords, no active war, territory not owned by target
 * @throws {401} Not authenticated
 * @throws {403} Insufficient permissions (not Officer/Co-Leader/Leader)
 * @throws {404} Player or clan not found
 * @throws {500} Server error
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Parse and validate request body
    const body = await request.json();
    const { targetClanId, tileX, tileY } = body;

    if (!targetClanId || typeof targetClanId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid targetClanId. Must be a string.' },
        { status: 400 }
      );
    }

    if (typeof tileX !== 'number' || typeof tileY !== 'number') {
      return NextResponse.json(
        { success: false, message: 'Invalid coordinates. tileX and tileY must be numbers.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return NextResponse.json(
        { success: false, message: 'Coordinates must be integers' },
        { status: 400 }
      );
    }

    // Attempt territory capture via service (handles permissions, war validation, success rate)
    const captureResult = await captureTerritory(
      clanId,
      targetClanId,
      tileX,
      tileY,
      auth.username
    );

    // Return result (success can be true or false - both are 200 OK)
    return NextResponse.json({
      success: captureResult.success,
      message: captureResult.message,
    });

  } catch (error: any) {
    console.error('Error capturing territory:', error);

    // Permission errors
    if (error.message.includes('permission') || error.message.includes('Officer')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 }
      );
    }

    // Business rule violations
    if (
      error.message.includes('No active war') ||
      error.message.includes('not owned by target') ||
      error.message.includes('territory not owned')
    ) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    // Not found errors
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Failed to capture territory' },
      { status: 500 }
    );
  }
}

/**
 * Implementation Notes:
 * 
 * Success vs Capture Success:
 * - API call can succeed (200 OK) even if capture fails (defenses held)
 * - result.success indicates whether territory was actually captured
 * - Both outcomes return 200 status code with different success values
 * 
 * Capture Mechanics:
 * - Base 70% success rate
 * - Enemy defense bonus reduces rate: successRate = 0.7 - (defenseBonus / 100) * 0.5
 * - Example: 40% defense → 70% - (40 * 0.5) = 50% capture rate
 * - Minimum 30% capture rate (max defense 50% → 45% capture rate)
 * 
 * Response Handling:
 * Successful Capture (success: true):
 * - territory: { tileX, tileY, clanId }
 * - defenseBonus: Enemy's defense percentage
 * - message: "Successfully captured territory (x, y)!"
 * 
 * Failed Capture (success: false):
 * - territory: undefined
 * - defenseBonus: Enemy's defense percentage that caused failure
 * - message: "Failed to capture territory. Enemy defense bonus: X%"
 * 
 * Error Categorization:
 * - 400: Business rule violations (no war, wrong territory, invalid input)
 * - 403: Permission denied (not Officer+)
 * - 404: Resource not found (player, clans)
 * - 500: Unexpected server errors
 * 
 * Coordinate Validation:
 * - Validates both tileX and tileY are integers
 * - Service layer checks territory exists at coordinates
 * - Service validates territory ownership
 * 
 * War Validation:
 * - Service checks for ACTIVE war (not DECLARED or ENDED)
 * - Both attacker→defender and defender→attacker wars are checked
 * - Clear error message if no active war exists
 * 
 * Future Enhancements:
 * - Battle simulation for capture attempts (unit-based combat)
 * - Multiple capture attempts per turn/timeframe
 * - Capture cooldowns (prevent spam)
 * - Territory value system (strategic vs resource territories)
 * - Siege mechanics (weaken defenses over time)
 * - Counter-attack opportunities for defenders
 */
