/**
 * raidTelemetry — aggregates raid outcomes and hostility refusals so the
 * balancing constants in docs/design/PVP_BASE_RAID_DESIGN.md get tuned on
 * data, not vibes (FID-20260928-008).
 *
 * Data sources (zero new write paths for outcomes — battle_logs already
 * persists everything the design doc's knobs need):
 *   - Raid outcomes + loot: battle_logs WHERE battle_type='BASE_RAID'
 *     (BaseRaid, FID-20260912-093). Aggregates are computed here — the raw
 *     rows stay the one source of truth.
 *   - Hostility refusals: player_activity rows with action='raid_refusal',
 *     metadata = { attacker, defender, reason, attackerClanId, defenderClanId,
 *     allied } — written by the unified raid route's hostility gate
 *     (FID-20260928-006 §2) via logRaidRefusal. Failure to log never blocks
 *     the refusal response itself.
 *
 * Both read helpers are best-effort: telemetry must never break gameplay or
 * the admin panel — failures return null/[] and the caller decides.
 */

import { db } from '@/lib/db';
import { battleLogs, playerActivity } from '@/lib/db/schema';
import { and, count, eq, gte, sql } from 'drizzle-orm';

/** Keep in sync with the route's refusal writer (logRaidRefusal metadata). */
export const RAID_REFUSAL_ACTION = 'raid_refusal';

export interface RaidOutcomeRow {
  outcome: string;
  total: number;
  lootMetal: number;
  lootEnergy: number;
  attackerLosses: number;
  defenderLosses: number;
}

export interface RaidTelemetrySummary {
  windowHours: number;
  totalRaids: number;
  /** wins / (wins + losses) across resolved raids (draws excluded from rate). */
  winRate: number | null;
  wins: number;
  losses: number;
  draws: number;
  lootMetal: number;
  lootEnergy: number;
  /** mean per-raid attacker unit losses (rounds to 2dp). */
  avgAttackerLosses: number | null;
  /** mean per-raid defender unit losses — the §4.2 floor's real-world bite. */
  avgDefenderLosses: number | null;
  /** distinct attackers / defenders over the window. */
  uniqueAttackers: number | null;
  uniqueDefenders: number | null;
}

export interface RefusalPairRow {
  attacker: string;
  defender: string;
  total: number;
  /** most common refusal reason in the window (verbatim from the gate). */
  topReason: string | null;
}

/**
 * Outcome aggregate over a rolling window. Returns null on DB failure
 * (best-effort telemetry — the panel renders an error row, not a 500).
 */
export async function getRaidTelemetry(windowHours = 168): Promise<RaidTelemetrySummary | null> {
  try {
    const since = new Date(Date.now() - windowHours * 3_600_000);
    const [row] = await db
      .select({
        total: count(),
        wins: sql<number>`count(*) filter (where ${battleLogs.outcome} = 'ATTACKER_WIN')`,
        losses: sql<number>`count(*) filter (where ${battleLogs.outcome} = 'DEFENDER_WIN')`,
        draws: sql<number>`count(*) filter (where ${battleLogs.outcome} = 'DRAW')`,
        lootMetal: sql<number>`coalesce(sum(${battleLogs.resourcesStolenAmount}) filter (where ${battleLogs.resourcesStolenResourceType} = 'metal'), 0)`,
        lootEnergy: sql<number>`coalesce(sum(${battleLogs.resourcesStolenAmount}) filter (where ${battleLogs.resourcesStolenResourceType} = 'energy'), 0)`,
        attackerLosses: sql<number>`coalesce(sum(${battleLogs.attackerUnitsLost}), 0)`,
        defenderLosses: sql<number>`coalesce(sum(${battleLogs.defenderUnitsLost}), 0)`,
        uniqueAttackers: sql<number>`count(distinct ${battleLogs.attackerUsername})`,
        uniqueDefenders: sql<number>`count(distinct ${battleLogs.defenderUsername})`,
      })
      .from(battleLogs)
      .where(and(eq(battleLogs.battleType, 'BASE_RAID'), gte(battleLogs.timestamp, since)));

    const resolved = (row?.wins ?? 0) + (row?.losses ?? 0);
    return {
      windowHours,
      totalRaids: Number(row?.total ?? 0),
      wins: Number(row?.wins ?? 0),
      losses: Number(row?.losses ?? 0),
      draws: Number(row?.draws ?? 0),
      winRate: resolved > 0 ? Number(row.wins) / resolved : null,
      lootMetal: Number(row?.lootMetal ?? 0),
      lootEnergy: Number(row?.lootEnergy ?? 0),
      avgAttackerLosses: row && Number(row.total) > 0 ? Math.round((Number(row.attackerLosses) / Number(row.total)) * 100) / 100 : null,
      avgDefenderLosses: row && Number(row.total) > 0 ? Math.round((Number(row.defenderLosses) / Number(row.total)) * 100) / 100 : null,
      uniqueAttackers: Number(row?.uniqueAttackers ?? 0),
      uniqueDefenders: Number(row?.uniqueDefenders ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Refusal counts per attacker→defender pair over the window (hostility-gate
 * refusals only — presence/cooldown refusals are validation failures that
 * never reach the telemetry write). Returns [] on DB failure.
 */
export async function getRaidRefusalPairs(windowHours = 168, limit = 50): Promise<RefusalPairRow[]> {
  try {
    const since = new Date(Date.now() - windowHours * 3_600_000);
    const rows = await db
      .select({
        attacker: sql<string>`${playerActivity.metadata}->>'attacker'`,
        defender: sql<string>`${playerActivity.metadata}->>'defender'`,
        total: count(),
        topReason: sql<string>`mode() within group (order by ${playerActivity.metadata}->>'reason')`,
      })
      .from(playerActivity)
      .where(and(eq(playerActivity.action, RAID_REFUSAL_ACTION), gte(playerActivity.timestamp, since)))
      .groupBy(sql`1`, sql`2`)
      .orderBy(sql`3 desc`)
      .limit(limit);
    return rows;
  } catch {
    return [];
  }
}
