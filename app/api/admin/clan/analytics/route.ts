/**
 * @fileoverview Admin Clan Analytics API — backend for the 9-tab ClanInspectorModal
 * @module app/api/admin/clan/analytics/route
 * @created 2026-09-02 (FID-less scope: SESSION-2026-09-02-010, resolves SCOPE.md #10)
 *
 * OVERVIEW:
 * GET /api/admin/clan/analytics?clanId=<id>[&tab=<tab>]
 *
 * Returns `{ success, clan, analytics }` where `clan` is the domain Clan shape the
 * modal renders and `analytics` satisfies the render contract documented in
 * components/admin/ClanInspectorModal.tsx (session-008 ClanAnalytics interface):
 * totalPower, alerts[], recentActivity (24h counters), totalDeposits,
 * totalWithdrawals, activities[], alliances[], healthScore.
 *
 * DATA SOURCES (all read-only):
 * - clans row: raw SQL (the MySQL-dialect drizzle schema cannot type against the
 *   pg driver without adding dialect-purgatory tsc errors — see FID-20260902-001).
 * - clan_activities: canonical columns activity_type/player_id/username/details/
 *   timestamp (used by clanActivityService, clanService, clanBankService,
 *   clanAllianceService). NOTE: territoryService writes divergent `type`/`metadata`
 *   columns (SCOPE.md #16) — those rows are not visible to this endpoint until the
 *   DB-direction decision reconciles them.
 * - clan_alliances: columns per clanAllianceService.rowToAlliance.
 *
 * DB DIALECT NOTE:
 * Raw SQL here uses Postgres syntax (the configured DATABASE_URL/driver is
 * node-postgres). MySQL-dialect fragments elsewhere in the tree
 * (JSON_CONTAINS/JSON_OBJECT) are a FID-20260902-001 concern, not this route's.
 *
 * KNOWN LIMITATIONS (recorded, not faked):
 * - Member enrichment (contributedRP / contributedResources) is omitted: no writer
 *   for those fields exists anywhere in the codebase. The modal renders its `|| 0`
 *   fallbacks. Adding real contribution analytics requires a data source first.
 * - The Financial tab's transaction list is stubbed client-side ("requires API
 *   integration"); this route provides the aggregates (totals) only.
 * - Bank transactions jsonb is capped by CLAN_BANK_CONSTANTS.TRANSACTION_HISTORY_LIMIT,
 *   so deposit/withdrawal totals reflect the retained history window.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { getDefenseBonus, type Territory } from '@/lib/territoryService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import type {
  Clan,
  ClanMember,
  ClanLevel,
  ClanBank,
  ClanBankTransactionType,
  ClanPerk,
  MonumentType,
} from '@/types/clan.types';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

// ============================================================================
// Row-extraction seam
// ============================================================================

/**
 * Extracts result rows from db.execute. On the current node-postgres drizzle
 * driver, db.execute resolves to a pg QueryResult (rows under `.rows`) — this is
 * the runtime-true shape. FID-20260902-001 owns this single line: when the schema
 * dialect decision lands, only this mapping changes.
 */
function getQueryRows(result: unknown): Record<string, unknown>[] {
  const maybe = result as { rows?: unknown };
  return Array.isArray(maybe?.rows) ? (maybe.rows as Record<string, unknown>[]) : [];
}

// ============================================================================
// Raw-SQL row shapes (snake_case, pre-normalization)
// ============================================================================

/** Element shape of the clans.territories jsonb column as written by territoryService. */
interface TerritoryJson {
  x: number;
  y: number;
  clanId?: string;
  clanTag?: string;
  claimedAt?: string | Date;
  claimedBy?: string;
}

/** Element shape of the clans.members jsonb column (domain ClanMember). */
type MemberJson = ClanMember;

/** Element shape of the clans.bankTransactions jsonb column (domain ClanBankTransaction). */
interface BankTransactionJson {
  type: string;
  playerId?: string;
  username?: string;
  amount?: { metal?: number; energy?: number; researchPoints?: number };
  timestamp?: string | Date;
  description?: string;
}

