// @vitest-environment node
/**
 * @file __tests__/lib/armyIdentityResync.test.ts
 * @overview FID-20261002-004 §5.6 acceptance — the canonical army identity
 *           resync migration on a REAL disposable PostgreSQL:
 *           - dry-run reports everything and writes NOTHING;
 *           - apply normalizes recognized legacy identities ('titan',
 *             'T5_Titan') to the canonical persisted UnitType, preserving
 *             quantities and stats;
 *           - verified legacy inventoryItems Units move into units exactly
 *             once (legacy power preserved), removed only from inventoryItems;
 *           - totals recount through the ONE shared reducer;
 *           - running apply twice changes nothing (idempotent);
 *           - conflicting duplicates quarantine the player untouched.
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

describe.skipIf(skipSuite)('FID-20261002-004 — armyIdentityResync (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-004b'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-004b'),
        user: 'postgres',
        password: 'disposable',
        port: 55435,
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
      url = 'postgresql://postgres:disposable@localhost:55435/postgres';
    }
    assertDisposableTarget(url);
    adminPool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username varchar(20) PRIMARY KEY,
        units jsonb NOT NULL DEFAULT '[]',
        inventory_items jsonb NOT NULL DEFAULT '[]',
        total_strength integer NOT NULL DEFAULT 0,
        total_defense integer NOT NULL DEFAULT 0
      );
    `);
  }, 120000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(username: string, units: unknown[], inventory: unknown[], str = 0, def = 0): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, units, inventory_items, total_strength, total_defense)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)
       ON CONFLICT (username) DO UPDATE SET units = $2::jsonb, inventory_items = $3::jsonb,
         total_strength = $4, total_defense = $5`,
      [username, JSON.stringify(units), JSON.stringify(inventory), str, def],
    );
  }

  async function rowOf(username: string): Promise<Record<string, unknown>> {
    return (await adminPool.query(`SELECT units, inventory_items, total_strength, total_defense FROM players WHERE username = $1`, [username])).rows[0];
  }

  it('dry-run reports every correction and writes NOTHING', async () => {
    await seedPlayer(
      'resync_dry',
      [
        { id: 'u1', unitId: 'titan', unitType: 'titan', name: 'Titan', category: 'STR', rarity: 'legendary', strength: 5000, defense: 0, quantity: 2 },
        { id: 'u2', unitId: 'titan', unitType: 'T5_Titan', name: 'Titan', category: 'STR', rarity: 'legendary', strength: 5000, defense: 0, quantity: 1 },
      ],
      [{ id: 'u3', type: 'T1_RIFLEMAN', strength: 95, defense: 0, producedAt: { x: 1, y: 1 }, owner: 'resync_dry' }],
      0,
      0,
    );

    const { dryRunArmyIdentityResync } = await import('@/lib/migrations/armyIdentityResync');
    const report = await dryRunArmyIdentityResync();

    const corrections = report.corrections.filter((c) => c.username === 'resync_dry');
    expect(corrections.filter((c) => c.kind === 'unitType-normalized')).toHaveLength(2);
    expect(corrections.filter((c) => c.kind === 'legacy-moved')).toHaveLength(1);
    expect(report.totalsRecomputed).toBeGreaterThanOrEqual(1);

    // Purity: the database is untouched by the dry run.
    const row = await rowOf('resync_dry');
    expect((row.units as Array<Record<string, unknown>>)[0].unitType).toBe('titan');
    expect(row.inventory_items).toHaveLength(1);
    expect(row.total_strength).toBe(0);
  });

  it('apply normalizes identities, moves legacy units exactly once, recounts totals — and is idempotent', async () => {
    await seedPlayer(
      'resync_apply',
      [
        { id: 'u1', unitId: 'titan', unitType: 'titan', name: 'Titan', category: 'STR', rarity: 'legendary', strength: 5000, defense: 0, quantity: 2 },
        { id: 'u2', unitId: 'titan', unitType: 'T5_Titan', name: 'Titan', category: 'STR', rarity: 'legendary', strength: 5000, defense: 0, quantity: 1 },
      ],
      [{ id: 'u3', type: 'T1_RIFLEMAN', strength: 95, defense: 0, producedAt: { x: 1, y: 1 }, owner: 'resync_apply' }],
      0,
      0,
    );

    const { applyArmyIdentityResync } = await import('@/lib/migrations/armyIdentityResync');
    const first = await applyArmyIdentityResync();
    expect(first.playersChanged).toBeGreaterThanOrEqual(1);

    const row = await rowOf('resync_apply');
    const units = row.units as Array<Record<string, unknown>>;
    expect(units).toHaveLength(3);
    expect(units[0].unitType).toBe('T5_TITAN');  // 'titan' → canonical value
    expect(units[1].unitType).toBe('T5_TITAN');  // enum key → canonical value
    expect(units[0].quantity).toBe(2);           // quantities preserved
    expect(units[0].strength).toBe(5000);        // stats preserved
    // Legacy unit moved exactly once: same instance id, now a canonical entry.
    const moved = units.find((u) => u.id === 'u3') as Record<string, unknown>;
    expect(moved).toBeDefined();
    expect(moved.unitType).toBe('T1_RIFLEMAN');
    expect(moved.strength).toBe(95); // legacy power preserved
    expect(row.inventory_items).toHaveLength(0); // only migrated entries removed
    // Recount through the shared reducer: 2×5000 + 1×5000 + 95.
    expect(row.total_strength).toBe(15095);
    expect(row.total_defense).toBe(0);

    // Idempotency: a second apply changes nothing for this player.
    const second = await applyArmyIdentityResync();
    expect(second.corrections.filter((c) => c.username === 'resync_apply' && c.kind === 'unitType-normalized')).toHaveLength(0);
    expect(second.corrections.filter((c) => c.username === 'resync_apply' && c.kind === 'legacy-moved')).toHaveLength(0);
    const rowAgain = await rowOf('resync_apply');
    expect(rowAgain).toEqual(row);
  });

  it('conflicting duplicate instance ids quarantine the player untouched (report, never guess)', async () => {
    const conflicting = [
      { id: 'dupe', unitId: 'titan', unitType: 'T5_TITAN', name: 'Titan', category: 'STR', rarity: 'legendary', strength: 5000, defense: 0, quantity: 1 },
      { id: 'dupe', unitId: 'rifleman', unitType: 'T1_RIFLEMAN', name: 'Rifleman', category: 'STR', rarity: 'common', strength: 95, defense: 0, quantity: 3 },
    ];
    await seedPlayer('resync_conflict', conflicting, [], 5000, 0);

    const { applyArmyIdentityResync } = await import('@/lib/migrations/armyIdentityResync');
    const report = await applyArmyIdentityResync();

    const conflict = report.conflicts.find((c) => c.username === 'resync_conflict');
    expect(conflict).toBeDefined();
    expect(String(conflict!.reason)).toContain('conflicting duplicate');

    // Untouched: the ambiguous records stay exactly as they were.
    const row = await rowOf('resync_conflict');
    expect(row.units).toEqual(conflicting);
    expect(row.total_strength).toBe(5000);
  });

  it('unrecognized identities are reported as conflicts, never guessed', async () => {
    await seedPlayer(
      'resync_unknown',
      [{ id: 'weird', unitId: 'death_star', unitType: 'DEATH_STAR', name: '?', category: 'STR', rarity: 'common', strength: 1, defense: 0, quantity: 1 }],
      [],
      1,
      0,
    );

    const { applyArmyIdentityResync } = await import('@/lib/migrations/armyIdentityResync');
    const report = await applyArmyIdentityResync();

    const conflict = report.conflicts.find((c) => c.username === 'resync_unknown');
    expect(conflict).toBeDefined();
    expect(String(conflict!.reason)).toContain('unrecognized');

    const row = await rowOf('resync_unknown');
    expect((row.units as Array<Record<string, unknown>>)[0].unitType).toBe('DEATH_STAR');
  });
});
