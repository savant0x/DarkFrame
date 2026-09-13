/**
 * @file lib/migrations/autofarmRun.ts
 * @created 2026-09-12
 * @overview FID-20260912-078 — boot self-heal adding players.autofarm_run
 * (server-backed AutoFarm run persistence). Raw .sql is the record; this TS
 * runner applies it at boot (factorySlots/factoryStatResync pattern).
 * Idempotent.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

let applied = false;

export async function runAutofarmRunMigration(): Promise<{ message: string; alreadyApplied: boolean }> {
  if (applied) {
    return { message: 'autofarm_run already ensured this process', alreadyApplied: true };
  }

  // Guarded add (idempotent — safe across every boot).
  await db.execute(sql`
    ALTER TABLE players ADD COLUMN IF NOT EXISTS autofarm_run jsonb
  `);

  applied = true;
  return { message: 'players.autofarm_run ensured (server-backed AutoFarm runs)', alreadyApplied: false };
}