/** clans row as returned by SELECT * (raw SQL). */
interface ClanSqlRow {
  id: string;
  name: string;
  tag: string;
  description: string;
  leader_id: string;
  members: MemberJson[] | string;
  max_members: number;
  level_current_level: number;
  level_total_xp: number;
  level_current_level_xp: number;
  level_xp_to_next_level: number;
  level_features_unlocked: string[] | string;
  created_at: string;
  settings_message_of_the_day: string;
  settings_is_recruiting: number;
  settings_min_level_to_join: number;
  settings_requires_approval: number;
  settings_allow_territory_control: number;
  settings_allow_war_declarations: number;
  stats_total_power: number;
  stats_total_territories: number;
  stats_total_monuments: number;
  stats_wars_won: number;
  stats_wars_lost: number;
  stats_total_rp: number;
  monuments: MonumentType[] | string;
  research_research_points: number;
  research_unlocked_techs: string[] | string;
  research_active_research: string | null;
  bank_treasury_metal: number | string | bigint;
  bank_treasury_energy: number | string | bigint;
  bank_treasury_research_points: number | string | bigint;
  bank_tax_rates_metal: string;
  bank_tax_rates_energy: string;
  bank_tax_rates_research_points: string;
  bank_upgrade_level: number;
  bank_capacity: number;
  bank_transactions: BankTransactionJson[] | string;
  active_perks: ClanPerk[] | string;
  territories: TerritoryJson[] | string;
}

/** clan_activities row. */
interface ActivitySqlRow {
  id: number;
  clan_id: string;
  activity_type: string;
  player_id: string | null;
  username: string | null;
  details: string | Record<string, unknown> | null;
  timestamp: string;
}

/** clan_alliances row (subset the render contract consumes). */
interface AllianceSqlRow {
  id: string;
  clan_ids: string;
  status: string;
  proposed_at: string;
  metadata: string | Record<string, unknown> | null;
}

/** 24h counter row (COUNT(*) FILTER aggregate). */
interface RecentCountersSqlRow {
  bank_transactions: number | string;
  member_changes: number | string;
  territory_claims: number | string;
  wars_declared: number | string;
}

// ============================================================================
// Normalization helpers
// ============================================================================

/** jsonb columns can arrive as parsed objects or as JSON strings depending on driver. */
function parseJsonField<T>(value: T | string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value;
}

