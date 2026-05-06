/**
 * @file app/api/clan/perks/available/route.ts
 * @created 2025-10-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * GET endpoint to retrieve all available perks for a clan based on level.
 * Shows unlocked perks (can activate), locked perks (need higher level),
 * currently active perks, and perk recommendations based on clan stats.
 * 
 * ROUTES:
 * - GET /api/clan/perks/available - Retrieve perk catalog with filters
 * 
 * AUTHENTICATION:
 * - requireClanMembership() - Any clan member can view perks
 * 
 * BUSINESS RULES:
 * - Unlocked perks: Can be activated if sufficient resources
 * - Locked perks: Show required level and cost (informational)
 * - Active perks: Currently providing bonuses to clan members
 * - Maximum 4 active perks allowed (4 slots)
 * - Filters: category (COMBAT/ECONOMIC/SOCIAL/STRATEGIC), tier (BRONZE/SILVER/GOLD/LEGENDARY)
 * - Optional recommendations based on clan stats and resource levels
 * - Optional tier cost breakdowns showing total cost per tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import {
  getAvailablePerks,
  getActivePerks,
  calculateTierCost,
  getRecommendedPerks,
} from '@/lib/clanPerkService';
import { ClanPerkCategory, ClanPerkTier } from '@/types/clan.types';

/**
 * GET /api/clan/perks/available
 * Retrieve all available perks for authenticated player's clan
 * 
 * @param request - NextRequest with auth cookie and optional query parameters
 * @returns NextResponse with perk catalog or error
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    
    const { clan, clanId } = result;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category');
    const tierFilter = searchParams.get('tier');
    const includeRecommendations = searchParams.get('recommendations') === 'true';
    const includeCosts = searchParams.get('costs') === 'true';

    // Get available perks
    const availablePerks = await getAvailablePerks(clanId);
    const activePerks = await getActivePerks(clanId);

    // Apply filters if specified
    let unlockedPerks = availablePerks.unlocked;
    let lockedPerks = availablePerks.locked;

    if (categoryFilter) {
      const category = categoryFilter.toUpperCase() as ClanPerkCategory;
      if (!Object.values(ClanPerkCategory).includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${Object.values(ClanPerkCategory).join(', ')}` },
          { status: 400 }
        );
      }
      unlockedPerks = unlockedPerks.filter((p) => p.category === category);
      lockedPerks = lockedPerks.filter((p) => p.category === category);
    }

    if (tierFilter) {
      const tier = tierFilter.toUpperCase() as ClanPerkTier;
      if (!Object.values(ClanPerkTier).includes(tier)) {
        return NextResponse.json(
          { error: `Invalid tier. Must be one of: ${Object.values(ClanPerkTier).join(', ')}` },
          { status: 400 }
        );
      }
      unlockedPerks = unlockedPerks.filter((p) => p.tier === tier);
      lockedPerks = lockedPerks.filter((p) => p.tier === tier);
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      clanId,
      clanName: clan.name,
      clanTag: clan.tag,
      clanLevel: clan.clan_level,
      perks: {
        unlocked: unlockedPerks,
        locked: lockedPerks,
        active: activePerks.perks,
        activeCount: availablePerks.activeCount,
        maxActive: availablePerks.maxActive,
        slotsRemaining: availablePerks.maxActive - availablePerks.activeCount,
      },
      totalBonuses: activePerks.totalBonuses,
    };

    // Add recommendations if requested
    if (includeRecommendations) {
      const recommendations = await getRecommendedPerks(clanId);
      response.recommendations = recommendations;
    }

    // Add tier costs if requested
    if (includeCosts) {
      response.tierCosts = {
        BRONZE: calculateTierCost(ClanPerkTier.BRONZE),
        SILVER: calculateTierCost(ClanPerkTier.SILVER),
        GOLD: calculateTierCost(ClanPerkTier.GOLD),
        LEGENDARY: calculateTierCost(ClanPerkTier.LEGENDARY),
      };
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching available perks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available perks', details: error.message },
      { status: 500 }
    );
  }
}
