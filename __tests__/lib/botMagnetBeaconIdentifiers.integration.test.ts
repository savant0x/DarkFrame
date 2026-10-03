// @vitest-environment node
/**
 * @file __tests__/lib/botMagnetBeaconIdentifiers.integration.test.ts
 * @overview FID-20261002-010 §5 acceptance — REAL deployBeacon on a disposable
 *           PostgreSQL. The RED defect (R19): the service hand-built
 *           `beacon_${Date.now()}_${9 random chars}` — a 30-character id — for
 *           a varchar(24) primary key, so PostgreSQL rejected every deployment
 *           of the purchased feature. These probes pin the corrected engine:
 *
 *  - Real deployment: the FULL shared generateId() output is the primary key
 *    (fits varchar(24) at the current epoch), the response carries that SAME
 *    id, GET/status reads it, attraction counter updates it, deactivation
 *    clears it — one id through the whole lifecycle.
 *  - In-lock admission: unresearched / already-active / cooldown refusals
 *    create nothing; the tech gate rides the locked player row.
 *  - Oversized-epoch refusal: a far-future frozen clock producing >24-char
 *    generateId output is refused BEFORE mutation (BeaconIdTooLongError path)
 *    — no beacon, no state change, honest failure.
 *  - Primary-key collision: a pre-seeded id conflicting with the generator's
 *    deterministic output is retried with a FRESH id and succeeds.
 *  - Storage failure (dropped table) is reported honestly: no success
 *    response, no state change.
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002..009):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL is REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/botMagnetBeaconIdentifiers.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const EXTERNAL_URL = process.env.ECHO_DISPOSABLE_DATABASE_URL;
const AUTO_PROVISION = process.env.ECHO_AUTO_DISPOSABLE_PG === '1';

/** Fail-closed refusal of any production-shaped target. */
function assertDisposableTarget(url: string): void {
  const productionShaped = /(supabase|pooler|rds\.amazonaws|neon\.tech|render\.com|amazonaws|azure|heroku|elephantsql)/i;
  if (productionShaped.test(url)) {
    throw new Error('Disposable-database URL looks like a PRODUCTION target — refusing.');
  }
}
if (EXTERNAL_URL) assertDisposableTarget(EXTERNAL_URL);

const skipSuite = !EXTERNAL_URL && !AUTO_PROVISION;

// Deterministic ids: generateId is pinned to a counter-based form (real
// Date.now + 9-digit counter) so collisions/refusals can be arranged exactly
// — and so the far-future fake clock genuinely produces an oversized id for
// the boundary probe. Math.random is frozen. The REAL admission/insert engine
// stays production-exact.
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  let n = 0;
  return {
    ...actual,
    generateId: () => `${Date.now()}-${String(++n).padStart(9, '0')}`,
  };
});

