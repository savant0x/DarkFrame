/**
 * @file lib/battleStatsService.ts
 * @created 2026-09-14
 * @overview Lifetime combat record for the profile Battle Statistics panel.
 *
 * The panel's shape (infantryAttacks/baseAttacks/baseDefenses) was backed by a
 * `players.battle_stats` jsonb column that NO code ever wrote — every profile
 * rendered zeros forever. The truthful source is `battle_logs` (written by the
 * combat paths since the Mongo era: INFANTRY via /api/combat/infantry,
 * BASE_RAID via /api/combat/attack), so the record is computed live in ONE
 * aggregate query using FILTER clauses:
 *
 *   Infantry Battles  → battle_type = 'INFANTRY', viewer as attacker
 *   Base Attacks      → battle_type IN ('BASE_RAID','BASE_ATTACK') (legacy
 *                       label included), viewer as attacker
 *   Base Defenses     → same raid types, viewer as defender
 *                       (total = raids against them; won = defended; breached
 *                        = lost — the panel's FID-093 fix wording)
 *
 * Victory perspective: ATTACKER_WIN counts for the attacker, DEFENDER_WIN for
 * the defender — the same viewer-side mapping /api/battle-logs renders.
 * Losses are derived (initiated − won), so draws resolve as defeats, matching
 * the battle-logs viewer.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { BattleStatistics } from '@/types/game.types';

export interface SideCounters {
  initiated: number;
  won: number;
  lost: number;
}

/** Defense panel shape: total = raids against the player, won = defended. */
export interface DefenseCounters {
  total: number;
  won: number;
  lost: number;
}

export interface ComputedBattleStats {
  infantryAttacks: SideCounters;
  baseAttacks: SideCounters;
  baseDefenses: DefenseCounters;
}

/** Fallback when a viewer has no battle history (or the query returns nothing). */
export const EMPTY_BATTLE_STATS: ComputedBattleStats = {
  infantryAttacks: { initiated: 0, won: 0, lost: 0 },
  baseAttacks: { initiated: 0, won: 0, lost: 0 },
  baseDefenses: { total: 0, won: 0, lost: 0 },
};

interface BattleStatsRow {
  infantry_initiated: number;
  infantry_won: number;
  base_attacks_initiated: number;
  base_attacks_won: number;
  base_defenses_total: number;
  base_defenses_won: number;
}

/** Compute the lifetime record for one player from battle_logs. */
export async function computeBattleStats(username: string): Promise<ComputedBattleStats> {
  const result = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE battle_type = 'INFANTRY' AND attacker_username = ${username})::int AS infantry_initiated,
      count(*) FILTER (WHERE battle_type = 'INFANTRY' AND attacker_username = ${username} AND outcome = 'ATTACKER_WIN')::int AS infantry_won,
      count(*) FILTER (WHERE battle_type IN ('BASE_RAID', 'BASE_ATTACK') AND attacker_username = ${username})::int AS base_attacks_initiated,
      count(*) FILTER (WHERE battle_type IN ('BASE_RAID', 'BASE_ATTACK') AND attacker_username = ${username} AND outcome = 'ATTACKER_WIN')::int AS base_attacks_won,
      count(*) FILTER (WHERE battle_type IN ('BASE_RAID', 'BASE_ATTACK') AND defender_username = ${username})::int AS base_defenses_total,
      count(*) FILTER (WHERE battle_type IN ('BASE_RAID', 'BASE_ATTACK') AND defender_username = ${username} AND outcome = 'DEFENDER_WIN')::int AS base_defenses_won
    FROM battle_logs
  `);

  const row = ((result.rows as unknown[])[0] ?? {}) as Partial<BattleStatsRow>;
  const infantryInitiated = row.infantry_initiated ?? 0;
  const infantryWon = row.infantry_won ?? 0;
  const baseAttacksInitiated = row.base_attacks_initiated ?? 0;
  const baseAttacksWon = row.base_attacks_won ?? 0;
  const baseDefensesTotal = row.base_defenses_total ?? 0;
  const baseDefensesWon = row.base_defenses_won ?? 0;

  return {
    infantryAttacks: { initiated: infantryInitiated, won: infantryWon, lost: Math.max(0, infantryInitiated - infantryWon) },
    baseAttacks: { initiated: baseAttacksInitiated, won: baseAttacksWon, lost: Math.max(0, baseAttacksInitiated - baseAttacksWon) },
    baseDefenses: { total: baseDefensesTotal, won: baseDefensesWon, lost: Math.max(0, baseDefensesTotal - baseDefensesWon) },
  };
}

/**
 * Adapter: map the computed record onto the panel contract the profile pages
 * have always rendered (BattleStatistics — structurally identical).
 */
export function toPanelBattleStats(computed: ComputedBattleStats): BattleStatistics {
  return {
    infantryAttacks: computed.infantryAttacks,
    baseAttacks: computed.baseAttacks,
    baseDefenses: computed.baseDefenses,
  };
}
