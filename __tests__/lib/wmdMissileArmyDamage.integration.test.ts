// @vitest-environment node
/**
 * @file __tests__/lib/wmdMissileArmyDamage.integration.test.ts
 * @overview FID-20261002-006 §5 acceptance — the REAL processDueMissiles
 *           impact path on a disposable PostgreSQL. Unit mocks cannot prove
 *           claim serialization or rollback atomicity, so the FID's core
 *           acceptance criteria run here against real database contention:
 *
 *  - Representation independence through the real engine: 100 singletons, one
 *    100-stack and a 40/30/30 partition lose the SAME units at the same
 *    (deterministic) warhead effect; totals are recounted through 004's
 *    shared reducer and written WITH units.
 *  - Concurrency: two concurrent processDueMissiles sweeps (cron vs lazy
 *    tick) — the conditional claim (status still LAUNCHED under the row lock)
 *    lets exactly ONE impact commit; no double damage.
 *  - Rollback: a corrupt target army throws ArmyIntegrityError inside the
 *    transaction — the claim AND every write roll back; the tracker records
 *    the integrity failure (SYSTEM_ERROR alert + terminal zero-damage
 *    detonation) and no asset is touched.
 *  - Factory + resource damage commit with the same claim in one transaction.
 *  - Crash-resume idempotency: a second sweep processes zero missiles and
 *    changes nothing.
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002/003/004/005/011):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL is REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/wmdMissileArmyDamage.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PlayerUnit } from '@/types/game.types';

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

// generateId's Math.random id must stay unique while the rolls are pinned —
// replace it with a counter-based id (Math.random is stubbed to a constant).
let idCounter = 0;
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    generateId: () => `testid-${String(++idCounter).padStart(6, '0')}`,
  };
});

function titan(id: string, opts: { quantity?: number; strength?: number } = {}): PlayerUnit {
  return {
    id,
    unitId: 'titan',
    unitType: 'Titan' as never,
    name: 'Titan',
    category: 'STR',
    rarity: 'epic',
    strength: opts.strength ?? 100,
    defense: 50,
    quantity: opts.quantity ?? 1,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  } as PlayerUnit;
}

describe.skipIf(skipSuite)('FID-20261002-006 — WMD impact atomicity + representation independence (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;
  let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-006'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-006'),
        user: 'postgres',
        password: 'disposable',
        port: 55438,
        persistent: false,
        // Force a UTF8 cluster: the Windows default (locale-derived WIN1252)
        // cannot store alert/notification content that carries non-ASCII.
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
      // client_encoding=UTF8: alert/notification content carries non-ASCII
      // (arrows, emoji) that the Windows default WIN1252 connection would reject.
      url = 'postgresql://postgres:disposable@localhost:55438/postgres?client_encoding=UTF8';
    }
    assertDisposableTarget(url);
    adminPool = new Pool({ connectionString: `${url}${url.includes('?') ? '&' : '?'}client_encoding=UTF8`, max: 5, ssl: { rejectUnauthorized: false } });
    // Point the app's lazy pool at the disposable target BEFORE its first query.
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username varchar(20) PRIMARY KEY,
        _id varchar(24),
        email varchar(255) NOT NULL DEFAULT 'probe@example.test',
        password varchar(255) NOT NULL DEFAULT 'x',
        base_x integer NOT NULL DEFAULT 0,
        base_y integer NOT NULL DEFAULT 0,
        current_position_x integer NOT NULL DEFAULT 0,
        current_position_y integer NOT NULL DEFAULT 0,
        resources_metal integer NOT NULL DEFAULT 0,
        resources_energy integer NOT NULL DEFAULT 0,
        bank_metal integer NOT NULL DEFAULT 0,
        bank_energy integer NOT NULL DEFAULT 0,
        bank_last_deposit timestamptz,
        rank integer DEFAULT 1,
        inventory_items jsonb NOT NULL DEFAULT '[]',
        inventory_capacity integer NOT NULL DEFAULT 2000,
        inventory_metal_digger_count integer NOT NULL DEFAULT 0,
        inventory_energy_digger_count integer NOT NULL DEFAULT 0,
        gathering_bonus_metal_bonus numeric(5,2) NOT NULL DEFAULT 0,
        gathering_bonus_energy_bonus numeric(5,2) NOT NULL DEFAULT 0,
        active_boosts_gathering_boost numeric(5,2),
        active_boosts_expires_at timestamptz,
        shrine_boosts jsonb NOT NULL DEFAULT '[]',
        units jsonb NOT NULL DEFAULT '[]',
        total_strength integer NOT NULL DEFAULT 0,
        total_defense integer NOT NULL DEFAULT 0,
        balance_effects jsonb,
        xp integer NOT NULL DEFAULT 0,
        level integer NOT NULL DEFAULT 10,
        research_points integer NOT NULL DEFAULT 0,
        unlocked_tiers jsonb NOT NULL DEFAULT '[]',
        unlocked_techs jsonb,
        concentration_zones jsonb,
        last_bot_summon timestamptz,
        fast_travel_waypoints jsonb,
        last_fast_travel timestamptz,
        daily_bounties jsonb,
        specialization jsonb,
        discoveries jsonb,
        achievements jsonb,
        stats jsonb,
        factory_count integer DEFAULT 0,
        last_xp_award timestamptz,
        last_level_up timestamptz,
        rp_history jsonb,
        base_greeting varchar(500),
        battle_stats jsonb,
        is_bot smallint DEFAULT 0,
        is_special_base smallint DEFAULT 0,
        bot_config jsonb,
        autofarm_run jsonb,
        clan_id varchar(24),
        clan_name varchar(30),
        clan_role varchar(20),
        clan_level integer,
        is_admin smallint DEFAULT 0,
        vip smallint DEFAULT 0,
        vip_expiration timestamptz,
        vip_tier varchar(20),
        stripe_customer_id varchar(255),
        stripe_subscription_id varchar(255),
        vip_last_updated timestamptz,
        last_login_date timestamptz,
        login_streak integer DEFAULT 0,
        last_streak_reward timestamptz,
        current_hp integer DEFAULT 1000,
        max_hp integer DEFAULT 1000,
        permanent_harvest_bonus smallint NOT NULL DEFAULT 0,
        last_flag_attack timestamptz,
        referral_code varchar(20),
        referral_link varchar(255),
        referred_by varchar(20),
        referred_by_username varchar(20),
        referral_validated smallint,
        referral_validated_at timestamptz,
        total_referrals integer DEFAULT 0,
        pending_referrals integer DEFAULT 0,
        referral_rewards_metal integer,
        referral_rewards_energy integer,
        referral_rewards_rp integer,
        referral_rewards_xp integer,
        referral_rewards_vip_days integer,
        referral_titles jsonb,
        referral_badges jsonb,
        referral_multiplier numeric(3,1) DEFAULT '1.0',
        last_referral_validated timestamptz,
        referral_milestones_reached jsonb,
        signup_ip varchar(45),
        protection_until timestamptz,
        created_at timestamptz DEFAULT NOW(),
        banned smallint DEFAULT 0,
        ban_reason text,
        banned_at timestamptz,
        banned_by varchar(20),
        ban_expires_at timestamptz
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
        production_rate numeric(5,2) NOT NULL DEFAULT '0',
        last_slot_regen timestamptz NOT NULL DEFAULT NOW(),
        last_resource_generation timestamptz,
        last_attacked_by varchar(20),
        last_attack_time timestamptz,
        CONSTRAINT factories_pk PRIMARY KEY (x, y)
      );
      CREATE TABLE IF NOT EXISTS missiles (
        id varchar(24) PRIMARY KEY,
        missile_id varchar(50) NOT NULL,
        owner_id varchar(20) NOT NULL,
        owner_clan_id varchar(24),
        warhead_type varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        components_warhead integer,
        components_propulsion integer,
        components_guidance integer,
        components_payload integer,
        components_stealth integer,
        target_id varchar(20),
        target_type varchar(20),
        secondary_targets jsonb,
        launched_at timestamptz,
        launched_by varchar(20),
        impact_at timestamptz,
        flight_time integer,
        intercept_attempts integer DEFAULT 0,
        intercepted_by varchar(20),
        intercepted_at timestamptz,
        damage_dealt jsonb,
        created_at timestamptz NOT NULL,
        completed_at timestamptz,
        updated_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wmd_defense_batteries (
        id varchar(24) PRIMARY KEY,
        clan_id varchar(24) NOT NULL,
        status varchar(20) NOT NULL,
        intercept_chance numeric(5,2) DEFAULT '0',
        cooldown_duration integer DEFAULT 0,
        battery_id varchar(50) NOT NULL,
        built_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        repair_completes_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS wmd_config (
        id varchar(24) PRIMARY KEY,
        key varchar(50) NOT NULL,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS wmd_config_key_unique ON wmd_config (key);
      CREATE TABLE IF NOT EXISTS wmd_alerts (
        id varchar(50) PRIMARY KEY,
        type varchar(30) NOT NULL,
        severity varchar(20) NOT NULL,
        status varchar(20) NOT NULL,
        title varchar(200) NOT NULL,
        message varchar(500) NOT NULL,
        player_id varchar(20),
        player_name varchar(50),
        clan_id varchar(24),
        clan_name varchar(50),
        target_clan_id varchar(24),
        target_clan_name varchar(50),
        missile_id varchar(50),
        vote_id varchar(50),
        operation_id varchar(50),
        data jsonb,
        channels jsonb NOT NULL DEFAULT '[]'::jsonb,
        delivery_status jsonb DEFAULT '{}'::jsonb,
        acknowledged_at timestamptz,
        acknowledged_by varchar(20),
        resolved_at timestamptz,
        resolved_by varchar(20),
        created_at timestamptz NOT NULL
      );
    `);

    // Deterministic warhead rolls: damage factor 1.0 (0.95 + 0.5×0.1), no crit
    // (0.5 >= 0.05). Every impact in every test sees the SAME effect — the
    // TACTICAL warhead (primary 25) yields destroyedFraction 0.175, factory
    // share 5%, resource share 2.5%.
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  }, 120000);

  afterAll(async () => {
    randomSpy?.mockRestore();
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, factories, missiles, wmd_defense_batteries, wmd_alerts, wmd_config CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(
    username: string,
    opts: { units?: PlayerUnit[]; metal?: number; energy?: number } = {}
  ): Promise<void> {
    const units = opts.units ?? [];
    const strength = units.reduce((s, u) => s + u.strength * u.quantity, 0);
    const defense = units.reduce((s, u) => s + u.defense * u.quantity, 0);
    await adminPool.query(
      `INSERT INTO players (username, resources_metal, resources_energy, units, total_strength, total_defense)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (username) DO UPDATE SET resources_metal = $2, resources_energy = $3, units = $4::jsonb,
         total_strength = $5, total_defense = $6`,
      [username, opts.metal ?? 0, opts.energy ?? 0, JSON.stringify(units), strength, defense],
    );
  }

  async function seedMissile(id: string, missileId: string, targetId: string): Promise<void> {
    await adminPool.query(
      `INSERT INTO missiles (id, missile_id, owner_id, warhead_type, status, target_id, target_type,
         launched_at, launched_by, impact_at, created_at, updated_at)
       VALUES ($1, $2, 'launcher1', 'TACTICAL', 'LAUNCHED', $3, 'player',
         NOW() - INTERVAL '10 minutes', 'launcher1', NOW() - INTERVAL '1 minute', NOW(), NOW())`,
      [id, missileId, targetId],
    );
  }

  async function seedFactory(x: number, y: number, owner: string, rate: number): Promise<void> {
    await adminPool.query(
      `INSERT INTO factories (x, y, owner, production_rate) VALUES ($1, $2, $3, $4)
       ON CONFLICT (x, y) DO UPDATE SET owner = $3, production_rate = $4`,
      [x, y, owner, String(rate)],
    );
  }

  async function playerRow(username: string): Promise<Record<string, unknown>> {
    const r = await adminPool.query(
      `SELECT units, total_strength, total_defense, resources_metal, resources_energy FROM players WHERE username = $1`,
      [username]
    );
    return r.rows[0];
  }

  it('representation independence through the REAL engine: 100 singletons, one 100-stack and a 40/30/30 partition each lose 17 units; totals recounted with units', async () => {
    // Deterministic TACTICAL impact: destroyedFraction 0.175 → floor(100×0.175) = 17.
    await seedPlayer('wmd_singletons', { units: Array.from({ length: 100 }, (_, i) => titan(`W${i}`)) });
    await seedPlayer('wmd_stacked', { units: [titan('STACK1', { quantity: 100 })] });
    await seedPlayer('wmd_partitioned', { units: [titan('P40', { quantity: 40 }), titan('P30', { quantity: 30 }), titan('P30b', { quantity: 30 })] });
    await seedMissile('m0singletons00000001', 'M-SINGLE-1', 'wmd_singletons');
    await seedMissile('m0stacked0000000001', 'M-STACK-1', 'wmd_stacked');
    await seedMissile('m0partition000000001', 'M-PART-1', 'wmd_partitioned');

    const { processDueMissiles } = await import('@/lib/wmd/jobs/missileTracker');
    const handled = await processDueMissiles();
    expect(handled).toBe(3);

    for (const username of ['wmd_singletons', 'wmd_stacked', 'wmd_partitioned']) {
      const row = await playerRow(username);
      const units = row.units as PlayerUnit[];
      const surviving = units.reduce((s, u) => s + u.quantity, 0);
      expect(surviving).toBe(83); // 17 destroyed in every representation
      // §5.3: totals recounted through the shared reducer, written WITH units.
      expect(row.total_strength).toBe(8300);
      expect(row.total_defense).toBe(4150);
      for (const u of units) {
        expect(Number.isInteger(u.quantity)).toBe(true);
        expect(u.quantity).toBeGreaterThan(0);
      }
    }

    // The stacked target keeps ONE entry with the surviving quantity and its
    // instance identity; the singleton army keeps 83 entries.
    const stacked = (await playerRow('wmd_stacked')).units as PlayerUnit[];
    expect(stacked).toHaveLength(1);
    expect(stacked[0].id).toBe('STACK1');
    expect(((await playerRow('wmd_singletons')).units as PlayerUnit[])).toHaveLength(83);

    const damage = await adminPool.query(`SELECT damage_dealt FROM missiles WHERE missile_id = 'M-SINGLE-1'`);
    expect(damage.rows[0].damage_dealt.unitsDestroyed).toBe(17);
  });

  it('two concurrent sweeps race on the conditional claim: exactly ONE impact commits, no double damage', async () => {
    await seedPlayer('wmd_race', { units: [titan('RACE1', { quantity: 100 })], metal: 10000, energy: 5000 });
    await seedFactory(60, 60, 'wmd_race', 100);
    await seedMissile('m0race000000000001', 'M-RACE-1', 'wmd_race');

    const { processDueMissiles } = await import('@/lib/wmd/jobs/missileTracker');
    const [a, b] = await Promise.all([processDueMissiles(), processDueMissiles()]);
    // Both sweeps see the due missile; exactly one wins the claim.
    expect([a, b]).toContain(1);

    // Units destroyed EXACTLY once: 100 × (1 − 0.175) = 83, not ~68.5.
    const row = await playerRow('wmd_race');
    expect(((row.units as PlayerUnit[])[0]).quantity).toBe(83);
    expect(row.total_strength).toBe(8300);

    // Resources decremented exactly once: 10000 − floor(10000×0.025) = 9750.
    expect(row.resources_metal).toBe(9750);
    expect(row.resources_energy).toBe(5000 - 125);

    // Factory damaged exactly once: 100 − max(1, floor(100×5/100)) = 95.
    const factory = await adminPool.query(`SELECT production_rate, last_attacked_by FROM factories WHERE x = 60 AND y = 60`);
    expect(Number(factory.rows[0].production_rate)).toBe(95);
    expect(factory.rows[0].last_attacked_by).toBe('wmd_race');

    const missile = await adminPool.query(`SELECT status, damage_dealt FROM missiles WHERE missile_id = 'M-RACE-1'`);
    expect(missile.rows[0].status).toBe('DETONATED');
    expect(missile.rows[0].damage_dealt.unitsDestroyed).toBe(17);
  });

  it('corrupt target army: the impact transaction rolls back claim AND writes; the integrity failure is recorded explicitly', async () => {
    const corrupt = [titan('OK1', { quantity: 10 }), { ...titan('BAD1', { quantity: 10 }), quantity: -5 }];
    await seedPlayer('wmd_corrupt', { units: corrupt as PlayerUnit[], metal: 10000 });
    await seedFactory(61, 61, 'wmd_corrupt', 100);
    await seedMissile('m0corrupt0000000001', 'M-CORRUPT-1', 'wmd_corrupt');

    const { processDueMissiles } = await import('@/lib/wmd/jobs/missileTracker');
    await processDueMissiles();

    // ZERO asset writes — the ArmyIntegrityError threw inside the transaction,
    // rolling back the claim and every army/resource/factory write.
    const row = await playerRow('wmd_corrupt');
    expect(((row.units as PlayerUnit[]).find((u) => u.id === 'OK1'))!.quantity).toBe(10);
    expect(((row.units as PlayerUnit[]).find((u) => u.id === 'BAD1'))!.quantity).toBe(-5);
    expect(row.resources_metal).toBe(10000);
    expect(row.total_strength).toBe(500); // untouched seed value (10×100 + (−5)×100)
    const factory = await adminPool.query(`SELECT production_rate FROM factories WHERE x = 61 AND y = 61`);
    expect(Number(factory.rows[0].production_rate)).toBe(100);

    // §5.2: the failure is RECORDED, not silent — a terminal zero-damage
    // detonation (no infinite retry) plus a SYSTEM_ERROR CRITICAL alert.
    const missile = await adminPool.query(`SELECT status, damage_dealt FROM missiles WHERE missile_id = 'M-CORRUPT-1'`);
    expect(missile.rows[0].status).toBe('DETONATED');
    expect(missile.rows[0].damage_dealt.unitsDestroyed).toBe(0);
    const alert = await adminPool.query(`SELECT type, severity FROM wmd_alerts WHERE missile_id = 'M-CORRUPT-1'`);
    expect(alert.rows).toHaveLength(1);
    expect(alert.rows[0].type).toBe('SYSTEM_ERROR');
    expect(alert.rows[0].severity).toBe('CRITICAL');
  });

  it('crash-resume idempotency: a second sweep processes zero due missiles and changes nothing', async () => {
    await seedPlayer('wmd_resume', { units: [titan('RES1', { quantity: 100 })], metal: 10000 });
    await seedMissile('m0resume00000000001', 'M-RESUME-1', 'wmd_resume');

    const { processDueMissiles } = await import('@/lib/wmd/jobs/missileTracker');
    const first = await processDueMissiles();
    expect(first).toBe(1);
    const afterFirst = await playerRow('wmd_resume');
    const missileAfterFirst = await adminPool.query(`SELECT status FROM missiles WHERE missile_id = 'M-RESUME-1'`);

    const second = await processDueMissiles();
    expect(second).toBe(0); // nothing due — the impact is terminal
    const afterSecond = await playerRow('wmd_resume');
    expect(afterSecond.units).toEqual(afterFirst.units);
    expect(afterSecond.resources_metal).toBe(afterFirst.resources_metal);
    const missileAfterSecond = await adminPool.query(`SELECT status, damage_dealt FROM missiles WHERE missile_id = 'M-RESUME-1'`);
    expect(missileAfterSecond.rows[0].status).toBe(missileAfterFirst.rows[0].status);
    expect(missileAfterSecond.rows[0].damage_dealt.unitsDestroyed).toBe(17);
  });

  it('failure injection: a broken factory write rolls back the claim and ALL army/resource writes together', async () => {
    // Inject a hard failure into the FACTORY damage write by pre-dropping the
    // factories table (the tx must already hold valid damage math for units +
    // resources; the factory failure must discard those too, claim included).
    // We use a tx-aborting trigger-free trick instead: rename the table mid-flight
    // is racy, so instead we corrupt the numeric column contract via an
    // EXCLUSIVE lock + type break... simplest reliable injection: drop the table.
    await seedPlayer('wmd_fail', { units: [titan('FAIL1', { quantity: 100 })], metal: 10000 });
    await seedFactory(62, 62, 'wmd_fail', 100);
    await seedMissile('m0fail000000000001', 'M-FAIL-1', 'wmd_fail');

    const { processDueMissiles } = await import('@/lib/wmd/jobs/missileTracker');

    // Injected failure: the factory damage write cannot complete (relation
    // gone). The whole impact transaction — claim, units, totals, resources —
    // must roll back, and the missile must remain LAUNCHED (retryable).
    await adminPool.query(`DROP TABLE factories CASCADE`);
    try {
      await processDueMissiles();
    } finally {
      // Restore the table for later teardown (empty — the factory fixture is gone,
      // which is itself the failure injection).
      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS factories (
          x smallint NOT NULL, y smallint NOT NULL, owner varchar(20),
          defense integer NOT NULL DEFAULT 0, level integer NOT NULL DEFAULT 1,
          slots integer NOT NULL DEFAULT 0, used_slots integer NOT NULL DEFAULT 0,
          invested_metal integer NOT NULL DEFAULT 0, invested_energy integer NOT NULL DEFAULT 0,
          production_rate numeric(5,2) NOT NULL DEFAULT '0',
          last_slot_regen timestamptz NOT NULL DEFAULT NOW(),
          last_resource_generation timestamptz, last_attacked_by varchar(20), last_attack_time timestamptz,
          CONSTRAINT factories_pk PRIMARY KEY (x, y)
        )`);
    }

    const row = await playerRow('wmd_fail');
    expect(((row.units as PlayerUnit[])[0]).quantity).toBe(100); // units write rolled back
    expect(row.total_strength).toBe(10000);
    expect(row.resources_metal).toBe(10000); // resource write rolled back
    const missile = await adminPool.query(`SELECT status, damage_dealt FROM missiles WHERE missile_id = 'M-FAIL-1'`);
    expect(missile.rows[0].status).toBe('LAUNCHED'); // claim rolled back — impact retryable
    expect(missile.rows[0].damage_dealt).toBeNull();
  });

});
