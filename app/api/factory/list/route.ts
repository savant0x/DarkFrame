/**
 * Factory List API Endpoint
 * Created: 2025-10-17 (Enhanced for upgrade system)
 * 
 * OVERVIEW:
 * GET endpoint to retrieve all factories owned by the authenticated player.
 * Returns comprehensive factory data including location, level, stats,
 * upgrade costs, and current production status. Used by Factory Management Panel.
 * 
 * QUERY PARAMETERS:
 * - username: string (required) - Player username
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
import { connectToDatabase } from '@/lib/mongodb';
import {
  calculateUpgradeCost,
  getFactoryStats,
  getUpgradeProgress,
  calculateCumulativeCost,
  FACTORY_UPGRADE
} from '@/lib/factoryUpgradeService';
import { applySlotRegeneration, getTimeUntilNextSlot, getAvailableSlots } from '@/lib/slotRegenService';
import { Factory, FactoryStats } from '@/types/game.types';
import type { Player } from '@/types/game.types';

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

    // Connect to database
    const db = await connectToDatabase();
    const factoriesCollection = db.collection<Factory>('factories');
    const playersCollection = db.collection<Player>('players');

    // Get player's current resources for upgrade affordability checks
    const player = await playersCollection.findOne({ username });
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const playerMetal = player.resources?.metal || 0;
    const playerEnergy = player.resources?.energy || 0;

    // Find all factories owned by player
    const factories = await factoriesCollection
      .find({ owner: username })
      .toArray();

    // Calculate total investment across all factories
    let totalMetalInvested = 0;
    let totalEnergyInvested = 0;

    // Enhance factory data with stats, costs, and upgrade info
    const enhancedFactories: FactoryResponse[] = factories.map((factory: Factory) => {
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
      
      // Calculate investment in this factory
      if (currentLevel > 1) {
        const cumulativeCost = calculateCumulativeCost(currentLevel);
        totalMetalInvested += cumulativeCost.metal;
        totalEnergyInvested += cumulativeCost.energy;
      }
      
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
        timeUntilNextSlot: timeUntilNext // Return full object with hours, minutes, seconds, totalMs
      };
    });

    // Sort by level (descending), then by location
    enhancedFactories.sort((a: FactoryResponse, b: FactoryResponse) => {
      const levelDiff = (b.factory.level || 1) - (a.factory.level || 1);
      if (levelDiff !== 0) return levelDiff;
      
      // If levels are equal, sort by location (Y first, then X)
      const yDiff = a.factory.y - b.factory.y;
      if (yDiff !== 0) return yDiff;
      
      return a.factory.x - b.factory.x;
    });

    const factoryCount = factories.length;
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
// Implementation Notes:
// - Returns all factories owned by username
// - Includes factory position, stats, and production info
// - Useful for factory management UI
// - Supports inventory/asset tracking
// ============================================================
