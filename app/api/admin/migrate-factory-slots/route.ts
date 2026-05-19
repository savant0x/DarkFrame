/**
 * @file app/api/admin/migrate-factory-slots/route.ts
 * @created 2025-11-04
 * @overview ONE-TIME admin migration endpoint to update factory slot capacity
 * 
 * OVERVIEW:
 * Updates all existing factories in the database to use the new exponential
 * slot cost system capacity values (5000 base + 500 per level).
 * 
 * This endpoint should be called ONCE after deploying the slot cost changes.
 * Factories are static map tiles, so existing data needs updating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { logger } from '@/lib';

const FACTORY_UPGRADE = {
  BASE_SLOTS: 5000,
  SLOTS_PER_LEVEL: 500
};

function getMaxSlots(level: number): number {
  return FACTORY_UPGRADE.BASE_SLOTS + ((level - 1) * FACTORY_UPGRADE.SLOTS_PER_LEVEL);
}

/**
 * POST /api/admin/migrate-factory-slots
 * One-time migration to update all factory slot capacities
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createServiceClient();

    // Get all factories
    const { data: factories, error: fetchError } = await supabase
      .from('factories')
      .select('*');

    if (fetchError) {
      throw fetchError;
    }
    
    if (!factories || factories.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No factories found in database'
      });
    }

    // Update factories in parallel
    let modifiedCount = 0;
    const updateResults = await Promise.all(
      factories.map(async (factory) => {
        const level = factory.level || 1;
        const newSlots = getMaxSlots(level);

        const { error: updateError } = await supabase
          .from('factories')
          .update({ slots: newSlots })
          .eq('id', factory.id);

        if (!updateError) {
          modifiedCount++;
        }

        return { error: updateError, factory };
      })
    );

    // Get summary by level — process in JS
    const levelMap = new Map<number, { count: number; totalSlots: number }>();

    for (const { factory } of updateResults) {
      const level = factory.level || 1;
      const slots = getMaxSlots(level);

      const existing = levelMap.get(level) || { count: 0, totalSlots: 0 };
      existing.count++;
      existing.totalSlots += slots;
      levelMap.set(level, existing);
    }

    const levelSummary = Array.from(levelMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, data]) => ({
        level,
        count: data.count,
        slots: Math.round(data.totalSlots / data.count),
      }));

    return NextResponse.json({
      success: true,
      message: 'Factory slot migration complete',
      statistics: {
        totalFactories: factories.length,
        modified: modifiedCount,
        matched: factories.length,
        byLevel: levelSummary,
      },
      formula: {
        old: '10 + ((level - 1) × 2)',
        new: '5000 + ((level - 1) × 500)'
      }
    });

  } catch (error) {
    logger.error('Factory slot migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/migrate-factory-slots
 * Preview what the migration will do (doesn't update anything)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Get sample factories (limit 10)
    const { data: factories, error: fetchError } = await supabase
      .from('factories')
      .select('*')
      .limit(10);

    if (fetchError) {
      throw fetchError;
    }

    const preview = (factories || []).map((factory) => {
      const level = factory.level || 1;
      const oldSlots = factory.slots || 10;
      const newSlots = getMaxSlots(level);
      
      return {
        location: `(${factory.x}, ${factory.y})`,
        owner: factory.owner || 'unclaimed',
        level,
        oldSlots,
        newSlots,
        change: newSlots - oldSlots
      };
    });

    // Get total count
    const { count: totalCount } = await supabase
      .from('factories')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      preview,
      totalFactories: totalCount || 0,
      formula: {
        old: '10 + ((level - 1) × 2)',
        new: '5000 + ((level - 1) × 500)'
      },
      note: 'Use POST request to execute migration'
    });

  } catch (error) {
    logger.error('Factory slot migration preview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Preview failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
