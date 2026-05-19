/**
 * Beer Base Admin API
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Admin endpoints for managing Beer Base system. Allows configuration updates,
 * manual respawn triggers, and statistics viewing.
 * 
 * ENDPOINTS:
 * GET  /api/beer-bases       - Get Beer Base statistics
 * POST /api/beer-bases       - Manual respawn trigger
 * PUT  /api/beer-bases       - Update configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import {
  getBeerBaseStats,
  manualBeerBaseRespawn,
  updateBeerBaseConfig,
  type BeerBaseConfig,
} from '@/lib/beerBaseService';
import { logger } from '@/lib';

/**
 * GET /api/beer-bases
 * Get Beer Base statistics and configuration
 */
export async function GET(request: NextRequest) {
  try {
    const stats = await getBeerBaseStats();

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    logger.error('Failed to get Beer Base stats:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve Beer Base statistics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/beer-bases
 * Trigger manual Beer Base respawn
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const result = await manualBeerBaseRespawn();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `🍺 Beer Base respawn complete! Removed ${result.removed} old bases, spawned ${result.spawned} new ones.`,
        removed: result.removed,
        spawned: result.spawned,
        beerBases: result.beerBases,
      });
    } else {
      return NextResponse.json(
        { success: false, message: 'Beer Base respawn failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Failed to trigger Beer Base respawn:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to trigger respawn' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/beer-bases
 * Update Beer Base configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const updates: Partial<BeerBaseConfig> = {};

    // Validate and apply updates
    if (typeof body.spawnRateMin === 'number' && body.spawnRateMin >= 0 && body.spawnRateMin <= 100) {
      updates.spawnRateMin = body.spawnRateMin;
    }

    if (typeof body.spawnRateMax === 'number' && body.spawnRateMax >= 0 && body.spawnRateMax <= 100) {
      updates.spawnRateMax = body.spawnRateMax;
    }

    if (typeof body.resourceMultiplier === 'number' && body.resourceMultiplier >= 1 && body.resourceMultiplier <= 10) {
      updates.resourceMultiplier = body.resourceMultiplier;
    }

    if (typeof body.respawnDay === 'number' && body.respawnDay >= 0 && body.respawnDay <= 6) {
      updates.respawnDay = body.respawnDay;
    }

    if (typeof body.respawnHour === 'number' && body.respawnHour >= 0 && body.respawnHour <= 23) {
      updates.respawnHour = body.respawnHour;
    }

    if (typeof body.enabled === 'boolean') {
      updates.enabled = body.enabled;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid configuration updates provided' },
        { status: 400 }
      );
    }

    await updateBeerBaseConfig(updates);

    return NextResponse.json({
      success: true,
      message: 'Beer Base configuration updated successfully',
      updates,
    });
  } catch (error) {
    logger.error('Failed to update Beer Base config:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
// Admin API for Beer Base management:
// 
// GET: Returns current stats including:
//   - Current count vs target count
//   - Configuration settings
//   - Next scheduled respawn time
//   - List of all Beer Bases with details
// 
// POST: Manual respawn trigger
//   - Removes all existing Beer Bases
//   - Spawns new ones based on current config
//   - Returns count of removed and spawned
// 
// PUT: Configuration updates
//   - spawnRateMin/Max: 0-100%
//   - resourceMultiplier: 1-10x
//   - respawnDay: 0-6 (Sunday-Saturday)
//   - respawnHour: 0-23
//   - enabled: true/false
// ============================================================
