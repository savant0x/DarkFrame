/**
 * @file app/api/clan/alliance/contract/route.ts
 * @created 2025-10-18
 * @updated 2025-01-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * 
 * OVERVIEW:
 * API endpoints for managing alliance contracts between clans.
 * Supports 4 contract types: Resource Sharing, Defense Pact, War Support, Joint Research.
 * 
 * ROUTES:
 * - POST /api/clan/alliance/contract - Add contract to alliance
 * - DELETE /api/clan/alliance/contract - Remove contract from alliance
 * 
 * AUTHENTICATION:
 * - requireClanMembership() for both handlers
 * - Permission check in service layer (Leader only)
 * 
 * BUSINESS RULES:
 * - Only Leaders can manage contracts
 * - Contract type must be allowed for alliance type
 * - Contract terms validated based on contract type
 * - Resource Sharing: 5-50% share percentage
 * - Defense Pact: auto-join defense flag
 * - War Support: metal/energy support amounts
 * - Joint Research: 5-30% RP share percentage
 */

import { NextRequest, NextResponse } from 'next/server';

import { createServiceClient } from '@/lib/supabase/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import {
  addContract,
  removeContract,
  ContractType,
} from '@/lib/clanAllianceService';

/**
 * POST /api/clan/alliance/contract
 * Add contract to alliance
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with updated alliance or error
 * 
 * @example
 * POST /api/clan/alliance/contract
 * Body: {
 *   allianceId: "alliance123",
 *   contractType: "RESOURCE_SHARING",
 *   terms: { resourceSharePercentage: 25 }
 * }
 * Response: {
 *   success: true,
 *   alliance: {
 *     _id: "alliance123",
 *     contracts: [{ type: "RESOURCE_SHARING", terms: {...} }]
 *   }
 * }
 * 
 * @example
 * POST /api/clan/alliance/contract
 * Body: {
 *   allianceId: "alliance123",
 *   contractType: "DEFENSE_PACT",
 *   terms: { autoJoinDefense: true }
 * }
 * 
 * @throws {400} Missing fields, invalid contract type, or not in clan
 * @throws {401} Not authenticated
 * @throws {403} Insufficient permissions (not Leader)
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
    const { allianceId, contractType, terms } = body;

    if (!allianceId || !contractType || !terms) {
      return NextResponse.json(
        { error: 'allianceId, contractType, and terms are required' },
        { status: 400 }
      );
    }

    if (!Object.values(ContractType).includes(contractType)) {
      return NextResponse.json({ error: 'Invalid contract type' }, { status: 400 });
    }

    // Add contract (service handles Leader permission check)
    const alliance = await addContract(allianceId, clanId, auth.playerId, contractType, terms);

    return NextResponse.json({
      success: true,
      alliance: {
        _id: alliance._id?.toString(),
        clanIds: alliance.clanIds,
        type: alliance.type,
        contracts: alliance.contracts,
      },
    });
  } catch (error: any) {
    console.error('Add contract error:', error);
    return NextResponse.json({ error: error.message || 'Failed to add contract' }, { status: 500 });
  }
}

/**
 * DELETE /api/clan/alliance/contract
 * Remove contract from alliance
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with updated alliance or error
 * 
 * @example
 * DELETE /api/clan/alliance/contract
 * Body: { allianceId: "alliance123", contractType: "DEFENSE_PACT" }
 * Response: {
 *   success: true,
 *   alliance: {
 *     _id: "alliance123",
 *     contracts: []
 *   }
 * }
 * 
 * @throws {400} Missing allianceId/contractType or not in clan
 * @throws {401} Not authenticated
 * @throws {403} Insufficient permissions (not Leader)
 * @throws {404} Contract not found
 * @throws {500} Server error
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Parse and validate request body
    const body = await request.json();
    const { allianceId, contractType } = body;

    if (!allianceId || !contractType) {
      return NextResponse.json(
        { error: 'allianceId and contractType are required' },
        { status: 400 }
      );
    }

    // Remove contract (service handles Leader permission check)
    const alliance = await removeContract(allianceId, clanId, auth.playerId, contractType);

    return NextResponse.json({
      success: true,
      alliance: {
        _id: alliance._id?.toString(),
        clanIds: alliance.clanIds,
        type: alliance.type,
        contracts: alliance.contracts,
      },
    });
  } catch (error: any) {
    console.error('Remove contract error:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove contract' }, { status: 500 });
  }
}

