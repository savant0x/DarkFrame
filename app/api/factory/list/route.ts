/**
 * Factory List API Endpoint
 * Created: 2025-10-17
 * Updated: 2026-05-03 — Migrated to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  calculateUpgradeCost,
  getFactoryStats,
  getMaxSlots,
  getUpgradeProgress,
  calculateCumulativeCost,
  FACTORY_UPGRADE
} from '@/lib/factoryUpgradeService';
import { applySlotRegeneration, getTimeUntilNextSlot, getAvailableSlots } from '@/lib/slotRegenService';
import { Factory, FactoryStats } from '@/types/game.types';

interface FactoryResponse {
  factory: Factory;
  stats: FactoryStats;
  upgradeCost: { metal: number; energy: number; level: number } | null;
  canUpgrade: boolean;
  upgradeProgress: number;
  availableSlots: number;
  timeUntilNextSlot: {
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
  };
}

function toFactoryType(row: Record<string, unknown>): Factory {
  return {
    x: row.x as number,
    y: row.y as number,
    owner: row.owner as string,
    defense: row.defense as number,
    level: (row.level as number) || 1,
    slots: (row.slots as number) || 0,
    usedSlots: (row.used_slots as number) || 0,
    productionRate: (row.production_rate as number) || 0,
    lastSlotRegen: new Date((row.last_slot_regen as string) || Date.now()),
    lastResourceGeneration: new Date((row.last_resource_generation as string) || Date.now()),
    lastAttackedBy: row.last_attacked_by as string | undefined,
    lastAttackTime: row.last_attack_time ? new Date(row.last_attack_time as string) : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('resources_metal, resources_energy')
      .eq('username', username)
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const playerMetal = (player.resources_metal as number) || 0;
    const playerEnergy = (player.resources_energy as number) || 0;

    const { data: factoryRows, error: facError } = await supabase
      .from('factories')
      .select('*')
      .eq('owner', username);

    if (facError) throw facError;

    const factories = (factoryRows || []).map(toFactoryType);
    const now = new Date().toISOString();

    // Auto-correct stale DB state: sync slots column to level-derived capacity
    for (const [i, f] of factories.entries()) {
      const levelCapacity = getMaxSlots(f.level || 1);
      const row = factoryRows![i];
      if (row.slots !== levelCapacity || (f.usedSlots || 0) > levelCapacity) {
        await supabase
          .from('factories')
          .update({
            slots: levelCapacity,
            used_slots: Math.min(f.usedSlots || 0, levelCapacity),
          })
          .eq('x', f.x)
          .eq('y', f.y);
        const { data: corrected } = await supabase
          .from('factories')
          .select('*')
          .eq('x', f.x)
          .eq('y', f.y)
          .single();
        if (corrected) {
          factories[i] = toFactoryType(corrected);
        }
      }
    }

    let totalMetalInvested = 0;
    let totalEnergyInvested = 0;

    const enhancedFactories: FactoryResponse[] = factories.map((factory: Factory) => {
      const currentLevel = factory.level || 1;
      const stats = getFactoryStats(currentLevel);
      const regenFactory = applySlotRegeneration(factory);
      const timeUntilNext = getTimeUntilNextSlot(regenFactory);

      let upgradeCost = null;
      let canUpgrade = false;

      if (currentLevel < FACTORY_UPGRADE.MAX_LEVEL) {
        upgradeCost = calculateUpgradeCost(currentLevel);
        canUpgrade = playerMetal >= upgradeCost.metal && playerEnergy >= upgradeCost.energy;
      }

      const cumulative = currentLevel > 1 ? calculateCumulativeCost(currentLevel) : { metal: 0, energy: 0, level: 1 };
      totalMetalInvested += cumulative.metal;
      totalEnergyInvested += cumulative.energy;

      return {
        factory,
        stats,
        upgradeCost,
        canUpgrade,
        upgradeProgress: getUpgradeProgress(factory),
        availableSlots: getAvailableSlots(regenFactory),
        timeUntilNextSlot: {
          hours: timeUntilNext.hours,
          minutes: timeUntilNext.minutes,
          seconds: timeUntilNext.seconds,
          totalMs: timeUntilNext.totalMs,
        },
      };
    });

    return NextResponse.json({
      success: true,
      factories: enhancedFactories,
      count: factories.length,
      maxFactories: 10,
      canClaimMore: factories.length < 10,
      playerResources: { metal: playerMetal, energy: playerEnergy },
      totalInvestment: {
        metal: totalMetalInvested,
        energy: totalEnergyInvested,
        total: totalMetalInvested + totalEnergyInvested,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