/** treasury columns are int in the schema but defensive Number() covers BigInt/decimal drift. */
function toNumber(value: number | string | bigint | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** tinyint columns arrive as 0/1 (or boolean under some drivers). */
function toBoolean(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

// ============================================================================
// Row → domain mapping
// ============================================================================

/** Maps a raw clans row to the domain Clan shape the modal renders. */
function mapClanRow(row: ClanSqlRow): Clan {
  const members = parseJsonField<MemberJson[]>(row.members, []);
  const territories = parseJsonField<TerritoryJson[]>(row.territories, []);
  // territoryService.Territory shape — getDefenseBonus consumes x/y/clanTag/claimedBy.
  const territoryList: Territory[] = territories.map((t) => ({
    x: t.x,
    y: t.y,
    clanId: t.clanId ?? row.id,
    clanTag: t.clanTag ?? row.tag,
    claimedAt: t.claimedAt ? new Date(t.claimedAt) : new Date(0),
    claimedBy: t.claimedBy ?? '',
  }));
  const bankTransactions = parseJsonField<BankTransactionJson[]>(row.bank_transactions, []);
  const unlockedTechs = parseJsonField<string[]>(row.research_unlocked_techs, []);

  const level: ClanLevel = {
    currentLevel: row.level_current_level ?? 1,
    totalXP: row.level_total_xp ?? 0,
    currentLevelXP: row.level_current_level_xp ?? 0,
    xpToNextLevel: row.level_xp_to_next_level ?? 0,
    featuresUnlocked: parseJsonField<string[]>(row.level_features_unlocked, []),
    milestonesCompleted: [],
  };

  const bank: ClanBank = {
    treasury: {
      metal: toNumber(row.bank_treasury_metal),
      energy: toNumber(row.bank_treasury_energy),
      researchPoints: toNumber(row.bank_treasury_research_points),
    },
    taxRates: {
      metal: Number(row.bank_tax_rates_metal) || 0,
      energy: Number(row.bank_tax_rates_energy) || 0,
      researchPoints: Number(row.bank_tax_rates_research_points) || 0,
    },
    transactions: bankTransactions.map((tx) => ({
      transactionId: '',
      type: tx.type as ClanBankTransactionType,
      ...(tx.playerId !== undefined ? { playerId: tx.playerId } : {}),
      ...(tx.username !== undefined ? { username: tx.username } : {}),
      amount: {
        ...(tx.amount?.metal !== undefined ? { metal: tx.amount.metal } : {}),
        ...(tx.amount?.energy !== undefined ? { energy: tx.amount.energy } : {}),
        ...(tx.amount?.researchPoints !== undefined ? { researchPoints: tx.amount.researchPoints } : {}),
      },
      timestamp: tx.timestamp ? new Date(tx.timestamp) : new Date(0),
      description: tx.description ?? '',
    })),
    upgradeLevel: row.bank_upgrade_level ?? 1,
    capacity: row.bank_capacity ?? 0,
  };

  const research: Clan['research'] = {
    researchPoints: row.research_research_points ?? 0,
    unlockedTechs,
    activeResearch: row.research_active_research ?? null,
  };

  return {
    name: row.name,
    tag: row.tag,
    description: row.description,
    leaderId: row.leader_id,
    members,
    maxMembers: row.max_members ?? 20,
    level,
    createdAt: new Date(row.created_at),
    settings: {
      messageOfTheDay: row.settings_message_of_the_day ?? '',
      isRecruiting: toBoolean(row.settings_is_recruiting),
      minLevelToJoin: row.settings_min_level_to_join ?? 1,
      requiresApproval: toBoolean(row.settings_requires_approval),
      allowTerritoryControl: toBoolean(row.settings_allow_territory_control),
      allowWarDeclarations: toBoolean(row.settings_allow_war_declarations),
    },
    stats: {
      totalPower: row.stats_total_power ?? 0,
      totalTerritories: row.stats_total_territories ?? 0,
      totalMonuments: row.stats_total_monuments ?? 0,
      warsWon: row.stats_wars_won ?? 0,
      warsLost: row.stats_wars_lost ?? 0,
      totalRP: row.stats_total_rp ?? 0,
    },
    bank,
    research,
    territories: territoryList.map((territory) => ({
      tileX: territory.x,
      tileY: territory.y,
      clanId: territory.clanId,
      claimedAt: territory.claimedAt,
      claimedBy: territory.claimedBy,
      // Per-tile defense bonus is not stored — computed from adjacency via the
      // territory service (the modal renders this value directly).
      defenseBonus: getDefenseBonus(
        row.id,
        territory.x,
        territory.y,
        territoryList
      ),
    })),
    wars: { active: [], history: [] },
    // clanPerkService stores full ClanPerk objects (catalog + activation metadata)
    // into this jsonb column — the stored shape is the domain shape.
    activePerks: parseJsonField<ClanPerk[]>(row.active_perks, []),
    // Schema annotates monuments as $type<string[]>(); writers store MonumentType values.
    monuments: parseJsonField<MonumentType[]>(row.monuments, []),
  };
}

// ============================================================================
// Analytics builder
// ============================================================================

/** Analytics payload satisfying the modal's ClanAnalytics render contract. */
interface ClanAnalyticsPayload {
  totalPower: number;
  alerts: Array<{ message: string }>;
  recentActivity: {
    bankTransactions: number;
    memberChanges: number;
    territoryClaims: number;
    warsDeclared: number;
  };
  totalDeposits: number;
  totalWithdrawals: number;
  activities: Array<{ description: string; timestamp: string; type: string }>;
  alliances: Array<{ clanIds: string[]; createdAt: string; terms?: string }>;
  healthScore: number;
}

function buildAnalytics(clan: Clan): ClanAnalyticsPayload {
  const members = clan.members;

  // --- 24h activity counters (zero-initialized; filled from clan_activities in the handler) ---
  const recent = {
    bankTransactions: 0,
    memberChanges: 0,
    territoryClaims: 0,
    warsDeclared: 0,
  };

  // --- Alerts: real signals only ---
  const alerts: Array<{ message: string }> = [];
  const nowMs = Date.now();
  const inactive = members.filter((m) => {
    const last = m.lastActive ? new Date(m.lastActive).getTime() : 0;
    return nowMs - last > 7 * 24 * 60 * 60 * 1000;
  });
  if (inactive.length > 0) {
    alerts.push({ message: `${inactive.length} member(s) inactive for 7+ days` });
  }

  // Near-empty treasury
  const treasuryTotal = clan.bank.treasury.metal + clan.bank.treasury.energy;
  if (treasuryTotal < 1000) {
    alerts.push({ message: `Clan treasury is low (${treasuryTotal.toLocaleString()} combined)` });
  }

  // Membership pressure
  if (members.length < 3) {
    alerts.push({ message: `Clan membership critically low (${members.length})` });
  }

  // --- Health score: activity, growth, stability ---
  // 1. Activity (0-40): members active in the last 7 days
  const activeRecent = members.filter((m) => {
    const last = m.lastActive ? new Date(m.lastActive).getTime() : 0;
    return nowMs - last <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const activityScore = members.length > 0 ? (activeRecent / members.length) * 40 : 0;

  // 2. Membership (0-20): fill ratio against the clan's cap
  const membershipScore = clan.maxMembers > 0
    ? Math.min(members.length / clan.maxMembers, 1) * 20
    : 0;

  // 3. Financial (0-20): treasury against bank capacity
  const financialScore = clan.bank.capacity > 0
    ? Math.min(treasuryTotal / clan.bank.capacity, 1) * 20
    : (treasuryTotal > 0 ? 20 : 0);

  // 4. Warfare (0-10): won wars, floored at 0
  const warfareScore = Math.min(Math.max(clan.stats.warsWon - clan.stats.warsLost, 0) * 2, 10);

  // 5. Expansion (0-10): territories against the level cap tier
  const expansionScore = Math.min(clan.territories.length / 10, 1) * 10;

  const healthScore = Math.round(
    activityScore + membershipScore + financialScore + warfareScore + expansionScore
  );

  // --- Aggregates filled from SQL in the handler (activities, alliances, totals, counters) ---
  return {
    totalPower: clan.stats.totalPower,
    alerts,
    recentActivity: recent,
    totalDeposits: 0,
    totalWithdrawals: 0,
    activities: [],
    alliances: [],
    healthScore,
  };
}

// ============================================================================
// Route handler
// ============================================================================

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminClanAnalyticsAPI');
  const endTimer = log.time('clan-analytics');

  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    // Check admin privileges
    if (tokenPayload.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin privileges required',
      });
    }

    // Validate params
    const clanId = request.nextUrl.searchParams.get('clanId')?.trim();
    if (!clanId) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        message: 'clanId query parameter is required',
      });
    }

    // --- Clan row (raw SQL: pg-dialect-safe; see module docstring) ---
    const clanRows = getQueryRows(
      await db.execute(sql`SELECT * FROM clans WHERE id = ${clanId}::text LIMIT 1`)
    ) as unknown as ClanSqlRow[];

    const clanRow = clanRows[0];
    if (!clanRow) {
      return createErrorResponse(ErrorCode.CLAN_NOT_FOUND, {
        message: `Clan ${clanId} not found`,
      });
    }

    const clan = mapClanRow(clanRow);
    const analytics = buildAnalytics(clan);

    // --- Bank deposit/withdrawal totals (from retained bank-transactions history) ---
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    for (const tx of clan.bank.transactions) {
      const amount = (tx.amount?.metal ?? 0) + (tx.amount?.energy ?? 0) + (tx.amount?.researchPoints ?? 0);
      if (tx.type === 'DEPOSIT') totalDeposits += amount;
      if (tx.type === 'WITHDRAWAL') totalWithdrawals += amount;
    }
    analytics.totalDeposits = totalDeposits;
    analytics.totalWithdrawals = totalWithdrawals;

    // --- Activity log (last 50, canonical columns) ---
    const activityRows = getQueryRows(
      await db.execute(sql`
        SELECT id, clan_id, activity_type, player_id, username, details, timestamp
        FROM clan_activities
        WHERE clan_id = ${clanId}::text
        ORDER BY timestamp DESC
        LIMIT 50
      `)
    ) as unknown as ActivitySqlRow[];

    analytics.activities = activityRows.map((row) => {
      const details = parseJsonField<Record<string, unknown> | null>(row.details ?? null, null);
      const description = typeof details?.description === 'string'
        ? details.description
        : typeof row.details === 'string' && row.details
          ? row.details
          : row.activity_type;
      return {
        description,
        timestamp: new Date(row.timestamp).toISOString(),
        type: row.activity_type,
      };
    });

    // --- 24h counters (canonical types; territoryService's divergent columns are
    //     invisible here until SCOPE #16 is reconciled) ---
    const counterRows = getQueryRows(
      await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE activity_type IN ('BANK_DEPOSIT', 'BANK_WITHDRAWAL', 'TAX_COLLECTION')) AS bank_transactions,
          COUNT(*) FILTER (WHERE activity_type IN ('MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_KICKED', 'MEMBER_PROMOTED', 'MEMBER_DEMOTED', 'LEADERSHIP_TRANSFERRED')) AS member_changes,
          COUNT(*) FILTER (WHERE activity_type IN ('TERRITORY_CLAIMED', 'TERRITORY_LOST')) AS territory_claims,
          COUNT(*) FILTER (WHERE activity_type IN ('WAR_DECLARED', 'WAR_ENDED')) AS wars_declared
        FROM clan_activities
        WHERE clan_id = ${clanId}::text
          AND timestamp >= NOW() - INTERVAL '24 hours'
      `)
    ) as unknown as RecentCountersSqlRow[];

    const counters = counterRows[0];
    if (counters) {
      analytics.recentActivity = {
        bankTransactions: Number(counters.bank_transactions) || 0,
        memberChanges: Number(counters.member_changes) || 0,
        territoryClaims: Number(counters.territory_claims) || 0,
        warsDeclared: Number(counters.wars_declared) || 0,
      };
    }

    // --- Active alliances involving this clan (pg jsonb containment) ---
    const allianceRows = getQueryRows(
      await db.execute(sql`
        SELECT id, clan_ids, status, proposed_at, metadata
        FROM clan_alliances
        WHERE status = 'ACTIVE'
          AND clan_ids @> ${JSON.stringify([clanId])}::jsonb
        ORDER BY proposed_at DESC
        LIMIT 20
      `)
    ) as unknown as AllianceSqlRow[];

    analytics.alliances = allianceRows.map((row) => {
      const meta = parseJsonField<Record<string, unknown> | null>(row.metadata ?? null, null);
      const terms = typeof meta?.terms === 'string' ? meta.terms : undefined;
      return {
        clanIds: parseJsonField<string[]>(row.clan_ids, []),
        createdAt: new Date(row.proposed_at).toISOString(),
        ...(terms !== undefined ? { terms } : {}),
      };
    });

    log.info('Clan analytics retrieved', {
      clanId,
      members: clan.members.length,
      territories: clan.territories.length,
      activities: analytics.activities.length,
      alliances: analytics.alliances.length,
      healthScore: analytics.healthScore,
    });

    return NextResponse.json({
      success: true,
      clan,
      analytics,
    });
  } catch (error) {
    log.error('Failed to fetch clan analytics', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
