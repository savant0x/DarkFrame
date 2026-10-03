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
import type { SQL, Column } from 'drizzle-orm';
import type * as PlayersSchema from '@/lib/db/schema/players';

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
    const locked = await lockClanRow(tx, clanId);
    return fn(tx, locked);
  });
}

/**
 * SELECT … FOR UPDATE one clan row inside an EXISTING transaction.
 * Throws (rolling the surrounding transaction back) when the row is missing.
 * FID-20261002-002 §5.1: lock-order composition — callers that must hold
 * several rows acquire them through this helper in the documented global
 * order (clan ids sorted, then player usernames sorted, then assets).
 */
export async function lockClanRow(tx: TreasuryTx, clanId: string): Promise<LockedClan> {
  const lockedRows = await tx
    .select()
    .from(clans)
    .where(eq(clans.id, clanId))
    .limit(1)
    .for('update');
  const locked = lockedRows[0];
  if (!locked) throw new Error('Clan not found');
  return locked as LockedClan;
}

/** The FOR UPDATE-locked players row projected to the requested columns. */
export type LockedPlayer =
  | Pick<typeof players.$inferSelect, keyof typeof PLAYER_LOCKED_COLUMNS>
  | (typeof PlayersSchema.players.$inferSelect & Record<string, unknown>);

/** Columns every player-row money writer re-validates after locking. */
const PLAYER_LOCKED_COLUMNS = {
  username: players.username,
  researchPoints: players.researchPoints,
  resourcesMetal: players.resourcesMetal,
  resourcesEnergy: players.resourcesEnergy,
  xp: players.xp,
  level: players.level,
  rpHistory: players.rpHistory,
  vip: players.vip,
  vipExpiration: players.vipExpiration,
} as const;

/**
 * SELECT … FOR UPDATE one player row inside an EXISTING transaction.
 * Returns the locked row projected to the money-writer columns (slim, per the
 * awardXP harvest-path precedent of never shipping the full 39 KB row).
 * Throws (rolling the surrounding transaction back) when the row is missing.
 */
export async function lockPlayerRow(
  tx: TreasuryTx,
  username: string,
  extra: Record<string, Column> = {}
): Promise<LockedPlayer> {
  const columns = { ...PLAYER_LOCKED_COLUMNS, ...extra };
  const lockedRows = await tx
    .select(columns)
    .from(players)
    .where(eq(players.username, username))
    .limit(1)
    .for('update');
  const locked = lockedRows[0];
  if (!locked) throw new Error(`Player not found: ${username}`);
  return locked;
}

/**
 * Validates a signed currency/resource amount before it reaches SQL
 * (FID-20261002-002 §5.1): finite, safe-integer, non-zero. Spending paths
 * additionally require positivity — call with `{ allowNegative: false }`.
 */
export function assertValidAmount(
  amount: number,
  label: string,
  opts: { allowNegative?: boolean } = {}
): void {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isSafeInteger(amount)) {
    throw new Error(`${label} must be a finite safe-integer amount (got ${String(amount)})`);
  }
  if (!opts.allowNegative && amount <= 0) {
    throw new Error(`${label} must be positive (got ${amount})`);
  }
}

/**
 * Bounded whole-transaction retry for deadlock/serialization failures
 * (FID-20261002-002 §5.2): the ENTIRE operation restarts — never a partial
 * write. Retries only on Postgres 40P01 (deadlock_detected) and 40001
 * (serialization_failure); every other error propagates immediately.
 */
export async function withTransactionRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { maxAttempts?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code !== '40P01' && code !== '40001') throw error;
      console.warn(`[treasuryLock] ${label}: retryable tx failure (${code}), attempt ${attempt}/${maxAttempts}`);
    }
  }
  throw lastError;
}
