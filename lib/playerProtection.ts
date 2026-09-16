/**
 * @file lib/playerProtection.ts
 * @created 2026-09-16
 * @overview New-player protection window (FID-20260916-002 — loop-complete plan §5)
 *
 * DESIGN (per the converged FID):
 * - The window is a TIMESTAMP on players.protection_until set at registration —
 *   never a boolean flag that can stick. Expiry is purely time-derived
 *   (protectionUntil <= now), so a protected account becomes attackable
 *   automatically with zero cleanup writes.
 * - Aggression voids the window: a protected player's first outgoing PvP attack
 *   (infantry path — the only reachable PvP surface; base raids are bots-only by
 *   route contract, verified in the FID's pass-1 surface census) clears the
 *   column immediately, closing the "smurf farms risk-free, then hides behind
 *   protection" vector.
 * - Flag steal channels are EXEMPT by recorded FID decision (opt-in global
 *   event; carrying the flag is continuous exposure; the challenge/claim flow
 *   damages no one).
 * - WMD targeting enforces the column through lib/wmd/targetingValidator.ts
 *   (pre-existing reader — comes alive with no code change once the column is
 *   written).
 */

import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';

/** Registration window length in hours. Operator-tunable knob (FID §5 default:
 *  72h — covers the tutorial + first base build). */
export const PROTECTION_WINDOW_HOURS = 72;

/**
 * Pure predicate — the single truth for "is this player protected right now?".
 * Accepts the raw column value (Date from pg, ISO string from jsonb payloads)
 * or null/undefined (= unprotected). A corrupt timestamp degrades to
 * "unprotected" rather than throwing — a broken clock must never hard-refuse
 * every attack on the map (Law 14: the degenerate path is explicit).
 */
export function protectionActive(
  protectionUntil: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!protectionUntil) return false;
  const until = protectionUntil instanceof Date ? protectionUntil : new Date(protectionUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > now.getTime();
}

/** The server reason returned on every protected-target refusal. */
export const PROTECTION_REFUSAL_REASON = 'Target is under new-player protection';

/**
 * Aggression void: clear the protection window when the protected player
 * initiates PvP. The `isNotNull` predicate keeps this an honest one-row write —
 * an unprotected attacker's outgoing battle updates nothing (the .returning()
 * count stays 0, no phantom write).
 *
 * A failed void write is logged and NOT rethrown: the battle has already
 * legitimately begun and must not be aborted by an audit write. Worst case the
 * window lives out its natural expiry (time-derived — it cannot stick past its
 * own deadline); the next outgoing attack retries the void.
 */
export async function voidProtectionOnAggression(username: string): Promise<void> {
  try {
    const result = await db
      .update(players)
      .set({ protectionUntil: null })
      .where(and(eq(players.username, username), isNotNull(players.protectionUntil)))
      .returning({ username: players.username });
    if (result.length > 0) {
      console.log(`🛡️ Protection voided on aggression: ${username} initiated PvP`);
    }
  } catch (error) {
    console.error(`Failed to void protection on aggression for ${username}:`, error);
  }
}

/** Compute the registration window expiry for a new player's insert row. */
export function newPlayerProtectionUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + PROTECTION_WINDOW_HOURS * 60 * 60 * 1000);
}
