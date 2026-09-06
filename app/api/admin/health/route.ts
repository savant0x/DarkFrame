/**
 * @file app/api/admin/health/route.ts
 * @created 2026-09-06
 * @overview Admin health strip (FID-20260906-003 S7).
 *
 * GET /api/admin/health — admin-only, read-only. The panel header renders this
 * payload so silent infra failures (missing CRON_SECRET, migration drift,
 * unacknowledged WMD alerts) surface in the operator's face instead of
 * hiding behind zero-count UIs.
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     db: { ok, latencyMs },
 *     migrations: { latest, upToDate },
 *     env: { jwtSecret, databaseUrl, cronSecret, stripeSecretKey },  // presence only
 *     cron: { reachable, note },
 *     wmdAlerts: { unacknowledged, latest: [{ type, severity, message, createdAt }] },
 *     checkedAt: ISO string
 *   }
 * }
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { wmdAdminAlerts } from '@/lib/db/schema';
import { desc, ne, sql } from 'drizzle-orm';
import { readdirSync } from 'fs';
import { join } from 'path';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/** Env vars checked for PRESENCE only — values are never echoed. */
const ENV_CHECKS = {
  jwtSecret: 'JWT_SECRET',
  databaseUrl: 'DATABASE_URL',
  cronSecret: 'CRON_SECRET',
  stripeSecretKey: 'STRIPE_SECRET_KEY',
} as const;

/**
 * Newest migration file (NNNN_*.sql) and its schema signatures.
 * Project migrations are applied idempotently — sometimes out-of-band — so
 * drizzle's bookkeeping row count is NOT a drift signal. Instead we verify the
 * newest file's CREATE TABLE / ADD COLUMN objects really exist in the DB.
 */
function newestMigration(): { name: string; tables: string[]; columns: Array<{ table: string; column: string }> } | null {
  try {
    const dir = join(process.cwd(), 'lib', 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
    if (files.length === 0) return null;
    const name = files[files.length - 1];
    const content = readdirRead(join(dir, name));
    const tables = [...content.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
    const columns = [...content.matchAll(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)/g)]
      .map((m) => ({ table: m[1], column: m[2] }));
    return { name, tables, columns };
  } catch {
    return null; // bundled runtime — skip the drift check
  }
}

function readdirRead(path: string): string {
 // eslint-disable-next-line @typescript-eslint/no-require-imports -- sync read in a health probe
 return require('fs').readFileSync(path, 'utf8');
}

export const GET = withRequestLogging(rateLimiter(async () => {
  const log = createRouteLogger('AdminHealthAPI');
  const endTimer = log.time('admin-health');

  try {
    // Read-only endpoint: cookies()-based identity (same pattern as bot-config
    // GET) — requireAdmin needs NextRequest cookie access we don't use here.
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, { message: 'Authentication required' });
    }
    if (auth.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, { message: 'Admin access required' });
    }

    // --- DB check (SELECT 1 with latency) ---
    const dbStart = Date.now();
    let dbOk = false;
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }
    const latencyMs = Date.now() - dbStart;

    // --- Migration drift: verify the newest migration's objects exist. ---
    let latest = 'unknown';
    let upToDate = true;
    const newest = newestMigration();
    if (dbOk && newest) {
      latest = newest.name;
      try {
        for (const t of newest.tables) {
          const res = await db.execute<{ n: number }>(
            sql`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${t}`,
          );
          if (Number(res.rows?.[0]?.n ?? 0) === 0) upToDate = false;
        }
        for (const c of newest.columns) {
          const res = await db.execute<{ n: number }>(
            sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${c.table} AND column_name = ${c.column}`,
          );
          if (Number(res.rows?.[0]?.n ?? 0) === 0) upToDate = false;
        }
      } catch {
        // introspection failed — report the drift signal anyway
        upToDate = false;
      }
    }

    // --- Env presence ---
    const env = Object.fromEntries(
      Object.entries(ENV_CHECKS).map(([key, name]) => [key, Boolean(process.env[name])]),
    ) as Record<keyof typeof ENV_CHECKS, boolean>;

    // --- Cron reachability (only meaningful with a secret configured) ---
    let cron: { reachable: boolean; note: string } = {
      reachable: false,
      note: 'CRON_SECRET not set — cron endpoints are unauthenticated-refused or unreachable',
    };
    if (env.cronSecret && process.env.VERCEL_URL) {
      try {
        const res = await fetch(`https://${process.env.VERCEL_URL}/api/cron/flag-bot-movement`, {
          method: 'HEAD',
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          signal: AbortSignal.timeout(4000),
        });
        // 405/404 still proves the route is alive behind auth wiring; 401/403 = secret mismatch.
        cron = res.status === 401 || res.status === 403
          ? { reachable: true, note: `route reachable but CRON_SECRET mismatch (HTTP ${res.status})` }
          : { reachable: true, note: `HTTP ${res.status}` };
      } catch (err) {
        cron = { reachable: false, note: `self-ping failed: ${err instanceof Error ? err.message : 'unknown'}` };
      }
    } else if (env.cronSecret) {
      cron = { reachable: false, note: 'CRON_SECRET set but VERCEL_URL unknown locally — skipped self-ping' };
    }

    // --- Unacknowledged WMD alerts (operator-facing hook to the WMD tab) ---
    let wmdAlerts: {
      unacknowledged: number;
      latest: Array<{ type: string; severity: string; message: string; createdAt: Date }>;
    } = { unacknowledged: 0, latest: [] };
    if (dbOk) {
      const [countRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(wmdAdminAlerts)
        .where(ne(wmdAdminAlerts.status, 'ACKNOWLEDGED'));
      const latestRows = await db
        .select({
          type: wmdAdminAlerts.type,
          severity: wmdAdminAlerts.severity,
          message: wmdAdminAlerts.message,
          createdAt: wmdAdminAlerts.createdAt,
        })
        .from(wmdAdminAlerts)
        .where(ne(wmdAdminAlerts.status, 'ACKNOWLEDGED'))
        .orderBy(desc(wmdAdminAlerts.createdAt))
        .limit(5);
      wmdAlerts = {
        unacknowledged: countRow?.n ?? 0,
        latest: latestRows,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        db: { ok: dbOk, latencyMs },
        migrations: { latest, upToDate },
        env,
        cron,
        wmdAlerts,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('Admin health check failed', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
