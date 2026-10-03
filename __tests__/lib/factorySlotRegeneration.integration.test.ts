// @vitest-environment node
/**
 * @file __tests__/lib/factorySlotRegeneration.integration.test.ts
 * @overview FID-20261002-011 §5 acceptance — REAL-PostgreSQL tests for the
 *           shared slot-regeneration curve and the harvest claim/credit
 *           transaction. Unit mocks establish call contracts; they cannot
 *           prove race safety, so the FID's core acceptance criteria (L10
 *           120/hr canonical recovery, mono-STR 800→600 payout, job-vs-build
 *           reservation safety, single-payout harvest claim) are pinned here
 *           against a disposable PostgreSQL instance.
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL (Supabase/RDS/Neon/Azure/Heroku/Render) is
 *    REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/factorySlotRegeneration.integration.test.ts
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
    throw new Error(
      'Disposable-database URL looks like a PRODUCTION target — refusing to run destructive interleaving tests against it.'
    );
  }
}
if (EXTERNAL_URL) assertDisposableTarget(EXTERNAL_URL);

const skipSuite = !EXTERNAL_URL && !AUTO_PROVISION;
const HOUR_IN_MS = 60 * 60 * 1000;

describe.skipIf(skipSuite)('FID-20261002-011 — slot regeneration + harvest claim (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-011'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-011'),
        user: 'postgres',
        password: 'disposable',
        port: 55433,
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
      url = 'postgresql://postgres:disposable@localhost:55433/postgres';
    }
    assertDisposableTarget(url);

    adminPool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });

    // Point the app's lazy pool at the disposable target before its first query.
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username varchar(20) PRIMARY KEY,
        resources_metal integer NOT NULL DEFAULT 0,
        resources_energy integer NOT NULL DEFAULT 0,
        bank_metal integer NOT NULL DEFAULT 0,
        bank_energy integer NOT NULL DEFAULT 0,
        current_position_x integer NOT NULL DEFAULT 0,
        current_position_y integer NOT NULL DEFAULT 0,
        research_points integer NOT NULL DEFAULT 0,
        xp integer NOT NULL DEFAULT 0,
        level integer NOT NULL DEFAULT 1,
        rp_history jsonb,
        unlocked_tiers jsonb NOT NULL DEFAULT '[]',
        vip smallint DEFAULT 0,
        vip_expiration timestamptz,
        last_xp_award timestamptz,
        last_level_up timestamptz,
        total_strength integer NOT NULL DEFAULT 0,
        total_defense integer NOT NULL DEFAULT 0,
        gathering_bonus_metal_bonus numeric(5,2) NOT NULL DEFAULT 0,
        gathering_bonus_energy_bonus numeric(5,2) NOT NULL DEFAULT 0,
        active_boosts_gathering_boost numeric(5,2),
        active_boosts_expires_at timestamptz,
        shrine_boosts jsonb NOT NULL DEFAULT '[]',
        specialization jsonb,
        discoveries jsonb,
        achievements jsonb,
        stats jsonb
      );
      CREATE TABLE IF NOT EXISTS tiles (
        x smallint NOT NULL,
        y smallint NOT NULL,
        terrain varchar(20) NOT NULL,
        occupied_by_base smallint,
        base_owner varchar(20),
        base_greeting varchar(500),
        last_harvested_by jsonb,
        bank_type varchar(20),
        has_flag_bearer smallint,
        has_trail smallint,
        trail_timestamp timestamptz,
        trail_expires_at timestamptz,
        PRIMARY KEY (x, y)
      );
      CREATE TABLE IF NOT EXISTS flags (
        id varchar(24) PRIMARY KEY,
        current_holder varchar(24),
        current_holder_username varchar(20),
        last_captured_at timestamptz,
        last_captured_by varchar(20),
        total_captures integer NOT NULL DEFAULT 0,
        session_earnings_metal bigint NOT NULL DEFAULT 0,
        session_earnings_energy bigint NOT NULL DEFAULT 0,
        flee_count integer NOT NULL DEFAULT 0,
        grace_until timestamptz,
        challenge_challenger varchar(24),
        challenge_started_at timestamptz,
        challenge_ends_at timestamptz,
        last_flee_at timestamptz,
        flee_destination_x integer,
        flee_destination_y integer,
        milestone_12h_awarded smallint NOT NULL DEFAULT 0,
        spawn_x integer,
        spawn_y integer
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
      CREATE TABLE IF NOT EXISTS rptransactions (
        id varchar(50) PRIMARY KEY,
        playerusername varchar(20) NOT NULL,
        amount integer NOT NULL,
        source varchar(30) NOT NULL,
        description text,
        timestamp timestamptz NOT NULL,
        vipbonus smallint DEFAULT 0,
        balanceafter integer,
        metadata text,
        bypasseddailycap smallint DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS rp_daily_totals (
        playerusername varchar(20) NOT NULL,
        daykey varchar(10) NOT NULL,
        baserpedtoday integer NOT NULL DEFAULT 0,
        updatedat timestamptz,
        CONSTRAINT rp_daily_totals_unique UNIQUE (playerusername, daykey)
      );
    `);

    // Deterministic base roll: generateBaseHarvestAmount() with Math.random()=0
    // returns the floor of the 800–1500 range = 800 (the FID's acceptance roll).
    vi.spyOn(Math, 'random').mockReturnValue(0);
  }, 120000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (adminPool) {
      await adminPool.query(
        `DROP TABLE IF EXISTS players, tiles, flags, factories, rptransactions, rp_daily_totals CASCADE`
      );
      await adminPool.end();
    }
    // Drain the app's lazy pool BEFORE the throwaway server goes away, so its
    // idle sockets cannot emit stray ECONNRESET errors during teardown.
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

  async function seedPlayer(
    username: string,
    opts: { metal?: number; energy?: number; strength?: number; defense?: number } = {},
  ): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, resources_metal, resources_energy, total_strength, total_defense)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET
         resources_metal = $2, resources_energy = $3,
         total_strength = $4, total_defense = $5`,
      [username, opts.metal ?? 0, opts.energy ?? 0, opts.strength ?? 0, opts.defense ?? 0],
    );
  }

  async function seedFactory(
    x: number,
    y: number,
    opts: { owner?: string | null; level?: number; usedSlots?: number; lastSlotRegen: Date },
  ): Promise<void> {
    await adminPool.query(
      `INSERT INTO factories (x, y, owner, level, slots, used_slots, last_slot_regen)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (x, y) DO UPDATE SET
         owner = $3, level = $4, slots = $5, used_slots = $6, last_slot_regen = $7`,
      [x, y, opts.owner ?? null, opts.level ?? 10, 1750, opts.usedSlots ?? 0, opts.lastSlotRegen],
    );
  }

  async function seedTile(x: number, y: number, terrain = 'Metal'): Promise<void> {
    await adminPool.query(
      `INSERT INTO tiles (x, y, terrain, last_harvested_by) VALUES ($1, $2, $3, '[]'::jsonb)
       ON CONFLICT (x, y) DO UPDATE SET terrain = $3, last_harvested_by = '[]'::jsonb`,
      [x, y, terrain],
    );
  }

  it('L10 neutral one hour → 120 recovered through the actual job cycle (canonical curve)', async () => {
    const now = new Date();
    await seedFactory(1, 1, { owner: null, level: 10, usedSlots: 500, lastSlotRegen: new Date(now.getTime() - HOUR_IN_MS) });

    const { runFactorySlotRegenerationCycle } = await import('@/lib/jobs/factorySlotRegeneration');
    const result = await runFactorySlotRegenerationCycle(now);

    const row = (await adminPool.query('SELECT used_slots FROM factories WHERE x = 1 AND y = 1')).rows[0];
    // Canonical getRegenRate(10) = 120/hr — the old job-local curve recovered 19.
    expect(row.used_slots).toBe(500 - 120);
    expect(result.factoriesProcessed).toBeGreaterThanOrEqual(1);
    expect(result.totalSlotsRegenerated).toBeGreaterThanOrEqual(120);
  });

  it('CRITICAL-balance owner regenerates at 0.85× (job reads owner army stats in one batch)', async () => {
    const now = new Date();
    await seedPlayer('regen_crit', { strength: 800, defense: 0 });
    await seedFactory(2, 2, { owner: 'regen_crit', level: 10, usedSlots: 500, lastSlotRegen: new Date(now.getTime() - HOUR_IN_MS) });

    const { runFactorySlotRegenerationCycle } = await import('@/lib/jobs/factorySlotRegeneration');
    await runFactorySlotRegenerationCycle(now);

    const row = (await adminPool.query('SELECT used_slots FROM factories WHERE x = 2 AND y = 2')).rows[0];
    expect(row.used_slots).toBe(500 - Math.floor(120 * 0.85));
  });

  it('empty-idle cannot bank slots: idle time is discarded, a fresh build does not instantly refill', async () => {
    const now = new Date();
    // Empty for 10 hours — the pre-fix accounting let a later build inherit it.
    await seedFactory(3, 3, { owner: null, level: 10, usedSlots: 0, lastSlotRegen: new Date(now.getTime() - 10 * HOUR_IN_MS) });

    const { runFactorySlotRegenerationCycle } = await import('@/lib/jobs/factorySlotRegeneration');
    await runFactorySlotRegenerationCycle(now);

    const afterIdle = (await adminPool.query('SELECT used_slots, last_slot_regen FROM factories WHERE x = 3 AND y = 3')).rows[0];
    expect(afterIdle.used_slots).toBe(0);
    // Checkpoint rebased to the cycle clock (surplus discarded).
    expect(new Date(afterIdle.last_slot_regen).getTime()).toBeGreaterThan(now.getTime() - 60 * 1000);

    // Simulate a build consuming 50 slots right after the idle period.
    await adminPool.query(`UPDATE factories SET used_slots = 50 WHERE x = 3 AND y = 3`);
    await runFactorySlotRegenerationCycle(new Date());

    const afterBuild = (await adminPool.query('SELECT used_slots FROM factories WHERE x = 3 AND y = 3')).rows[0];
    expect(afterBuild.used_slots).toBe(50); // no instant refill from banked idle time
  });

  it('future/corrupt checkpoint fails safe: no fabricated recovery, no negative usedSlots', async () => {
    const now = new Date();
    await seedFactory(4, 4, { owner: null, level: 10, usedSlots: 100, lastSlotRegen: new Date(now.getTime() + 5 * HOUR_IN_MS) });

    const { runFactorySlotRegenerationCycle } = await import('@/lib/jobs/factorySlotRegeneration');
    await runFactorySlotRegenerationCycle(now);

    const row = (await adminPool.query('SELECT used_slots FROM factories WHERE x = 4 AND y = 4')).rows[0];
    expect(row.used_slots).toBe(100);
  });

  it('job vs concurrent build reservation: locked rows compose — no overwritten reservation', async () => {
    const now = new Date();
    await seedFactory(5, 5, { owner: null, level: 10, usedSlots: 200, lastSlotRegen: new Date(now.getTime() - HOUR_IN_MS) });

    const { runFactorySlotRegenerationCycle } = await import('@/lib/jobs/factorySlotRegeneration');
    const { db } = await import('@/lib/db');
    const { factories } = await import('@/lib/db/schema');
    const { and, eq, sql } = await import('drizzle-orm');

    // Concurrent "build": lock the row and add 10 reserved slots (relative SQL,
    // the FID-002 idiom). Whether it wins the lock before or after the job, the
    // final count must be 200 − 120 + 10 = 90 — the old unlocked job could
    // overwrite the reservation with its stale snapshot.
    const build = db.transaction(async (tx) => {
      await tx
        .select()
        .from(factories)
        .where(and(eq(factories.x, 5), eq(factories.y, 5)))
        .for('update');
      await tx
        .update(factories)
        .set({ usedSlots: sql`${factories.usedSlots} + 10` })
        .where(and(eq(factories.x, 5), eq(factories.y, 5)));
    });

    await Promise.all([runFactorySlotRegenerationCycle(now), build]);

    const row = (await adminPool.query('SELECT used_slots FROM factories WHERE x = 5 AND y = 5')).rows[0];
    expect(row.used_slots).toBe(200 - 120 + 10);
  });

  it('harvest claim is single-payout: two concurrent harvests of the same tile pay exactly once', async () => {
    await seedPlayer('harvest_race', { metal: 0 });
    await seedTile(10, 10);

    const { harvestResourceTile } = await import('@/lib/harvestService');
    const tile = { x: 10, y: 10, terrain: 'Metal' } as never;

    const [a, b] = await Promise.all([
      harvestResourceTile('harvest_race', tile),
      harvestResourceTile('harvest_race', tile),
    ]);

    const successes = [a, b].filter((r) => r.success);
    const refusals = [a, b].filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(1);

    // Deterministic base 800, neutral army → 800 credited exactly once.
    expect(successes[0].metalGained).toBe(800);
    const player = (await adminPool.query(`SELECT resources_metal FROM players WHERE username = 'harvest_race'`)).rows[0];
    expect(player.resources_metal).toBe(800);

    // Exactly one claim record for the period.
    const tileRow = (await adminPool.query('SELECT last_harvested_by FROM tiles WHERE x = 10 AND y = 10')).rows[0];
    expect(tileRow.last_harvested_by).toHaveLength(1);
  });

  it('mono-STR harvest roll 800 → 600 on the REAL path (R5 corrected payout)', async () => {
    await seedPlayer('harvest_mono', { metal: 0, strength: 800, defense: 0 });
    await seedTile(11, 11);

    const { harvestResourceTile } = await import('@/lib/harvestService');
    const result = await harvestResourceTile('harvest_mono', { x: 11, y: 11, terrain: 'Metal' } as never);

    // 800 × CRITICAL gathering 0.75 = 600 — the pre-fix path passed totals as
    // zeros and paid the full 800.
    expect(result.success).toBe(true);
    expect(result.metalGained).toBe(600);
    const player = (await adminPool.query(`SELECT resources_metal FROM players WHERE username = 'harvest_mono'`)).rows[0];
    expect(player.resources_metal).toBe(600);
  });

  it('OPTIMAL-balance harvest gains the intended +10% on the same real roll', async () => {
    await seedPlayer('harvest_opt', { energy: 0, strength: 5000, defense: 5000 });
    await seedTile(12, 12, 'Energy');

    const { harvestResourceTile } = await import('@/lib/harvestService');
    const result = await harvestResourceTile('harvest_opt', { x: 12, y: 12, terrain: 'Energy' } as never);

    expect(result.success).toBe(true);
    expect(result.energyGained).toBe(880); // 800 × 1.10
  });

  it('sequential re-harvest in the same period is refused without crediting again', async () => {
    await seedPlayer('harvest_seq', { metal: 0 });
    await seedTile(13, 13);

    const { harvestResourceTile } = await import('@/lib/harvestService');
    const first = await harvestResourceTile('harvest_seq', { x: 13, y: 13, terrain: 'Metal' } as never);
    const second = await harvestResourceTile('harvest_seq', { x: 13, y: 13, terrain: 'Metal' } as never);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    const player = (await adminPool.query(`SELECT resources_metal FROM players WHERE username = 'harvest_seq'`)).rows[0];
    expect(player.resources_metal).toBe(800);
  });
});
