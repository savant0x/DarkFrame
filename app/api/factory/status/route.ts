/**
 * @file app/api/factory/status/route.ts
 * @created 2025-10-17
 * @overview Get factory information for a specific tile
 * 
 * UPDATES:
 * - 2025-10-17: Added slot regeneration before returning factory data
 * - 2026-05-03: Migrated to Supabase (removed MongoDB/connectToDatabase)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  FACTORY_UPGRADE,
  applySlotRegeneration,
  consumeSlots,
  hasEnoughSlots,
  toFactoryType,
  getMaxSlots,
  getAvailableSlots,
  getTimeUntilNextSlot,
  getFactoryCapacity,
  getFactoryData,
  logger,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = rateLimiter(async (request: NextRequest) => {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const x = parseInt(searchParams.get('x') || '0');
    const y = parseInt(searchParams.get('y') || '0');
    
    if (!x || !y) {
      return NextResponse.json(
        { success: false, message: 'Missing coordinates' },
        { status: 400 }
      );
    }
    
    let row = await getFactoryData(x, y);
    
    if (!row) {
      return NextResponse.json(
        { success: false, message: 'Factory not found' },
        { status: 404 }
      );
    }
    
    // Convert to Factory type for slot regeneration processing
    let factory = toFactoryType(row);
    const levelCapacity = getMaxSlots(factory.level || 1);

    // Auto-correct stale DB state: sync slots column and cap used_slots
    const needsCorrection = row.slots !== levelCapacity || (factory.usedSlots || 0) > levelCapacity;
    if (needsCorrection) {
      await supabase
        .from('factories')
        .update({
          slots: levelCapacity,
          used_slots: Math.min(factory.usedSlots || 0, levelCapacity),
        })
        .eq('x', x)
        .eq('y', y);
      const { data: corrected } = await supabase
        .from('factories')
        .select('*')
        .eq('x', x)
        .eq('y', y)
        .maybeSingle();
      if (corrected) {
        factory = toFactoryType(corrected);
        row = corrected;
      }
    }

    const originalUsed = factory.usedSlots;
    factory = applySlotRegeneration(factory);
    
    // If usedSlots decreased, persist to Supabase
    if (factory.usedSlots !== originalUsed) {
      await supabase
        .from('factories')
        .update({
          used_slots: factory.usedSlots,
          last_slot_regen: factory.lastSlotRegen.toISOString(),
        })
        .eq('x', x)
        .eq('y', y);
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
    logger.error('Factory status error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
});

// ============================================================
// END OF FILE
// ============================================================
