/**
 * Factory List API Endpoint
 * Created: 2025-10-17 (Enhanced for upgrade system)
 * Rewritten: 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * GET endpoint to retrieve all factories owned by the authenticated player.
 * Returns comprehensive factory data including location, level, stats,
 * upgrade costs, and current production status. Used by Factory Management Panel.
 *
 * RESPONSE:
 * {
 *   "success": true,
 *   "factories": EnhancedFactory[],  // All owned factories with upgrade data
 *   "count": number,                 // Total factories owned
 *   "maxFactories": number,          // Maximum allowed (10)
 *   "canClaimMore": boolean,         // True if < 10 factories
 *   "totalInvestment": {             // Cumulative costs across all factories
 *     "metal": number,
 *     "energy": number
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { factories, players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  calculateUpgradeCost,
  getFactoryStats,
  getUpgradeProgress,
  FACTORY_UPGRADE
} from '@/lib/factoryUpgradeService';
import { applySlotRegeneration, getTimeUntilNextSlot, getAvailableSlots } from '@/lib/slotRegenService';
import { Factory, FactoryStats } from '@/types/game.types';

/**
 * Enhanced factory response with upgrade information
 */
interface FactoryResponse {
  factory: Factory;
  stats: FactoryStats;
  upgradeCost: { metal: number; energy: number } | null;
  canUpgrade: boolean;
  upgradeProgress: {
    level: number;
    percentage: number;
    slotsUsed: number;
    slotsRequired: number;
  };
  availableSlots: number;
  timeUntilNextSlot: {
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
  };
  /** FID-20260909-032 §H: upgrade + reconstructed production spend for this factory. */
  invested: { metal: number; energy: number };
}

export async function GET(_request: NextRequest) {
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

    // Get player's current resources for upgrade affordability checks
    // (direct pg read over the flat resource columns)
    const [player] = await db
      .select({
        resourcesMetal: players.resourcesMetal,
        resourcesEnergy: players.resourcesEnergy,
      })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const playerMetal = player.resourcesMetal || 0;
    const playerEnergy = player.resourcesEnergy || 0;

    // Find all factories owned by player
    const factoryRows = await db.select().from(factories).where(eq(factories.owner, username));
    const ownedFactories = factoryRows as unknown as Factory[];

    // Calculate total investment across all factories
    let totalMetalInvested = 0;
    let totalEnergyInvested = 0;

    // Enhance factory data with stats, costs, and upgrade info
    const enhancedFactories: FactoryResponse[] = ownedFactories.map((factory: Factory) => {
      const currentLevel = factory.level || 1;
      const stats = getFactoryStats(currentLevel);

      // Apply slot regeneration before returning (use updated instance)
      const regenFactory = applySlotRegeneration(factory);

      // Calculate time until next slot
      const timeUntilNext = getTimeUntilNextSlot(regenFactory);

      // Calculate upgrade info
      let upgradeCost = null;
      let canUpgrade = false;

      if (currentLevel < FACTORY_UPGRADE.MAX_LEVEL) {
        upgradeCost = calculateUpgradeCost(currentLevel);
        canUpgrade = playerMetal >= upgradeCost.metal && playerEnergy >= upgradeCost.energy;
      }

      // FID-20260909-032 §7: exact lifetime investment, maintained at write
      // time by build-unit/upgrade ($inc SQL deltas) and seeded for pre-column
      // rows by the migration-0020 backfill. Abandon/release zero it on reset.
      const factoryInvested = {
        metal: Number(factory.investedMetal ?? 0),
        energy: Number(factory.investedEnergy ?? 0),
      };
      totalMetalInvested += factoryInvested.metal;
      totalEnergyInvested += factoryInvested.energy;

      // Build upgrade progress object with all required fields
      const upgradePercentage = getUpgradeProgress(regenFactory);
      const upgradeProgress = {
        level: currentLevel,
        percentage: upgradePercentage,
        slotsUsed: regenFactory.usedSlots,
        slotsRequired: stats.maxSlots // FactoryStats uses maxSlots, not slots
      };

      return {
        factory: regenFactory,
        stats,
        upgradeCost,
        canUpgrade,
        upgradeProgress,
        availableSlots: getAvailableSlots(regenFactory),
        timeUntilNextSlot: timeUntilNext, // Return full object with hours, minutes, seconds, totalMs
        invested: factoryInvested // FID-20260909-032 §H
      };
    });

    // Sort by level (descending), then by location (Y first, then X)
    enhancedFactories.sort((a: FactoryResponse, b: FactoryResponse) => {
      const levelDiff = (b.factory.level || 1) - (a.factory.level || 1);
      if (levelDiff !== 0) return levelDiff;

      // If levels are equal, sort by location (Y first, then X)
      const yDiff = a.factory.y - b.factory.y;
      if (yDiff !== 0) return yDiff;

      return a.factory.x - b.factory.x;
    });

    const factoryCount = ownedFactories.length;
    const canClaimMore = factoryCount < FACTORY_UPGRADE.MAX_FACTORIES_PER_PLAYER;

    return NextResponse.json({
      success: true,
      factories: enhancedFactories,
      count: factoryCount,
      maxFactories: FACTORY_UPGRADE.MAX_FACTORIES_PER_PLAYER,
      canClaimMore,
      totalInvestment: {
        metal: totalMetalInvested,
        energy: totalEnergyInvested,
        total: totalMetalInvested + totalEnergyInvested
      },
      playerResources: {
        metal: playerMetal,
        energy: playerEnergy
      }
    });

  } catch (error) {
    console.error('Factory list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while fetching factory list',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 *
 * 1. Slot Regeneration:
 *    - Applied to each factory before returning
 *    - Ensures accurate slot availability display
 *    - Time until next slot calculated for UI countdowns
 *
 * 2. Upgrade Affordability:
 *    - Checked against player's current resources
 *    - Same resources used for all factories (shared pool)
 *    - Helps UI enable/disable upgrade buttons
 *
 * 3. Investment Tracking:
 *    - Calculates total resources spent on all factories
 *    - Shows cumulative investment across empire
 *    - Useful for strategic decision-making
 *
 * 4. Sorting Strategy:
 *    - Primary: Level (highest first) - shows best factories first
 *    - Secondary: Location (Y, then X) - geographic organization
 *    - Makes high-value factories easy to find
 */
