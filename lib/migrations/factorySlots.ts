/**
 * Factory Slots Migration - MariaDB/Drizzle ORM
 * Created: 2025-11-04
 * Updated: 2026-04-04 (Migrated from MongoDB to Drizzle ORM)
 * 
 * OVERVIEW:
 * Idempotent migration to update ALL existing factories to the new
 * slot capacity formula and ensure data consistency:
 *   slots = 5000 + ((level - 1) * 500)
 *   usedSlots <= slots
 *   lastSlotRegen defaults to now if missing
 *
 * Uses a `migrations` table to track applied migrations.
 * Safe to run multiple times.
 */

import { eq,     sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { factories } from '@/lib/db/schema/factories';
import { pgTable, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const migrations = pgTable('migrations', {
  id: varchar('id', { length: 100 }).primaryKey(),
  appliedAt: timestamp('applied_at').notNull(),
  details: jsonb('details').$type<any>(),
});

const MIGRATION_ID = '2025-11-04-factory-slots-v1';

const FACTORY_UPGRADE = {
  BASE_SLOTS: 5000,
  SLOTS_PER_LEVEL: 500,
} as const;

function getMaxSlots(level: number): number {
  return FACTORY_UPGRADE.BASE_SLOTS + ((level - 1) * FACTORY_UPGRADE.SLOTS_PER_LEVEL);
}

export async function runFactorySlotsMigration(): Promise<{
  success: boolean;
  message: string;
  modified?: number;
  matched?: number;
  alreadyApplied?: boolean;
}> {
  // Check if migration marker exists
  const existing = await db.select().from(migrations).where(eq(migrations.id, MIGRATION_ID));
  const markerExists = existing.length > 0;

  // Fetch all factories to check which need updating
  const allFactories = await db.select().from(factories);

  const needingUpdate = allFactories.filter(f => {
    const level = f.level ?? 1;
    const expectedSlots = getMaxSlots(level);
    const currentSlots = f.slots ?? 0;
    const usedSlots = f.usedSlots ?? 0;
    const hasLastSlotRegen = f.lastSlotRegen != null;

    return currentSlots !== expectedSlots || usedSlots > currentSlots || !hasLastSlotRegen;
  });

  if (needingUpdate.length === 0 && markerExists) {
    return {
      success: true,
      message: 'Factory slots migration already applied (no changes needed)',
      modified: 0,
      matched: 0,
      alreadyApplied: true,
    };
  }

  // Update each factory
  let modified = 0;
  for (const factory of allFactories) {
    const level = factory.level ?? 1;
    const newSlots = getMaxSlots(level);
    const usedSlots = factory.usedSlots ?? 0;
    const clampedUsedSlots = Math.min(usedSlots, newSlots);
    const lastSlotRegen = factory.lastSlotRegen ?? new Date();

    await db.update(factories)
      .set({
        slots: newSlots,
        usedSlots: clampedUsedSlots,
        lastSlotRegen,
      })
      .where(
        sql`${factories.x} = ${factory.x} AND ${factories.y} = ${factory.y}`
      );

    modified++;
  }

  // Insert migration marker if not exists
  if (!markerExists) {
    await db.insert(migrations).values({
      id: MIGRATION_ID,
      appliedAt: new Date(),
      details: JSON.stringify({
        baseSlots: FACTORY_UPGRADE.BASE_SLOTS,
        slotsPerLevel: FACTORY_UPGRADE.SLOTS_PER_LEVEL,
      }),
    });
  }

  return {
    success: true,
    message: `Updated factory slots to new formula (base ${FACTORY_UPGRADE.BASE_SLOTS}, +${FACTORY_UPGRADE.SLOTS_PER_LEVEL}/lvl)`,
    modified,
    matched: allFactories.length,
    alreadyApplied: false,
  };
}

export { getMaxSlots };
