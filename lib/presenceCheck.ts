/**
 * @file lib/presenceCheck.ts
 * @created 2026-09-04
 * @overview Server-side presence enforcement for all player-initiated combat.
 *
 * The client's position is never trusted: every attack route resolves the
 * attacker from the session, reads the attacker's position from the database,
 * and refuses the action unless the attacker stands at the target coordinates
 * (Chebyshev distance — 8-directional grid movement — within `maxDistance`).
 * Introduced because attacks could previously be launched from anywhere
 * (or with a spoofed client-reported position).
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/** Result of a presence verification. */
export interface PresenceResult {
  ok: boolean;
  /** Set when ok === false; safe to show the player. */
  reason?: string;
  /** Attacker's position as read from the database (diagnostics). */
  attackerPosition?: { x: number; y: number };
}

/**
 * Chebyshev distance — the correct metric for an 8-directional grid
 * (qwe/asd/zxc movement): a king-move reaches any tile with
 * max(|dx|, |dy|) <= 1 per step.
 */
export function chebyshevDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Verify the named attacker's DB-stored position places them at/near the target
 * coordinates. Reads position fresh from the players table — never from the
 * request body. `maxDistance` defaults to 0 (must stand ON the tile).
 */
export async function verifyPresence(
  attackerUsername: string,
  targetCoords: { x: number; y: number },
  maxDistance = 0
): Promise<PresenceResult> {
  const rows = await db.select().from(players).where(eq(players.username, attackerUsername)).limit(1);
  const attacker = rows[0];
  if (!attacker) {
    return { ok: false, reason: 'Attacker not found' };
  }

  const attackerPosition = {
    x: Number(attacker.currentPositionX ?? 0),
    y: Number(attacker.currentPositionY ?? 0),
  };

  const distance = chebyshevDistance(attackerPosition, targetCoords);
  if (distance > maxDistance) {
    return {
      ok: false,
      reason:
        maxDistance === 0
          ? `You must be at the target's location (${targetCoords.x}, ${targetCoords.y}) to attack it`
          : `Too far away: ${distance} tiles (max ${maxDistance})`,
      attackerPosition,
    };
  }

  return { ok: true, attackerPosition };
}
