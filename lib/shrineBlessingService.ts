/**
 * FID-20260919-015 W2: persistent shrine blessing history.
 *
 * shrine_blessings is the per-grant ledger behind players.shrine_boosts (jsonb).
 * The jsonb holds only the CURRENT expiry per tier — every prior grant, its
 * timing, and its yield bonus is lost the moment a boost is replaced. This
 * table keeps one row per grant (playerId = username, the table's FK-less
 * player_id convention, same as chat_read_status).
 */
import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { shrineBlessings } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';

export interface BlessingRecord {
  id: string;
  playerId: string;
  tier: string;
  expiresAt: Date;
  /** Fraction (0.25 = +25%) — converted from the integer-percent column. */
  yieldBonus: number;
  createdAt: Date;
}

/** Persist one boost grant/extension as a blessing row.
 *
 * yieldBonus arrives as a fraction (0.25 = +25%, the ShrineBoost/BOOST_CONFIGS
 * shape) but the designed column is integer — stored as whole percent.
 * getBlessingHistory converts back so the wire stays fractional.
 */
export async function recordBlessing(
  username: string,
  tier: string,
  expiresAt: Date,
  yieldBonus: number
): Promise<void> {
  await db.insert(shrineBlessings).values({
    id: generateId(),
    playerId: username,
    tier,
    expiresAt,
    yieldBonus: Math.round(yieldBonus * 100),
    createdAt: new Date(),
  });
}

/** Last N blessing grants for a player, newest first. */
export async function getBlessingHistory(
  username: string,
  limit = 20
): Promise<BlessingRecord[]> {
  const rows = await db
    .select({
      id: shrineBlessings.id,
      playerId: shrineBlessings.playerId,
      tier: shrineBlessings.tier,
      expiresAt: shrineBlessings.expiresAt,
      yieldBonus: shrineBlessings.yieldBonus,
      createdAt: shrineBlessings.createdAt,
    })
    .from(shrineBlessings)
    .where(eq(shrineBlessings.playerId, username))
    .orderBy(desc(shrineBlessings.createdAt))
    .limit(limit);
  // integer-percent column → fractional wire shape (0.25 = +25%)
  return rows.map((r) => ({ ...r, yieldBonus: r.yieldBonus / 100 }));
}
