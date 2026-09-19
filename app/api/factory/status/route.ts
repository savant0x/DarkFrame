/**
 * @file app/api/factory/status/route.ts
 * @created 2025-10-17
 * @rewritten 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 * @overview Get factory information for a specific tile
 *
 * UPDATES:
 * - 2025-10-17: Added slot regeneration before returning factory data
 * - 2026-09-19: slot-regen persist rides drizzle (no shim updateOne)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFactoryData, collectAllFactoryIncome } from '@/lib/factoryService';
import { applySlotRegeneration, getAvailableSlots, getTimeUntilNextSlot, getFactoryCapacity } from '@/lib/slotRegenService';
import { db } from '@/lib/db';
import { factories } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { authenticateRequest } from '@/lib/authMiddleware';

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
      await db
        .update(factories)
        .set({
          usedSlots: factory.usedSlots,
          lastSlotRegen: factory.lastSlotRegen,
        })
        .where(and(eq(factories.x, x), eq(factories.y, y)));
    }

    // FID-072 — Phase 5 income revival: viewing an owned factory pays its
    // accrued income (1,000 metal + 500 energy per level-hour since last
    // collection). Write-on-GET, same precedent as the slot-regen persist
    // above; the 1-minute guard in calculateFactoryIncome prevents spam, and
    // unauthenticated/anonymous views simply skip the accrual.
    let incomeGranted: { totalMetal: number; totalEnergy: number } | null = null;
    const auth = await authenticateRequest(request);
    if (auth?.username && factory.owner === auth.username) {
      try {
        const collected = await collectAllFactoryIncome(auth.username);
        if (collected.totalMetal > 0 || collected.totalEnergy > 0) {
          incomeGranted = { totalMetal: collected.totalMetal, totalEnergy: collected.totalEnergy };
        }
      } catch {
        // Income accrual must never block the status read.
      }
    }

    // Calculate additional info
    const availableSlots = getAvailableSlots(factory);
    const timeUntilNext = getTimeUntilNextSlot(factory);

    return NextResponse.json({
      success: true,
      factory,
      ...(incomeGranted ? { incomeGranted } : {}),
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