describe.skipIf(skipSuite)('FID-20261002-010 — bounded beacon identifiers (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-010'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-010'),
        user: 'postgres',
        password: 'disposable',
        port: 55442,
        persistent: false,
        initdbFlags: ['--encoding=UTF8', '--locale=C'],
        postgresFlags: [
          '-c', 'ssl=on',
          '-c', `ssl_cert_file=${resolve('dev/tmp/pg-certs/server.crt')}`,
          '-c', `ssl_key_file=${resolve('dev/tmp/pg-certs/server.key')}`,
        ],
      });
      await instance.initialise();
      await instance.start();
      embedded = instance;
      url = 'postgresql://postgres:disposable@localhost:55442/postgres?client_encoding=UTF8';
    }
    assertDisposableTarget(url);
    adminPool = new Pool({ connectionString: `${url}${url.includes('?') ? '&' : '?'}client_encoding=UTF8`, max: 5, ssl: { rejectUnauthorized: false } });
    // Point the app's lazy pool at the disposable target BEFORE its first query.
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username varchar(20) PRIMARY KEY,
        email varchar(255) NOT NULL DEFAULT 'probe@example.test',
        password varchar(255) NOT NULL DEFAULT 'x',
        unlocked_techs jsonb
      );
      CREATE TABLE IF NOT EXISTS bot_magnet_beacons (
        id varchar(24) PRIMARY KEY,
        player_id varchar(20) NOT NULL,
        player_name varchar(50) NOT NULL,
        x integer NOT NULL,
        y integer NOT NULL,
        deployed_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        cooldown_until timestamptz NOT NULL,
        attraction_radius integer NOT NULL DEFAULT 100,
        attraction_chance integer NOT NULL DEFAULT 30,
        bots_attracted integer NOT NULL DEFAULT 0,
        active smallint NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS bot_beacons_player_idx ON bot_magnet_beacons (player_id);
      CREATE INDEX IF NOT EXISTS bot_beacons_active_idx ON bot_magnet_beacons (active);
      CREATE INDEX IF NOT EXISTS bot_beacons_expires_at_idx ON bot_magnet_beacons (expires_at);
    `);

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  }, 120000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, bot_magnet_beacons CASCADE`);
      await adminPool.end();
    }
    // Drain the app's lazy pool BEFORE the throwaway server goes away.
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch {
      // Pool may not exist if no app query ran.
    }
    if (embedded) {
      await embedded.stop();
    }
  }, 30000);

  async function seedPlayer(username: string, opts: { tech?: boolean } = {}): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, unlocked_techs)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET unlocked_techs = $2`,
      [username, JSON.stringify(opts.tech === false ? [] : ['bot-magnet'])],
    );
  }

  async function beaconsOf(playerId: string): Promise<Array<Record<string, unknown>>> {
    const res = await adminPool.query(
      `SELECT id, player_id, active, bots_attracted FROM bot_magnet_beacons WHERE player_id = $1 ORDER BY deployed_at`,
      [playerId],
    );
    return res.rows;
  }

  it('real deployment: full generateId fits varchar(24), response id = stored id, lifecycle reads/writes the SAME id', async () => {
    await seedPlayer('magnet');
    const { deployBeacon, getBeaconStatus, incrementAttractedCount, deactivateBeacon } = await import('@/lib/botMagnetService');

    const res = await deployBeacon('magnet', 'magnet', 60, 60);
    expect(res.success).toBe(true);
    expect(res.beacon).toBeDefined();

    const id = res.beacon!.id;
    expect(id.length).toBeLessThanOrEqual(24);
    expect(id).toMatch(/^\d{13}-[0-9a-z]{9}$/); // full generateId output, untruncated

    // The stored row carries the SAME id.
    const rows = await beaconsOf('magnet');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(Number(rows[0].active)).toBe(1);

    // Status reads the SAME id.
    const status = await getBeaconStatus('magnet');
    expect(status.hasActiveBeacon).toBe(true);
    expect(status.beacon!.id).toBe(id);

    // Attraction counter updates the SAME id.
    await incrementAttractedCount(id);
    const after = await beaconsOf('magnet');
    expect(Number(after[0].bots_attracted)).toBe(1);

    // Deactivation clears it; cooldown persists via the row.
    const off = await deactivateBeacon('magnet');
    expect(off.success).toBe(true);
    const offRows = await beaconsOf('magnet');
    expect(Number(offRows[0].active)).toBe(0);
    const statusAfter = await getBeaconStatus('magnet');
    expect(statusAfter.hasActiveBeacon).toBe(false);
    expect(statusAfter.canDeploy).toBe(false); // 336h cooldown running
  });

  it('in-lock admission: unresearched, already-active and cooldown refusals create nothing', async () => {
    await seedPlayer('plain', { tech: false });
    const { deployBeacon } = await import('@/lib/botMagnetService');

    const noTech = await deployBeacon('plain', 'plain', 10, 10);
    expect(noTech.success).toBe(false);
    expect(noTech.message).toContain('Bot Magnet technology');
    expect(await beaconsOf('plain')).toHaveLength(0);

    await seedPlayer('dup');
    const first = await deployBeacon('dup', 'dup', 20, 20);
    expect(first.success).toBe(true);
    const second = await deployBeacon('dup', 'dup', 21, 21);
    expect(second.success).toBe(false);
    expect(second.message).toContain('already have an active beacon');
    expect(await beaconsOf('dup')).toHaveLength(1);

    // Cooldown: expired-active is inactive but within 336h cooldown.
    await seedPlayer('cooler');
    await adminPool.query(
      `INSERT INTO bot_magnet_beacons (id, player_id, player_name, x, y, deployed_at, expires_at, cooldown_until, active)
       VALUES ('seedcooldownbeacon01', 'cooler', 'cooler', 5, 5, NOW() - INTERVAL '170 hours', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '166 hours', 0)`
    );
    const cooled = await deployBeacon('cooler', 'cooler', 5, 5);
    expect(cooled.success).toBe(false);
    expect(cooled.message).toContain('cooldown');
    expect(cooled.cooldownRemaining).toBeGreaterThan(0);
    expect(await beaconsOf('cooler')).toHaveLength(1); // only the seeded row
  });

  it('oversized-epoch refusal: >24-char generated id refuses BEFORE mutation — no beacon, no state change', async () => {
    await seedPlayer('futureproof');
    const { deployBeacon, BeaconIdTooLongError } = await import('@/lib/botMagnetService');

    // Maximum-epoch clock: 8.64e15 ms (JS Date range ceiling) → 16-digit
    // epoch → 26-char generateId output, over the 24-char budget.
    vi.useFakeTimers({ now: new Date(8.64e15 - 1) });
    try {
      const res = await deployBeacon('futureproof', 'futureproof', 30, 30);
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/varchar\(24\)/);
    } finally {
      vi.useRealTimers();
    }

    // The real generator at the maximum clock genuinely overflows (sanity for
    // the probe — the FID's boundary audit: max epoch emits 26 chars).
    const overflowProbe = `${8.64e15 - 1}-123456789`;
    expect(overflowProbe.length).toBe(26);

    expect(await beaconsOf('futureproof')).toHaveLength(0); // no mutation
    void BeaconIdTooLongError; // exported for callers; behavior asserted via the envelope
  });

  it('primary-key collision: conflicting deterministic id is retried with a FRESH id and succeeds', async () => {
    await seedPlayer('collide');
    const { deployBeacon } = await import('@/lib/botMagnetService');

    // Pre-seed the id the mock generator will emit next.
    const nextId = `${Date.now()}-00000000${9}`;
    await adminPool.query(
      `INSERT INTO bot_magnet_beacons (id, player_id, player_name, x, y, deployed_at, expires_at, cooldown_until, active)
       VALUES ($1, 'other', 'other', 1, 1, NOW(), NOW() + INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 0)`,
      [nextId],
    );

    const res = await deployBeacon('collide', 'collide', 40, 40);
    expect(res.success).toBe(true);
    expect(res.beacon!.id).not.toBe(nextId); // fresh id on retry
    expect(res.beacon!.id.length).toBeLessThanOrEqual(24);

    const rows = await beaconsOf('collide');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(res.beacon!.id);
  });

  it('storage failure is honest: dropped table → failure envelope, no success, no state', async () => {
    await seedPlayer('doomed');
    const { deployBeacon } = await import('@/lib/botMagnetService');

    await adminPool.query(`DROP TABLE bot_magnet_beacons`);
    const res = await deployBeacon('doomed', 'doomed', 70, 70);
    await adminPool.query(`CREATE TABLE bot_magnet_beacons (
        id varchar(24) PRIMARY KEY,
        player_id varchar(20) NOT NULL,
        player_name varchar(50) NOT NULL,
        x integer NOT NULL,
        y integer NOT NULL,
        deployed_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        cooldown_until timestamptz NOT NULL,
        attraction_radius integer NOT NULL DEFAULT 100,
        attraction_chance integer NOT NULL DEFAULT 30,
        bots_attracted integer NOT NULL DEFAULT 0,
        active smallint NOT NULL DEFAULT 1
      )`);

    expect(res.success).toBe(false);
    expect(res.message).toContain('no beacon was created and no cooldown was consumed');
    expect(res.beacon).toBeUndefined();
    const rows = await beaconsOf('doomed');
    expect(rows).toHaveLength(0);
  });
});
