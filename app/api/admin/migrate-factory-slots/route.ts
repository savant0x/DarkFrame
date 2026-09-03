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
import { db } from '@/lib/db';
import { factories } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const FACTORY_UPGRADE = {
  BASE_SLOTS: 5000,
  SLOTS_PER_LEVEL: 500
};

function getMaxSlots(level: number): number {
  return FACTORY_UPGRADE.BASE_SLOTS + ((level - 1) * FACTORY_UPGRADE.SLOTS_PER_LEVEL);
}

export async function POST(request: NextRequest) {
  try {
    const allFactories = await db.select().from(factories);
    
    if (allFactories.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No factories found in database'
      });
    }

    let modifiedCount = 0;

    for (const factory of allFactories) {
      const level = factory.level || 1;
      const newSlots = getMaxSlots(level);
      
      await db.update(factories)
        .set({ slots: newSlots })
        .where(and(eq(factories.x, factory.x), eq(factories.y, factory.y)));
      
      modifiedCount++;
    }

    const updatedFactories = await db.select().from(factories);
    
    const levelMap = new Map<number, { count: number, totalSlots: number }>();
    for (const factory of updatedFactories) {
      const level = factory.level || 1;
      const existing = levelMap.get(level) || { count: 0, totalSlots: 0 };
      existing.count++;
      existing.totalSlots += factory.slots || 0;
      levelMap.set(level, existing);
    }

    const levelSummary = Array.from(levelMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, data]) => ({
        level,
        count: data.count,
        slots: Math.round(data.totalSlots / data.count)
      }));

    return NextResponse.json({
      success: true,
      message: 'Factory slot migration complete',
      statistics: {
        totalFactories: allFactories.length,
        modified: modifiedCount,
        matched: modifiedCount,
        byLevel: levelSummary
      },
      formula: {
        old: '10 + ((level - 1) × 2)',
        new: '5000 + ((level - 1) × 500)'
      }
    });

  } catch (error) {
    console.error('Factory slot migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sampleFactories = await db.select().from(factories).limit(10);
    
    const preview = sampleFactories.map((factory) => {
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

    const allFactories = await db.select().from(factories);
    const totalCount = allFactories.length;

    return NextResponse.json({
      success: true,
      preview,
      totalFactories: totalCount,
      formula: {
        old: '10 + ((level - 1) × 2)',
        new: '5000 + ((level - 1) × 500)'
      },
      note: 'Use POST request to execute migration'
    });

  } catch (error) {
    console.error('Factory slot migration preview error:', error);
    return NextResponse.json({
      success: false,
      error: 'Preview failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
