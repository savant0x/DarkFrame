/**
 * Bot Growth Engine - Hourly Growth and Unit Building System
 * Created: 2024-10-18
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { getNestById } from './botNestService';
import type { Player, PlayerUnit, UnitType } from '@/types/game.types';

const REGENERATION_RATES: Record<string, number> = {
  Hoarder: 0.05, Fortress: 0.10, Raider: 0.15, Ghost: 0.20, Balanced: 0.12,
};

const BUILD_RATES: Record<string, number> = {
  Fortress: 0.5, Raider: 1.0, Hoarder: 0.25, Ghost: 0.67, Balanced: 1.0,
};

const ARMY_COMPOSITION: Record<string, { str: number; def: number }> = {
  Fortress: { str: 0.3, def: 0.7 }, Raider: { str: 0.7, def: 0.3 },
  Hoarder: { str: 0.5, def: 0.5 }, Ghost: { str: 0.5, def: 0.5 }, Balanced: { str: 0.5, def: 0.5 },
};

const TIER_ARMY_CAPS: Record<number, number> = { 1: 20, 2: 40, 3: 60 };
const AGE_MULTIPLIERS = { YOUNG: 1.0, VETERAN: 1.5, LEGENDARY: 2.0 };

export async function runGrowthCycle(): Promise<{
  processed: number; regenerated: number; moved: number; unitsBuilt: number; errors: string[];
}> {
  const supabase = createServiceClient();
  const errors: string[] = [];
  let processed = 0, regenerated = 0, moved = 0, unitsBuilt = 0;

  try {
    const { data: bots } = await supabase.from('players').select('*').eq('is_bot', true);
    if (!bots) return { processed: 0, regenerated: 0, moved: 0, unitsBuilt: 0, errors: [] };

    console.log(`[Growth Cycle] Processing ${bots.length} bots...`);

    for (const bot of bots) {
      try {
        // Regenerate resources
        const currentMetal = bot.resources_metal || 0;
        const currentEnergy = bot.resources_energy || 0;
        const newMetal = currentMetal + Math.floor(currentMetal * 0.1);
        const newEnergy = currentEnergy + Math.floor(currentEnergy * 0.1);

        const updates: Record<string, any> = {};

        if (newMetal !== currentMetal) { updates.resources_metal = newMetal; regenerated++; }
        if (newEnergy !== currentEnergy) { updates.resources_energy = newEnergy; regenerated++; }

        // Growth pattern
        const growthMetal = applyGrowthPattern(newMetal, 'Balanced');
        const growthEnergy = applyGrowthPattern(newEnergy, 'Balanced');
        if (growthMetal !== newMetal) updates.resources_metal = growthMetal;
        if (growthEnergy !== newEnergy) updates.resources_energy = growthEnergy;

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from('players').update(updates as Database['public']['Tables']['players']['Update']).eq('username', bot.username);
          if (!error) processed++;
        }
      } catch (botError) {
        errors.push(`Failed to process bot ${bot.username}: ${botError}`);
      }
    }

    console.log(`[Growth Cycle] Complete - Processed: ${processed}`);
    return { processed, regenerated, moved, unitsBuilt, errors };
  } catch (error) {
    errors.push(`Growth cycle failed: ${error}`);
    return { processed, regenerated, moved, unitsBuilt, errors };
  }
}

function applyGrowthPattern(current: number, specialization: string): number {
  const roll = Math.random();
  if (roll < 0.70) return Math.floor(current * (1.05 + Math.random() * 0.10));
  if (roll < 0.90) return current;
  return Math.floor(current * (1 - (0.05 + Math.random() * 0.05)));
}

export async function forceRegeneration(): Promise<{ success: boolean; count: number; errors: string[] }> {
  const result = await runGrowthCycle();
  return { success: result.errors.length === 0, count: result.processed, errors: result.errors };
}
