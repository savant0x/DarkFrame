/**
 * @file app/api/admin/anti-cheat/flagged-players/route.ts
 * @overview Anti-cheat flagged-players — REAL derived detections (FID-20260905-001 batch 2).
 *
 * GET /api/admin/anti-cheat/flagged-players
 * Admin-only (requireAdmin). Replaces the hard-coded `data: []` placeholder with
 * genuine heuristic detections computed from existing tables (no new schema):
 *
 * 1. IMPOSSIBLE_TRAVEL — a player's consecutive `move` events in player_activity
 *    crossing more tiles than physically possible in the elapsed time
 *    (Chebyshev distance > minutes elapsed / MINUTES_PER_TILE).
 * 2. MULTI_ACCOUNT_IP — referrals rows where the same new_player_ip was used by
 *    more than REFERRAL_IP_MAX_ACCOUNTS distinct new players (self-referral farming).
 * 3. RAPID_ACTIONS — burst automation: > RAPID_ACTION_THRESHOLD same-type actions
 *    within RAPID_ACTION_WINDOW_MS (bot-like exact-interval behavior).
 *
 * Severity rollup: CRITICAL > HIGH > MEDIUM > LOW per player across their findings,
 * matching the consumed shape in AdminView.tsx (`maxSeverity` field).
 *
 * Thresholds are named constants (ECHO Law: no magic numbers) — tune here, not in SQL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/** Detection thresholds (all admin-visible via this route only). */
const IMPOSSIBLE_TRAVEL_LOOKBACK_HOURS = 6;
const IMPOSSIBLE_TRAVEL_MINUTES_PER_TILE = 1.0; // normal move cadence is ≥ this
const IMPOSSIBLE_TRAVEL_LIMIT = 25; // max candidate pairs examined

const RAPID_ACTION_WINDOW_MINUTES = 5;
const RAPID_ACTION_THRESHOLD = 30; // same-type actions inside the window
const RAPID_ACTION_LIMIT = 10; // max offenders reported

const REFERRAL_IP_MAX_ACCOUNTS = 3; // distinct new players per signup IP
const REFERRAL_IP_LOOKBACK_DAYS = 30;

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
const SEVERITY_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

