/**
 * @file app/api/factory/status/route.ts
 * @created 2025-10-17
 * @rewritten 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 * @updated 2026-10-02 (FID-20261002-011 §5.3/§5.5: owner-balance regeneration at
 *            the shared effective rate, persisted under a row lock)
 * @overview Get factory information for a specific tile
 *
 * UPDATES:
 * - 2025-10-17: Added slot regeneration before returning factory data
 * - 2026-09-19: slot-regen persist rides drizzle (no shim updateOne)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFactoryData, collectAllFactoryIncome } from '@/lib/factoryService';
import { applySlotRegeneration, getAvailableSlots, getTimeUntilNextSlot, getFactoryCapacity, getSlotRegenBalanceMultiplier } from '@/lib/slotRegenService';
import { db } from '@/lib/db';
import { factories, players } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { authenticateRequest } from '@/lib/authMiddleware';
import { withTransactionRetry } from '@/lib/db/treasuryLock';
import { Factory } from '@/types';

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

    // FID-20261002-011 §5.3: the regen multiplier comes from the FACTORY
    // OWNER's army (current owner effects apply to each accrual calculation);
    // ownerless factories use the neutral multiplier. The same effective rate
    // then drives both the recovery and the countdown below.
    let balanceMultiplier = 1;
    if (factory.owner) {
      const [ownerRow] = await db
        .select({ totalStrength: players.totalStrength, totalDefense: players.totalDefense })
        .from(players)
        .where(eq(players.username, factory.owner))
        .limit(1);
      if (ownerRow) {
        balanceMultiplier = getSlotRegenBalanceMultiplier(ownerRow.totalStrength, ownerRow.totalDefense);
      }
    }

    const regenAt = new Date();

    // Apply regeneration against the LOCKED row and persist inside the same
    // FID-20261002-002 transaction — a concurrent build's reservation can
    // never be overwritten by this display-path snapshot (FID-20261002-011 §5.5).
    const regenerated = await withTransactionRetry('factoryStatusSlotRegen', () =>
      db.transaction(async (tx): Promise<Factory | null> => {
        const [lockedRow] = await tx
          .select()
          .from(factories)
          .where(and(eq(factories.x, x), eq(factories.y, y)))
          .limit(1)
          .for('update');
        if (!lockedRow) return factory;

        const regen = applySlotRegeneration(lockedRow as unknown as Factory, {
          now: regenAt,
          balanceMultiplier,
        });

        if (regen.usedSlots !== lockedRow.usedSlots) {
          await tx
            .update(factories)
            .set({
              usedSlots: regen.usedSlots,
              lastSlotRegen: regen.lastSlotRegen,
            })
            .where(and(eq(factories.x, x), eq(factories.y, y)));
        }
        return regen;
      })
    );
    if (regenerated) {
      factory = regenerated;
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

    // Calculate additional info — countdown at the SAME effective rate
    // (FID-20261002-011 §5.3)
    const availableSlots = getAvailableSlots(factory);
    const timeUntilNext = getTimeUntilNextSlot(factory, { balanceMultiplier });

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
