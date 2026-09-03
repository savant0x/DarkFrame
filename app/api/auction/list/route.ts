/**
 * @file app/api/auction/list/route.ts
 * @created 2025-01-17
 * @overview Search and browse marketplace auctions
 * 
 * OVERVIEW:
 * Handles marketplace auction searches with comprehensive filtering and sorting.
 * Supports filtering by item type, unit type, resource type, price range,
 * buyout availability, and seller. Implements pagination for large result sets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuctions } from '@/lib/auctionService';
import { AuctionSearchFilters, AuctionItemType, ResourceType } from '@/types/auction.types';
import { UnitType } from '@/types';
import { logger } from '@/lib/logger';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/auction/list
 * 
 * Search marketplace auctions with filters
 * 
 * Query parameters:
 * - itemType?: "unit" | "resource" | "tradeable"
 * - unitType?: UnitType (e.g., "pike", "swordsman")
 * - resourceType?: "metal" | "energy"
 * - minPrice?: number
 * - maxPrice?: number
 * - hasBuyout?: boolean
 * - clanOnly?: boolean
 * - seller?: string (username)
 * - sortBy?: "price_asc" | "price_desc" | "ending_soon" | "newly_listed"
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * 
 * Success Response:
 * ```json
 * {
 *   "success": true,
 *   "auctions": AuctionListing[],
 *   "totalCount": number,
 *   "page": number,
 *   "totalPages": number
 * }
 * ```
 * 
 * Error Responses:
 * - 400: Invalid filter parameters
 * - 500: Server error
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('auction-list');
  const endTimer = log.time('auction-list');
  
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const params = url.searchParams;

    // Build filter object
    const filters: AuctionSearchFilters = {};

    // Item type filter
    const itemType = params.get('itemType');
    if (itemType) {
      if (!['unit', 'resource', 'tradeable'].includes(itemType)) {
        return NextResponse.json(
          { success: false, message: 'Invalid itemType. Must be: unit, resource, or tradeable' },
          { status: 400 }
        );
      }
      filters.itemType = itemType as AuctionItemType;
    }

    // Unit type filter (only valid if itemType=unit)
    const unitType = params.get('unitType');
    if (unitType) {
      filters.unitType = unitType as UnitType;
    }

    // Resource type filter (only valid if itemType=resource)
    const resourceType = params.get('resourceType');
    if (resourceType) {
      if (!['metal', 'energy'].includes(resourceType)) {
        return NextResponse.json(
          { success: false, message: 'Invalid resourceType. Must be: metal or energy' },
          { status: 400 }
        );
      }
      filters.resourceType = resourceType as ResourceType;
    }

    // Price range filters
    const minPrice = params.get('minPrice');
    if (minPrice) {
      const min = parseInt(minPrice, 10);
      if (isNaN(min) || min < 0) {
        return NextResponse.json(
          { success: false, message: 'minPrice must be a non-negative number' },
          { status: 400 }
        );
      }
      filters.minPrice = min;
    }

    const maxPrice = params.get('maxPrice');
    if (maxPrice) {
      const max = parseInt(maxPrice, 10);
      if (isNaN(max) || max < 0) {
        return NextResponse.json(
          { success: false, message: 'maxPrice must be a non-negative number' },
          { status: 400 }
        );
      }
      filters.maxPrice = max;
    }

    // Buyout filter
    const hasBuyout = params.get('hasBuyout');
    if (hasBuyout === 'true') {
      filters.hasBuyout = true;
    } else if (hasBuyout === 'false') {
      filters.hasBuyout = false;
    }

    // Clan-only filter (Phase 5)
    const clanOnly = params.get('clanOnly');
    if (clanOnly === 'true') {
      filters.clanOnly = true;
    }

    // Seller filter
    const seller = params.get('seller');
    if (seller) {
      filters.sellerUsername = seller;
    }

    // Sorting
    const sortBy = params.get('sortBy');
    if (sortBy) {
      const validSorts = ['price_asc', 'price_desc', 'ending_soon', 'newly_listed'];
      if (!validSorts.includes(sortBy)) {
        return NextResponse.json(
          { success: false, message: 'Invalid sortBy. Must be: price_asc, price_desc, ending_soon, or newly_listed' },
          { status: 400 }
        );
      }
      filters.sortBy = sortBy as 'price_asc' | 'price_desc' | 'ending_soon' | 'newly_listed';
    }

    // Pagination
    const page = parseInt(params.get('page') || '1', 10);
    const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100);

    if (page < 1 || limit < 1) {
      return NextResponse.json(
        { success: false, message: 'page and limit must be positive integers' },
        { status: 400 }
      );
    }

    filters.page = page;
    filters.limit = limit;

    // Execute search
    const result = await getAuctions(filters);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Calculate total pages
    const totalPages = Math.ceil((result.total || 0) / limit);

    return NextResponse.json({
      success: true,
      auctions: result.auctions,
      totalCount: result.total,
      page,
      totalPages
    });

  } catch (error) {
    log.error('Failed to fetch auctions', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - No authentication required (public marketplace)
// - Comprehensive filtering: type, price, buyout, seller
// - Flexible sorting: price, time (ending soon, newly listed)
// - Pagination: default 20 per page, max 100
// - Only returns active auctions (not sold/cancelled/expired)
// - Clan-only filter prepared for Phase 5
// ============================================================
// END OF FILE
// ============================================================
