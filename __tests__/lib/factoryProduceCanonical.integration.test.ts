// @vitest-environment node
/**
 * @file __tests__/lib/factoryProduceCanonical.integration.test.ts
 * @overview FID-20261002-004 §5 acceptance — the LEGACY production seam
 *           (factoryService.produceUnit) on a REAL disposable PostgreSQL:
 *           - canonical owned-army write (players.units, blueprint id +
 *             canonical unitType stored separately, distinct instance id);
 *           - capacity refusal on the locked, regenerated row (no writes);
 *           - concurrency conservation: two concurrent produces both land;
 *             with resources for exactly one, exactly one pays (no overdraw).
 *
 * Same safety contract as the FID-002/011 suites: refuses production-shaped
 * URLs, self-provisions an embedded cluster, self-skips in CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const EXTERNAL_URL = process.env.ECHO_DISPOSABLE_DATABASE_URL;
const AUTO_PROVISION = process.env.ECHO_AUTO_DISPOSABLE_PG === '1';

function assertDisposableTarget(url: string): void {
  const productionShaped = /(supabase|pooler|rds\.amazonaws|neon\.tech|render\.com|amazonaws|azure|heroku|elephantsql)/i;
  if (productionShaped.test(url)) {
    throw new Error('Disposable-database URL looks like a PRODUCTION target — refusing.');
  }
}
if (EXTERNAL_URL) assertDisposableTarget(EXTERNAL_URL);

const skipSuite = !EXTERNAL_URL && !AUTO_PROVISION;

describe.skipIf(skipSuite)('FID-20261002-004 — produceUnit canonical seam (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-004'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-004'),
        user: 'postgres',
        password: 'disposable',
        port: 55434,
        persistent: false,
        postgresFlags: [
          '-c', 'ssl=on',
          '-c', `ssl_cert_file=${resolve('dev/tmp/pg-certs/server.crt')}`,
          '-c', `ssl_key_file=${resolve('dev/tmp/pg-certs/server.key')}`,
        ],
      });
      await instance.initialise();
      await instance.start();
      embedded = instance;
      url = 'postgresql://postgres:disposable@localhost:55434/postgres';
    }
    assertDisposableTarget(url);
    adminPool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username varchar(20) PRIMARY KEY,
        resources_metal integer NOT NULL DEFAULT 0,
        resources_energy integer NOT NULL DEFAULT 0,
        total_strength integer NOT NULL DEFAULT 0,
        total_defense integer NOT NULL DEFAULT 0,
        units jsonb NOT NULL DEFAULT '[]',
        inventory_items jsonb NOT NULL DEFAULT '[]',
        unlocked_tiers jsonb NOT NULL DEFAULT '[]',
        level integer NOT NULL DEFAULT 1,
        research_points integer NOT NULL DEFAULT 0,
        specialization jsonb,
        stats jsonb,
        achievements jsonb,
        discoveries jsonb,
        rp_history jsonb,
        vip smallint DEFAULT 0,
        vip_expiration timestamptz
      );
      CREATE TABLE IF NOT EXISTS factories (
        x smallint NOT NULL,
        y smallint NOT NULL,
        owner varchar(20),
        defense integer NOT NULL DEFAULT 0,
        level integer NOT NULL DEFAULT 1,
        slots integer NOT NULL DEFAULT 0,
        used_slots integer NOT NULL DEFAULT 0,
        invested_metal integer NOT NULL DEFAULT 0,
        invested_energy integer NOT NULL DEFAULT 0,
        production_rate numeric(5,2) NOT NULL DEFAULT 0,
        last_slot_regen timestamptz NOT NULL DEFAULT NOW(),
        last_resource_generation timestamptz,
        last_attacked_by varchar(20),
        last_attack_time timestamptz,
        PRIMARY KEY (x, y)
      );
    `);
  }, 120000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, factories CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(username: string, opts: { metal?: number; energy?: number } = {}): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, resources_metal, resources_energy)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET
         resources_metal = $2, resources_energy = $3, units = '[]'::jsonb,
         inventory_items = '[]'::jsonb, total_strength = 0, total_defense = 0`,
      [username, opts.metal ?? 10000, opts.energy ?? 10000],
    );
  }

  async function seedFactory(x: number, y: number, owner: string, opts: { usedSlots?: number; level?: number } = {}): Promise<void> {
    await adminPool.query(
      `INSERT INTO factories (x, y, owner, level, slots, used_slots, last_slot_regen)
       VALUES ($1, $2, $3, $4, 1750, $5, NOW())
       ON CONFLICT (x, y) DO UPDATE SET owner = $3, level = $4, used_slots = $5, last_slot_regen = NOW()`,
      [x, y, owner, opts.level ?? 10, opts.usedSlots ?? 0],
    );
  }

  it('produces through the CANONICAL army contract: units entry with blueprint id + persisted unitType, totals raised, inventory blob untouched', async () => {
    await seedPlayer('prod_canon');
    await seedFactory(1, 1, 'prod_canon');

    const { produceUnit } = await import('@/lib/factoryService');
    const result = await produceUnit('prod_canon', 1, 1);
    expect(result.success).toBe(true);

    const row = (await adminPool.query(`SELECT units, inventory_items, resources_metal, resources_energy, total_strength FROM players WHERE username = 'prod_canon'`)).rows[0];
    // Canonical owned army — the legacy inventoryItems blob is no longer written.
    expect(row.units).toHaveLength(1);
    expect(row.units[0].unitType).toBe('T1_RIFLEMAN'); // persisted enum value
    expect(row.units[0].unitId).toBe('rifleman');      // blueprint id, stored separately
    expect(row.units[0].strength).toBe(95); // canonical catalog STR (the legacy seam hardcoded 5)
    expect(row.units[0].quantity).toBe(1);
    expect(row.units[0].producedAt).toEqual({ x: 1, y: 1 });
    expect(row.inventory_items).toHaveLength(0);
    // Legacy cost contract preserved: 100 Metal + 50 Energy.
    expect(row.resources_metal).toBe(9900);
    expect(row.resources_energy).toBe(9950);
    // Aggregate totals maintained (FID-20260908-003 addendum), canonical stats.
    expect(row.total_strength).toBe(95);

    const factory = (await adminPool.query(`SELECT used_slots FROM factories WHERE x = 1 AND y = 1`)).rows[0];
    expect(factory.used_slots).toBe(1);
  });

  it('refuses at capacity on the locked, regenerated row — no partial writes', async () => {
    await seedPlayer('prod_full');
    await seedFactory(2, 2, 'prod_full', { usedSlots: 1750 });

    const { produceUnit } = await import('@/lib/factoryService');
    const result = await produceUnit('prod_full', 2, 2);
    expect(result.success).toBe(false);
    expect(result.message).toContain('capacity');

    const row = (await adminPool.query(`SELECT units, resources_metal FROM players WHERE username = 'prod_full'`)).rows[0];
    expect(row.units).toHaveLength(0);
    expect(row.resources_metal).toBe(10000);
    const factory = (await adminPool.query(`SELECT used_slots FROM factories WHERE x = 2 AND y = 2`)).rows[0];
    expect(factory.used_slots).toBe(1750);
  });

  it('concurrent produces both land — no lost update, slots and debits compose exactly', async () => {
    await seedPlayer('prod_race');
    await seedFactory(3, 3, 'prod_race');

    const { produceUnit } = await import('@/lib/factoryService');
    const [a, b] = await Promise.all([
      produceUnit('prod_race', 3, 3),
      produceUnit('prod_race', 3, 3),
    ]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);

    const row = (await adminPool.query(`SELECT units, resources_metal, resources_energy, total_strength FROM players WHERE username = 'prod_race'`)).rows[0];
    expect(row.units).toHaveLength(2);
    // Distinct instance ids, even for builds within the same millisecond.
    expect(row.units[0].id).not.toBe(row.units[1].id);
    expect(row.resources_metal).toBe(9800); // 2 × 100 debited, no lost update
    expect(row.resources_energy).toBe(9900);
    expect(row.total_strength).toBe(190); // 2 × canonical 95 STR
    const factory = (await adminPool.query(`SELECT used_slots FROM factories WHERE x = 3 AND y = 3`)).rows[0];
    expect(factory.used_slots).toBe(2);
  });

  it('resources for exactly ONE produce: exactly one succeeds and pays — no overdraw', async () => {
    await seedPlayer('prod_overdraw', { metal: 100, energy: 50 });
    await seedFactory(4, 4, 'prod_overdraw');

    const { produceUnit } = await import('@/lib/factoryService');
    const [a, b] = await Promise.all([
      produceUnit('prod_overdraw', 4, 4),
      produceUnit('prod_overdraw', 4, 4),
    ]);
    const successes = [a, b].filter((r) => r.success);
    expect(successes).toHaveLength(1);

    const row = (await adminPool.query(`SELECT units, resources_metal, resources_energy FROM players WHERE username = 'prod_overdraw'`)).rows[0];
    expect(row.units).toHaveLength(1);
    expect(row.resources_metal).toBe(0);  // exactly one 100-metal debit
    expect(row.resources_energy).toBe(0); // exactly one 50-energy debit
  });
});
