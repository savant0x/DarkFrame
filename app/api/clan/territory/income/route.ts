/**
 * @file app/api/clan/territory/income/route.ts
 * @created 2025-10-18
 * @updated 2025-01-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * 
 * OVERVIEW:
 * API endpoint for viewing and managing territory passive income.
 * GET: View projected daily income from territories
 * POST: Manual income collection (admin/testing only)
 * 
 * ROUTES:
 * - GET /api/clan/territory/income - View income projection
 * - POST /api/clan/territory/income - Manual collection trigger (admin only)
 * 
 * AUTHENTICATION:
 * - GET: requireClanMembership() - Any clan member can view
 * - POST: requireAdmin() - Admin password required for manual collection
 * 
 * BUSINESS RULES:
 * - Income calculated per territory (base rate × clan level modifier)
 * - Daily collection schedule (automatic)
 * - Manual collection requires admin authorization
 * - Collection history tracked per clan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireClanMembership,
  requireAdmin,
  getProjectedTerritoryIncome,
  collectDailyTerritoryIncome,
  logger,
} from '@/lib';

const getRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const GET = getRateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;

    // Get clanId from query
    const { searchParams } = new URL(request.url);
    const clanId = searchParams.get('clanId');

    if (!clanId) {
      return NextResponse.json(
        { error: 'clanId is required' },
        { status: 400 }
      );
    }

    // Get projected income
    const projection = await getProjectedTerritoryIncome(clanId);

    return NextResponse.json({
      success: true,
      ...projection,
    });

  } catch (error: unknown) {
    logger.error('Error getting territory income projection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get income projection';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
});

/**
 * POST /api/clan/territory/income
 * Manually trigger income collection (admin/testing only)
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with collection result or error
 * 
 * @example
 * POST /api/clan/territory/income
 * Body: { clanId: "676a1b2c3d4e5f6a7b8c9d0e", adminPassword: "..." }
 * Response: {
 *   success: true,
 *   metalCollected: 15000,
 *   energyCollected: 15000,
 *   territoryCount: 30,
 *   timestamp: "2025-01-23T10:30:00Z",
 *   message: "Collected 15000 metal and 15000 energy"
 * }
 * 
 * @throws {400} Missing clanId
 * @throws {401} Not authenticated
 * @throws {403} Not admin or invalid admin password
 * @throws {500} Server error
 */
export const POST = postRateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  try {
    const supabase = createServiceClient();
    const authResult = await requireAdmin(request, supabase);
    if (authResult instanceof NextResponse) return authResult;

    // Parse request body
    const body = await request.json();
    const { clanId, adminPassword } = body;

    if (!clanId) {
      return NextResponse.json(
        { error: 'clanId is required' },
        { status: 400 }
      );
    }

    // Verify admin password (additional security for testing)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD env var not set');
    if (adminPassword !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    // Collect income
    const collectionResult = await collectDailyTerritoryIncome(clanId);

    return NextResponse.json(collectionResult);
  } catch (error: unknown) {
    logger.error('Error collecting territory income:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to collect income';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
});
