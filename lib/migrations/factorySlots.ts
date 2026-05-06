/**
 * Factory Slots Migration
 * Created: 2025-11-04
 * 
 * OVERVIEW:
 * Idempotent migration to update ALL existing factories to the new
 * slot capacity formula and ensure data consistency:
 *   slots = 5000 + ((level - 1) * 500)
 *   usedSlots <= slots
 *   lastSlotRegen defaults to now if missing
 *
 * The migration records a marker document in the `migrations` table
 * with id `2025-11-04-factory-slots-v1`. It is safe to run multiple times:
 * - It always recomputes slots via Supabase queries
 * - It clamps usedSlots to slots
 * - It sets a default for lastSlotRegen when absent
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

const MIGRATION_ID = '2025-11-04-factory-slots-v1';

const FACTORY_UPGRADE = {
  BASE_SLOTS: 5000,
  SLOTS_PER_LEVEL: 500,
} as const;

export function getMaxSlots(level: number): number {
  return FACTORY_UPGRADE.BASE_SLOTS + ((level - 1) * FACTORY_UPGRADE.SLOTS_PER_LEVEL);
}

export async function runFactorySlotsMigration(
  supabase: SupabaseClient<any>
): Promise<{
  success: boolean;
  message: string;
  modified?: number;
  matched?: number;
  alreadyApplied?: boolean;
}> {
  // Check if migration marker exists
  const { data: marker } = await supabase
    .from('migrations')
    .select('id')
    .eq('id', MIGRATION_ID)
    .maybeSingle();

  // Count how many factories need updating (defensive/idempotent)
  const { data: factories, count: needingUpdate } = await supabase
    .from('factories')
    .select('id, level, slots, used_slots, last_slot_regen', { count: 'exact' });

  if (!factories || factories.length === 0) {
    if (marker) {
      return {
        success: true,
        message: 'Factory slots migration already applied (no factories to update)',
        modified: 0,
        matched: 0,
        alreadyApplied: true,
      };
    }

    // Upsert migration marker anyway
    await supabase.from('migrations').upsert({
      id: MIGRATION_ID,
      applied_at: new Date().toISOString(),
      details: {
        baseSlots: FACTORY_UPGRADE.BASE_SLOTS,
        slotsPerLevel: FACTORY_UPGRADE.SLOTS_PER_LEVEL,
      },
    });

    return {
      success: true,
      message: 'Factory slots migration applied (no factories to update)',
      modified: 0,
      matched: 0,
      alreadyApplied: false,
    };
  }

  let modifiedCount = 0;
  const now = new Date().toISOString();

  for (const factory of factories) {
    const level = factory.level || 1;
    const newSlots = getMaxSlots(level);
    let usedSlots = factory.used_slots || 0;
    const lastSlotRegen = factory.last_slot_regen || now;

    // Clamp usedSlots to new slots
    if (usedSlots > newSlots) {
      usedSlots = newSlots;
    }

    // Only update if something changed
    if (factory.slots !== newSlots || factory.used_slots !== usedSlots || !factory.last_slot_regen) {
      const { error } = await supabase
        .from('factories')
        .update({
          slots: newSlots,
          used_slots: usedSlots,
          last_slot_regen: lastSlotRegen,
        })
        .eq('id', factory.id);

      if (!error) {
        modifiedCount++;
      }
    }
  }

  // Upsert migration marker
  await supabase.from('migrations').upsert({
    id: MIGRATION_ID,
    applied_at: now,
    details: {
      baseSlots: FACTORY_UPGRADE.BASE_SLOTS,
      slotsPerLevel: FACTORY_UPGRADE.SLOTS_PER_LEVEL,
    },
  });

  return {
    success: true,
    message: `Updated factory slots to new formula (base ${FACTORY_UPGRADE.BASE_SLOTS}, +${FACTORY_UPGRADE.SLOTS_PER_LEVEL}/lvl)`,
    modified: modifiedCount,
    matched: factories.length,
    alreadyApplied: false,
  };
}

// Type-level export for the migration
export type FactorySlotsMigration = typeof runFactorySlotsMigration;
