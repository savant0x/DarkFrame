/**
 * @file lib/migrations/factoryStatResync.ts
 * @created 2026-09-12
 * @overview FID-20260912-072 — boot self-heal that keeps factory rows in sync
 * with the canonical curves (single source: lib/factoryUpgradeService.ts).
 *
 * Why this exists: the dormant-stats audit found `slots`, `production_rate`,
 * and (for bot-seeded rows) `defense` all stale — written only at creation or
 * under older curves. Write paths now maintain the full stat block (FID-032 §7
 * pattern); this heals the 965 existing rows and guards against any drift
 * from future curve edits (it recomputes from level every boot, marker-gated).
 *
 * Same self-heal shape as factorySlots.ts: migrations table marker + a drift
 * scan, so re-running is free when healthy and corrective when not.
 *
 * Mirror of lib/db/migrations/0028_factory_stat_resync.sql (the raw-SQL record).
 */
import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { factories, migrations } from '../db/schema';
import { getMaxSlots, getProductionRate, getFactoryDefense } from '../factoryUpgradeService';

const MIGRATION_ID = '0028_factory_stat_resync';

export async function runFactoryStatResyncMigration(): Promise<{
  success: boolean;
  message: string;
  modified?: number;
  alreadyApplied?: boolean;
}> {
  // Self-heal the bookkeeping table (same as factorySlots.ts).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" varchar(100) PRIMARY KEY,
      "applied_at" timestamp NOT NULL,
      "details" jsonb
    )
  `);

  const existing = await db.select().from(migrations).where(eq(migrations.id, MIGRATION_ID));
  const markerExists = existing.length > 0;

  const allFactories = await db.select().from(factories);

  const needingUpdate = allFactories.filter((f) => {
    const level = f.level ?? 1;
    return (
      (f.slots ?? 0) !== getMaxSlots(level) ||
      Number(f.productionRate ?? 0) !== getProductionRate(level) ||
      f.defense !== getFactoryDefense(level) ||
      (f.usedSlots ?? 0) > getMaxSlots(level)
    );
  });

  if (needingUpdate.length === 0 && markerExists) {
    return {
      success: true,
      message: 'Factory stat resync already applied (no drift)',
      modified: 0,
      alreadyApplied: true,
    };
  }

  let modified = 0;
  for (const factory of needingUpdate) {
    const level = factory.level ?? 1;
    const slots = getMaxSlots(level);
    await db
      .update(factories)
      .set({
        slots,
        productionRate: String(getProductionRate(level)),
        defense: getFactoryDefense(level),
        // Clamp the counter to capacity — units live on players' `units`
        // blobs; used_slots is bookkeeping only (FID-032 §7 invariant).
        usedSlots: Math.min(factory.usedSlots ?? 0, slots),
      })
      .where(sql`${factories.x} = ${factory.x} AND ${factories.y} = ${factory.y}`);
    modified += 1;
  }

  if (!markerExists) {
    await db.insert(migrations).values({
      id: MIGRATION_ID,
      appliedAt: new Date(),
      details: { modified, factoriesResynced: needingUpdate.length },
    });
  }

  return {
    success: true,
    message: `Factory stat resync complete: ${modified} rows brought to FID-072 curves`,
    modified,
    alreadyApplied: false,
  };
}
