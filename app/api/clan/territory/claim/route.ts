/**
 * @file app/api/clan/territory/claim/route.ts
 * @created 2025-10-18
 * @updated 2025-01-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * 
 * OVERVIEW:
 * POST endpoint for claiming territory tiles for a clan. Validates adjacency requirements,
 * resource costs, territory limits, and permissions. Integrates with territory service for
 * claiming logic and cost calculation with perk-based reductions.
 * 
 * ROUTES:
 * - POST /api/clan/territory/claim - Claim territory tile for clan
 * 
 * AUTHENTICATION:
 * - requireClanMembership() - Must be clan member
 * - Permission check in service layer (Officer, Co-Leader, Leader only)
 * 
 * BUSINESS RULES:
 * - First territory can be claimed anywhere
 * - Subsequent territories must be adjacent to existing clan territory (±1 x OR ±1 y)
 * - Cost: 500 Metal + 500 Energy (reduced by territory_cost perks)
 * - Max 100 territories per clan (configurable)
 * - Permissions: Officer, Co-Leader, or Leader only
 * - Cannot claim tiles already owned by any clan (including own clan)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireClanMembership,
  claimTerritory,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const POST = rateLimiter(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Parse and validate request body
    const body = await request.json();
    const { tileX, tileY } = body;

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

    // Claim territory via service (handles permissions, adjacency, costs)
    const claimResult = await claimTerritory(
      clanId,
      auth.username,
      tileX,
      tileY
    );

    return NextResponse.json({
      success: true,
      territory: claimResult.territory,
      cost: claimResult.cost,
      defenseBonus: claimResult.defenseBonus,
      message: `Successfully claimed territory at (${tileX}, ${tileY})`,
    });

  } catch (error: unknown) {
    logger.error('Error claiming territory:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('Officer')) {
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 403 }
      );
    }

    // Business rule violations
    if (
      errorMessage.includes('already claimed') ||
      errorMessage.includes('adjacent') ||
      errorMessage.includes('limit') ||
      errorMessage.includes('Insufficient')
    ) {
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 400 }
      );
    }

    // Not found errors
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Failed to claim territory' },
      { status: 500 }
    );
  }
});

/**
 * Implementation Notes:
 * 
 * Coordinate Validation:
 * - Validates both tileX and tileY are numbers
 * - Ensures they are integers (no decimal coordinates)
 * - Service layer handles range validation
 * 
 * Permission Checks:
 * - Performed in service layer (claimTerritory)
 * - Returns 403 for permission errors
 * - Specific error messages help UI show proper feedback
 * 
 * Error Handling:
 * - Categorizes errors by HTTP status code
 * - 400: Validation/business rule violations
 * - 403: Permission denied
 * - 404: Resource not found
 * - 500: Unexpected server errors
 * 
 * Response Format:
 * Success includes:
 * - territory: { tileX, tileY, clanId, clanTag, claimedAt, claimedBy, defenseBonus }
 * - cost: { metal: number, energy: number } (actual cost after reductions)
 * - defenseBonus: number (percentage bonus from adjacent tiles)
 * - message: string (user-friendly confirmation)
 * 
 * Future Enhancements:
 * - Add rate limiting (max claims per hour)
 * - Territory claiming cooldown
 * - Batch territory claiming
 * - Territory claiming during wars (special rules)
 * - Map visualization integration (show claimable tiles)
 */