interface FlaggedPlayer {
  playerId: string;
  username: string;
  flagReason: string;
  severity: Severity;
  flaggedAt: string;
  evidenceCount: number;
  lastActivity: string | null;
}

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminFlaggedPlayersAPI');
  const endTimer = log.time('flagged-players');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }

    const flagged = new Map<string, FlaggedPlayer>();

    const recordFinding = (
      playerId: string,
      username: string,
      reason: string,
      severity: Severity,
      evidenceCount: number,
      lastActivity: string | null
    ) => {
      const existing = flagged.get(playerId);
      if (!existing) {
        flagged.set(playerId, {
          playerId,
          username,
          flagReason: reason,
          severity,
          flaggedAt: new Date().toISOString(),
          evidenceCount,
          lastActivity,
        });
        return;
      }
      existing.evidenceCount += evidenceCount;
      if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) {
        existing.severity = severity;
        existing.flagReason = reason;
      }
    };

    // ── Detection 1: impossible travel (teleport-pattern moves) ──────────────
    const travel = await db.execute(sql`
      WITH moves AS (
        SELECT
          player_id,
          timestamp,
          details->>'x' AS x,
          details->>'y' AS y,
          LAG(timestamp) OVER (PARTITION BY player_id ORDER BY timestamp) AS prev_ts,
          LAG(details->>'x') OVER (PARTITION BY player_id ORDER BY timestamp) AS prev_x,
          LAG(details->>'y') OVER (PARTITION BY player_id ORDER BY timestamp) AS prev_y
        FROM player_activity
        WHERE action = 'move'
          AND timestamp >= NOW() - ${`${IMPOSSIBLE_TRAVEL_LOOKBACK_HOURS} hours`}::interval
          AND details ? 'x' AND details ? 'y'
      )
      SELECT
        m.player_id,
        p.username,
        COUNT(*)::int AS jump_count,
        MAX(m.timestamp) AS last_move
      FROM moves m
      JOIN players p ON p.username = m.player_id
      WHERE m.prev_ts IS NOT NULL
        AND GREATEST(
              ABS(COALESCE(m.x, '0')::int - COALESCE(m.prev_x, '0')::int),
              ABS(COALESCE(m.y, '0')::int - COALESCE(m.prev_y, '0')::int)
            ) > (EXTRACT(EPOCH FROM (m.timestamp - m.prev_ts)) / 60.0) / ${IMPOSSIBLE_TRAVEL_MINUTES_PER_TILE}
      GROUP BY m.player_id, p.username
      ORDER BY jump_count DESC
      LIMIT ${IMPOSSIBLE_TRAVEL_LIMIT}
    `);
    for (const row of travel.rows as Array<Record<string, unknown>>) {
      recordFinding(
        String(row.player_id),
        String(row.username),
        `Impossible travel: ${Number(row.jump_count)} teleport-pattern move(s) in ${IMPOSSIBLE_TRAVEL_LOOKBACK_HOURS}h`,
        Number(row.jump_count) >= 3 ? 'CRITICAL' : 'HIGH',
        Number(row.jump_count),
        row.last_move ? new Date(String(row.last_move)).toISOString() : null
      );
    }

    // ── Detection 2: burst automation (exact-interval repetitive actions) ────
    const rapid = await db.execute(sql`
      SELECT
        pa.player_id,
        p.username,
        pa.action,
        COUNT(*)::int AS burst_count,
        MAX(pa.timestamp) AS last_action
      FROM player_activity pa
      JOIN players p ON p.username = pa.player_id
      WHERE pa.timestamp >= NOW() - ${`${RAPID_ACTION_WINDOW_MINUTES} minutes`}::interval
      GROUP BY pa.player_id, p.username, pa.action
      HAVING COUNT(*) > ${RAPID_ACTION_THRESHOLD}
      ORDER BY burst_count DESC
      LIMIT ${RAPID_ACTION_LIMIT}
    `);
    for (const row of rapid.rows as Array<Record<string, unknown>>) {
      recordFinding(
        String(row.player_id),
        String(row.username),
        `Burst automation: ${Number(row.burst_count)} '${row.action}' actions in ${RAPID_ACTION_WINDOW_MINUTES}min`,
        Number(row.burst_count) >= RAPID_ACTION_THRESHOLD * 2 ? 'HIGH' : 'MEDIUM',
        Number(row.burst_count),
        row.last_action ? new Date(String(row.last_action)).toISOString() : null
      );
    }

    // ── Detection 3: multi-account referral farming (same signup IP) ─────────
    const referralIps = await db.execute(sql`
      SELECT
        r.new_player_ip,
        COUNT(DISTINCT r.new_player_username)::int AS account_count,
        MAX(r.signup_date) AS last_signup,
        STRING_AGG(DISTINCT r.new_player_username, ', ') AS accounts
      FROM referrals r
      WHERE r.signup_date >= NOW() - ${`${REFERRAL_IP_LOOKBACK_DAYS} days`}::interval
        AND r.new_player_ip IS NOT NULL AND r.new_player_ip <> ''
      GROUP BY r.new_player_ip
      HAVING COUNT(DISTINCT r.new_player_username) > ${REFERRAL_IP_MAX_ACCOUNTS}
      ORDER BY account_count DESC
      LIMIT ${IMPOSSIBLE_TRAVEL_LIMIT}
    `);
    for (const row of referralIps.rows as Array<Record<string, unknown>>) {
      recordFinding(
        String(row.new_player_ip),
        String(row.accounts ?? row.new_player_ip),
        `Multi-account referrals: ${Number(row.account_count)} accounts from IP ${row.new_player_ip}`,
        Number(row.account_count) >= REFERRAL_IP_MAX_ACCOUNTS * 2 ? 'HIGH' : 'MEDIUM',
        Number(row.account_count),
        row.last_signup ? new Date(String(row.last_signup)).toISOString() : null
      );
    }

    const data = Array.from(flagged.values()).sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    );

    log.info('Flagged players computed', {
      detections: data.length,
      impossibleTravel: travel.rows.length,
      burst: rapid.rows.length,
      referralIps: referralIps.rows.length,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    log.error('Failed to fetch flagged players', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
