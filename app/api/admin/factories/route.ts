/**
 * Admin Factories Endpoint
 * Created: 2025-01-18
 * Updated: 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 
 * OVERVIEW:
 * Returns list of all factories in the game for admin inspection.
 * Provides comprehensive factory data including location, owner, production rates,
 * current production, and activity status.
 * 
 * Endpoint: GET /api/admin/factories
 * Rate Limited: 500 req/min (admin dashboard)
 * Auth Required: Admin (rank >= 5)
 * 
 * Returns:
 * {
 *   factories: FactoryData[],
 *   total: number
 * }
 * 
 * Factory Data Structure:
 * - x, y: Map coordinates
 * - ownerUsername: Player who owns the factory
 * - tier: Factory tier (tier1, tier2, tier3)
 * - productionRate: Units per hour
 * - lastProduction: Last production timestamp
 * - currentProduction: Resources waiting for collection
 * - resourceType: 'metal' or 'energy'
 * - isActive: Whether factory is currently producing
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { factories } from '@/lib/db/schema';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/**
 * GET handler - Fetch all factories
 * 
 * Admin-only endpoint that returns comprehensive factory data for inspection.
 * Joins with players collection to get owner details.
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('AdminFactoriesAPI');
  const endTimer = log.time('factories');

  try {
    const { getAuthenticatedUser } = await import('@/lib/authMiddleware');
    const user = await getAuthenticatedUser();

    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin access required',
      });
    }

    const factoriesList = await db.select().from(factories).limit(10000);

    const factoriesData = factoriesList.map((factory) => {
      const lastProduction = factory.lastResourceGeneration
        ? new Date(factory.lastResourceGeneration).toISOString()
        : new Date().toISOString();

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const lastProdTime = factory.lastResourceGeneration
        ? new Date(factory.lastResourceGeneration).getTime()
        : 0;
      const isActive = lastProdTime > twoHoursAgo;

      let productionRate = 10;
      if (factory.level === 2) productionRate = 25;
      if (factory.level === 3) productionRate = 50;

      if (factory.productionRate !== undefined) {
        productionRate = Number(factory.productionRate);
      }

      return {
        _id: `${factory.x}-${factory.y}`,
        x: factory.x || 0,
        y: factory.y || 0,
        ownerUsername: factory.owner || 'Unknown',
        tier: `tier${factory.level || 1}`,
        productionRate,
        lastProduction,
        currentProduction: 0,
        resourceType: 'metal',
        isActive,
      };
    });

    log.info('Factories retrieved', {
      total: factoriesData.length,
      adminUser: user.username,
    });

    return NextResponse.json({
      factories: factoriesData,
      total: factoriesData.length,
    });
  } catch (error) {
    log.error('Failed to fetch factories', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * 
 * Database Schema:
 * - factories table with fields:
 *   * x, y: number (coordinates, composite primary key)
 *   * owner: string
 *   * defense: number
 *   * level: number (1-3, maps to old tier system)
 *   * slots: number
 *   * usedSlots: number
 *   * productionRate: decimal
 *   * lastSlotRegen: Date
 *   * lastResourceGeneration: Date
 *   * lastAttackedBy: string
 *   * lastAttackTime: Date
 * 
 * Activity Calculation:
 * - Factory is "active" if produced within last 2 hours
 * - This helps identify abandoned or broken factories
 * 
 * Production Rate Defaults:
 * - Level 1: 10 units/hour
 * - Level 2: 25 units/hour
 * - Level 3: 50 units/hour
 * - Can be overridden by explicit productionRate field
 * 
 * Future Enhancements:
 * - Add query params for server-side filtering
 * - Pagination with skip/limit
 * - Sorting options (by production, by tier, by owner)
 * - Aggregate production statistics
 * - Owner details from players collection (requires join)
 * 
 * Performance:
 * - Limit of 10,000 factories prevents excessive data transfer
 * - Client-side filtering for fast UX
 * - Consider adding indexes on: owner, level, lastResourceGeneration
 */
