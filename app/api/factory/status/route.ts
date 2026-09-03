/**
 * @file app/api/factory/status/route.ts
 * @created 2025-10-17
 * @overview Get factory information for a specific tile
 * 
 * UPDATES:
 * - 2025-10-17: Added slot regeneration before returning factory data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFactoryData } from '@/lib/factoryService';
import { applySlotRegeneration, getAvailableSlots, getTimeUntilNextSlot, getFactoryCapacity } from '@/lib/slotRegenService';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const x = parseInt(searchParams.get('x') || '0');
    const y = parseInt(searchParams.get('y') || '0');
    
    if (!x || !y) {
      return NextResponse.json(
        { success: false, message: 'Missing coordinates' },
        { status: 400 }
      );
    }
    
    let factory = await getFactoryData(x, y);
    
    if (!factory) {
      return NextResponse.json(
        { success: false, message: 'Factory not found' },
        { status: 404 }
      );
    }
    
    // Apply slot regeneration (new model: reduces usedSlots)
    const originalUsed = factory.usedSlots;
    factory = applySlotRegeneration(factory);
    
    // If usedSlots decreased, persist lastSlotRegen and usedSlots
    if (factory.usedSlots !== originalUsed) {
      const db = await connectToDatabase();
      await db.collection('factories').updateOne(
        { x, y },
        {
          $set: {
            usedSlots: factory.usedSlots,
            lastSlotRegen: factory.lastSlotRegen
          }
        }
      );
    }
    
    // Calculate additional info
    const availableSlots = getAvailableSlots(factory);
    const timeUntilNext = getTimeUntilNextSlot(factory);
    
    return NextResponse.json({
      success: true,
      factory,
      slotInfo: {
        available: availableSlots,
        max: getFactoryCapacity(factory),
        used: factory.usedSlots,
        current: availableSlots,
        timeUntilNext: timeUntilNext.totalMs > 0 ? {
          hours: timeUntilNext.hours,
          minutes: timeUntilNext.minutes,
          seconds: timeUntilNext.seconds
        } : null
      }
    });
  } catch (error) {
    console.error('Factory status error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// END OF FILE
// ============================================================
