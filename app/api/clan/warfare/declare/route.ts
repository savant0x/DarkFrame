/**
 * @file app/api/clan/warfare/declare/route.ts
 * @created 2025-10-18
 * @updated 2025-01-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * 
 * OVERVIEW:
 * POST endpoint for declaring war on another clan. Validates level requirements, resource costs,
 * existing wars, and cooldown periods. Integrates with warfare service for declaration logic and
 * cost calculation with perk-based reductions.
 * 
 * ROUTES:
 * - POST /api/clan/warfare/declare - Declare war on target clan
 * 
 * AUTHENTICATION:
 * - requireClanMembership() - Must be clan member
 * - Permission check in service layer (Officer, Co-Leader, Leader only)
 * 
 * BUSINESS RULES:
 * - Declaring clan must be level 5+
 * - Cost: 2000 Metal + 2000 Energy (reduced by territory_cost perks)
 * - Only 1 active war between clan pair allowed
 * - 48-hour cooldown after war ends before same clans can war again
 * - Permissions: Officer, Co-Leader, or Leader only
 * - Cannot declare war on own clan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { declareWar } from '@/lib/clanWarfareService';

/**
 * POST /api/clan/warfare/declare
 * Declare war on another clan
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with war declaration result or error
 * 
 * @example
 * POST /api/clan/warfare/declare
 * Body: { targetClanId: "676a1b2c3d4e5f6a7b8c9d0e" }
 * Response: {
 *   success: true,
 *   war: { warId: "...", status: "ACTIVE", ... },
 *   cost: { metal: 1800, energy: 1800 },
 *   message: "War declared against [DARK]"
 * }
 * 
 * @throws {400} Invalid targetClanId, level too low, existing war, cooldown, insufficient resources, or own clan
 * @throws {401} Not authenticated
 * @throws {403} Insufficient permissions (not Officer/Co-Leader/Leader)
 * @throws {404} Player or target clan not found
 * @throws {500} Server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Parse and validate request body
    const body = await request.json();
    const { targetClanId } = body;

    if (!targetClanId || typeof targetClanId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Invalid targetClanId. Must be a string.' },
        { status: 400 }
      );
    }

    // Declare war via service (handles permissions, validation, costs)
    const warResult = await declareWar(
      clanId,
      targetClanId,
      auth.username
    );

    return NextResponse.json({
      success: true,
      war: warResult.war,
      cost: warResult.cost,
      message: warResult.message,
    });

  } catch (error: any) {
    console.error('Error declaring war:', error);

    // Permission errors
    if (error.message.includes('permission') || error.message.includes('Officer')) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 403 }
      );
    }

    // Business rule violations
    if (
      error.message.includes('level') ||
      error.message.includes('war already exists') ||
      error.message.includes('cooldown') ||
      error.message.includes('Insufficient') ||
      error.message.includes('own clan')
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
      { success: false, message: 'Failed to declare war' },
      { status: 500 }
    );
  }
}

/**
 * Implementation Notes:
 * 
 * Target Clan Validation:
 * - Validates targetClanId is a string
 * - Service layer handles MongoDB ObjectId conversion
 * - Service validates target clan exists
 * 
 * Permission Checks:
 * - Performed in service layer (declareWar)
 * - Returns 403 for permission errors
 * - Specific error messages for UI feedback
 * 
 * Level Requirement:
 * - Clan must be level 5+ to declare war
 * - Checked in service layer
 * - Error message includes current level for context
 * 
 * Cooldown Handling:
 * - 48-hour cooldown after previous war with same clan
 * - Error message includes hours remaining
 * - Prevents war spam between same clans
 * 
 * Error Categorization:
 * - 400: Business rule violations (level, cooldown, resources)
 * - 403: Permission denied (not Officer+)
 * - 404: Resource not found (player, clan)
 * - 500: Unexpected server errors
 * 
 * Response Format:
 * Success includes:
 * - war: Complete ClanWar object with warId, status, costs, stats
 * - cost: { metal: number, energy: number } (actual cost after perk reductions)
 * - message: User-friendly confirmation with target clan tag
 * 
 * Future Enhancements:
 * - War proposals (target must accept)
 * - Alliance system (multi-clan wars)
 * - War objectives (capture X territories, win Y battles)
 * - War rewards (resources, perks, monuments)
 * - Scheduled wars (declare for future start time)
 */
