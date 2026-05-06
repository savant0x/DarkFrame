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
import { requireClanMembership, requireAdmin } from '@/lib/authMiddleware';
import {
  getProjectedTerritoryIncome,
  collectDailyTerritoryIncome,
} from '@/lib/territoryService';

/**
 * GET /api/clan/territory/income
 * View projected daily income from territories
 * 
 * @param request - NextRequest with auth cookie and query params
 * @returns NextResponse with income projection or error
 * 
 * @example
 * GET /api/clan/territory/income?clanId=676a1b2c3d4e5f6a7b8c9d0e
 * Response: {
 *   success: true,
 *   metalPerDay: 15000,
 *   energyPerDay: 15000,
 *   perTerritory: { metal: 500, energy: 500 },
 *   territoryCount: 30,
 *   clanLevel: 12,
 *   nextCollection: "2025-01-24T00:00:00Z",
 *   canCollectNow: false
 * }
 * 
 * @throws {400} Missing clanId
 * @throws {401} Not authenticated
 * @throws {403} Not a clan member
 * @throws {500} Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  } catch (error: any) {
    console.error('Error getting territory income projection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get income projection' },
      { status: 500 }
    );
  }
}

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
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    if (adminPassword !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Admin authorization required' },
        { status: 403 }
      );
    }

    // Collect income
    const collectionResult = await collectDailyTerritoryIncome(clanId);

    return NextResponse.json(collectionResult);

  } catch (error: any) {
    console.error('Error collecting territory income:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to collect income' },
      { status: 500 }
    );
  }
}
