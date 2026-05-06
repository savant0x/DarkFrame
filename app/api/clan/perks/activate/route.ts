/**
 * @file app/api/clan/perks/activate/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Refactored to use centralized auth + JSDoc)
 * 
 * OVERVIEW:
 * Clan perk activation/deactivation endpoint. Manages active clan perks with validation.
 * Validates permissions, level requirements, costs, and active perk limits.
 * 
 * ROUTES:
 * - POST /api/clan/perks/activate - Activate or deactivate clan perk
 * 
 * AUTHENTICATION:
 * - Requires clan membership via requireClanMembership()
 * 
 * BUSINESS RULES:
 * - Only Leader, Co-Leader, and Officer can manage perks
 * - Must meet clan level requirements for perk tier
 * - Must have sufficient bank balance for activation cost
 * - Limited active perks per tier (Bronze: 2, Silver: 3, Gold: 4)
 * - All perk changes logged to activity feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireClanMembership } from '@/lib';
import {
  activatePerk,
  deactivatePerk,
} from '@/lib/clanPerkService';

/**
 * POST /api/clan/perks/activate
 * Activate or deactivate a clan perk
 * 
 * @param request - NextRequest with authentication cookie and perk action in body
 * @returns NextResponse with perk activation result
 * 
 * @example
 * POST /api/clan/perks/activate (Activate)
 * Body: { action: "activate", perkId: "harvest_boost_bronze" }
 * Response: { success: true, action: "activate", perk: {...}, message: "Perk activated successfully" }
 * 
 * @example
 * POST /api/clan/perks/activate (Deactivate)
 * Body: { action: "deactivate", perkId: "harvest_boost_bronze" }
 * Response: { success: true, action: "deactivate", perkId: "...", message: "Perk deactivated" }
 * 
 * @throws {400} Missing action or perkId
 * @throws {400} Invalid action (must be activate/deactivate)
 * @throws {400} Insufficient bank balance
 * @throws {400} Clan level too low
 * @throws {400} Active perk limit reached
 * @throws {401} Unauthorized
 * @throws {403} Insufficient permissions (Leader/Officer only)
 * @throws {404} Perk not found
 * @throws {500} Failed to activate/deactivate perk
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    const result = await requireClanMembership(request, supabase);
    if (result instanceof NextResponse) return result;
    const { auth, clanId } = result;

    const body = await request.json();
    const { action, perkId } = body;

    if (!action || !perkId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, perkId' },
        { status: 400 }
      );
    }

    if (action !== 'activate' && action !== 'deactivate') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "activate" or "deactivate"' },
        { status: 400 }
      );
    }

    if (action === 'activate') {
      try {
        const activationResult = await activatePerk(clanId, auth.playerId, perkId);

        return NextResponse.json(
          {
            success: true,
            action: 'activate',
            perk: {
              id: activationResult.perk.id,
              name: activationResult.perk.name,
              description: activationResult.perk.description,
              category: activationResult.perk.category,
              tier: activationResult.perk.tier,
              bonus: activationResult.perk.bonus,
            },
            costPaid: activationResult.costPaid,
            remainingSlots: 4 - activationResult.clan.activePerks.length,
            message: activationResult.message,
          },
          { status: 200 }
        );
      } catch (error: any) {
        if (error.message.includes('not a member')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Insufficient permissions')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (
          error.message.includes('already active') ||
          error.message.includes('must be level') ||
          error.message.includes('not unlocked') ||
          error.message.includes('Maximum active perks') ||
          error.message.includes('Insufficient')
        ) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('not found')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        throw error;
      }
    } else {
      try {
        const deactivationResult = await deactivatePerk(clanId, auth.playerId, perkId);

        return NextResponse.json(
          {
            success: true,
            action: 'deactivate',
            perkName: deactivationResult.perkName,
            remainingSlots: 4 - deactivationResult.clan.activePerks.length,
            message: deactivationResult.message,
          },
          { status: 200 }
        );
      } catch (error: any) {
        if (error.message.includes('not a member')) {
          return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes('Insufficient permissions')) {
          return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes('not currently active')) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }
  } catch (error: any) {
    console.error('Error managing clan perk:', error);
    return NextResponse.json(
      { error: 'Failed to manage clan perk', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Permission Requirements:
 * - Only Leader, Co-Leader, and Officer can activate/deactivate perks
 * - Validated in activatePerk/deactivatePerk functions via hasPermission('canManageResearch')
 * 
 * Activation Validation:
 * 1. Perk exists in catalog
 * 2. Perk not already active
 * 3. Clan level >= perk.requiredLevel
 * 4. Perk tier unlocked (Bronze: 5, Silver: 10, Gold: 15, Legendary: 20)
 * 5. Active perk count < MAX_ACTIVE_PERKS (4)
 * 6. Bank has sufficient resources (metal, energy, RP)
 * 
 * Deactivation Rules:
 * - No refund on deactivation (resources spent are gone)
 * - Instant effect (perk removed immediately)
 * - Frees up slot for different perk
 * - No cooldown (can reactivate immediately if bank has resources)
 * 
 * Response Examples:
 * 
 * Activation Success:
 * {
 *   "success": true,
 *   "action": "activate",
 *   "perk": {
 *     "id": "combat_silver_conqueror",
 *     "name": "Silver Conqueror",
 *     "description": "+10% attack damage for all clan members",
 *     "category": "COMBAT",
 *     "tier": "SILVER",
 *     "bonus": { "type": "attack", "value": 10 }
 *   },
 *   "costPaid": {
 *     "metal": 250000,
 *     "energy": 250000,
 *     "researchPoints": 25000
 *   },
 *   "remainingSlots": 2,
 *   "message": "Silver Conqueror activated! +10% attack damage for all clan members"
 * }
 * 
 * Activation Error (Insufficient Funds):
 * {
 *   "error": "Insufficient metal in bank (need 250000, have 100000)"
 * }
 * 
 * Activation Error (Level Requirement):
 * {
 *   "error": "Clan must be level 15 to activate this perk"
 * }
 * 
 * Activation Error (Perk Limit):
 * {
 *   "error": "Maximum active perks reached (4). Deactivate a perk first."
 * }
 * 
 * Deactivation Success:
 * {
 *   "success": true,
 *   "action": "deactivate",
 *   "perkName": "Bronze Berserker",
 *   "remainingSlots": 3,
 *   "message": "Bronze Berserker deactivated. Perk slot freed."
 * }
 * 
 * Deactivation Error:
 * {
 *   "error": "Perk is not currently active"
 * }
 * 
 * Permission Error:
 * {
 *   "error": "Insufficient permissions to activate perks"
 * }
 * 
 * Usage Flow:
 * 1. Client calls GET /api/clan/perks/available to see available perks
 * 2. User selects perk to activate
 * 3. Client calls POST /api/clan/perks/activate with { action: 'activate', perkId: '...' }
 * 4. Server validates and activates perk, deducting cost
 * 5. Client refreshes perk list to show new active perk
 * 6. To swap perks, deactivate old perk first, then activate new one
 */
