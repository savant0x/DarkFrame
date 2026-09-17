/**
 * @file lib/db/treasuryLock.ts
 * @created 2026-09-17 (FID-20260917-001)
 *
 * OVERVIEW:
 * The single definition of the clan-treasury write idiom. Every treasury write
 * must (a) run inside a transaction that first locks the clan row with
 * SELECT … FOR UPDATE, (b) re-validate balances/ownership against the LOCKED
 * row, and (c) write RELATIVE SQL arithmetic so concurrent writers compose
 * instead of last-writer-win. Snapshot-computed treasury writes
 * (`bankTreasuryMetal: snapshot - delta` as a plain number) are prohibited —
 * the census grep in FID-20260917-001 §5 enforces zero of them.
 *
 * WHY: two writers reading the same snapshot and writing `snapshot ∓ delta`
 * silently delete one operation's effect. Relative SQL (`column = column - x`)
 * plus a row lock makes every interleaving correct.
 */

import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

/** Transaction handle passed to withClanTreasuryLock callbacks. */
export type TreasuryTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The FOR UPDATE-locked clans row (full table shape, loosely typed). */
export type LockedClan = Record<string, unknown>;

/** Signed relative arithmetic on one treasury column (positive = credit). */
export function treasuryDelta(delta: {
  metal?: number;
  energy?: number;
  researchPoints?: number;
}): Partial<{ bankTreasuryMetal: SQL; bankTreasuryEnergy: SQL; bankTreasuryResearchPoints: SQL }> {
  const out: Partial<{
    bankTreasuryMetal: SQL;
    bankTreasuryEnergy: SQL;
    bankTreasuryResearchPoints: SQL;
  }> = {};
  if (delta.metal) out.bankTreasuryMetal = sql`${clans.bankTreasuryMetal} + ${delta.metal}`;
  if (delta.energy) out.bankTreasuryEnergy = sql`${clans.bankTreasuryEnergy} + ${delta.energy}`;
  if (delta.researchPoints) {
    out.bankTreasuryResearchPoints = sql`${clans.bankTreasuryResearchPoints} + ${delta.researchPoints}`;
  }
  return out;
}

/** Signed relative arithmetic on the paired player-resource columns. */
export function playerResourceDelta(delta: {
  metal?: number;
  energy?: number;
  researchPoints?: number;
}): Partial<{ resourcesMetal: SQL; resourcesEnergy: SQL; researchPoints: SQL }> {
  const out: Partial<{ resourcesMetal: SQL; resourcesEnergy: SQL; researchPoints: SQL }> = {};
  if (delta.metal) out.resourcesMetal = sql`${players.resourcesMetal} + ${delta.metal}`;
  if (delta.energy) out.resourcesEnergy = sql`${players.resourcesEnergy} + ${delta.energy}`;
  if (delta.researchPoints) out.researchPoints = sql`${players.researchPoints} + ${delta.researchPoints}`;
  return out;
}

/**
 * Lock the clan row and run `fn` inside the transaction.
 *
 * `fn` receives (tx, lockedClan). Re-validate everything against `lockedClan`
 * — the values visible BEFORE the lock are only a fail-fast preview. Throwing
 * inside `fn` rolls the whole transaction back.
 */
export async function withClanTreasuryLock<T>(
  clanId: string,
  fn: (tx: TreasuryTx, lockedClan: LockedClan) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const lockedRows = await tx
      .select()
      .from(clans)
      .where(eq(clans.id, clanId))
      .limit(1)
      .for('update');
    const locked = lockedRows[0];
    if (!locked) throw new Error('Clan not found');
    return fn(tx, locked as LockedClan);
  });
}
