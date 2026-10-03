// @vitest-environment node
/**
 * @file __tests__/lib/wmdBatteryCooldownLifecycle.integration.test.ts
 * @overview FID-20261002-007 §5 acceptance — the defense battery cooldown
 *           lifecycle on a REAL disposable PostgreSQL. Unit mocks cannot prove
 *           claim serialization, deadline persistence or migration idempotency,
 *           so the FID's core acceptance criteria run here:
 *
 *  - Real processDueMissiles interception persists the DURABLE deadline
 *    (cooldown_until = shot time + the battery's own cooldownDuration) — not
 *    just the mutable updatedAt audit time.
 *  - intercept → not eligible while cooling → AUTOMATIC IDLE via the
 *    scheduler-registered defenseRepairCompleter → can intercept again; paid
 *    repair (repairCompletesAt) remains a separate path.
 *  - Race: two concurrent interception paths against ONE battery — exactly one
 *    consumes it; the loser cannot report a successful interception.
 *  - The recovery sweep cannot override a future cooldown, DAMAGED or
 *    ambiguous (null-deadline) rows; DAMAGED paid repair still completes.
 *  - Migration 0041 applied TWICE: legacy COOLDOWN rows backfilled from
 *    updated_at + VALIDATED duration, ambiguous rows reported-not-guessed,
 *    existing real deadlines preserved.
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002..006):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL is REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/wmdBatteryCooldownLifecycle.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
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

function titan(id: string, quantity = 100): PlayerUnit {
  return {
    id,
    unitId: 'titan',
    unitType: 'Titan' as never,
    name: 'Titan',
    category: 'STR',
    rarity: 'epic',
    strength: 100,
    defense: 50,
    quantity,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  } as PlayerUnit;
}

describe.skipIf(skipSuite)('FID-20261002-007 — battery cooldown lifecycle (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;
  let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-007'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-007'),
        user: 'postgres',
        password: 'disposable',
        port: 55439,
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
      // client_encoding=UTF8 on the connection (belt to initdb's suspenders).
      url = 'postgresql://postgres:disposable@localhost:55439/postgres?client_encoding=UTF8';
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
        cooldown_until timestamptz,
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
      CREATE TABLE IF NOT EXISTS wmd_interceptions (
        id varchar(24) PRIMARY KEY,
        interception_id varchar(50) NOT NULL,
        missile_id varchar(50) NOT NULL,
        defender_id varchar(20) NOT NULL,
        battery_id varchar(50),
        result varchar(20) NOT NULL,
        timestamp timestamptz NOT NULL
      );
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

    // Deterministic rolls: interception roll 0.5 < (0.9 chance − 0.2 TACTICAL
    // difficulty) = 0.7 → intercepts; damage factor 1.0, no crit.
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  }, 120000);

  afterAll(async () => {
    randomSpy?.mockRestore();
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, factories, missiles, wmd_defense_batteries, wmd_config, wmd_interceptions, wmd_alerts CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(username: string, clanId: string | null, units: PlayerUnit[] = []): Promise<void> {
    const strength = units.reduce((s, u) => s + u.strength * u.quantity, 0);
    const defense = units.reduce((s, u) => s + u.defense * u.quantity, 0);
    await adminPool.query(
      `INSERT INTO players (username, clan_id, units, total_strength, total_defense)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (username) DO UPDATE SET clan_id = $2, units = $3::jsonb, total_strength = $4, total_defense = $5`,
      [username, clanId, JSON.stringify(units), strength, defense],
    );
  }

  async function seedBattery(
    id: string,
    batteryId: string,
    clanId: string,
    opts: { status?: string; chance?: string; duration?: number; cooldownUntil?: Date | null; repairCompletesAt?: Date | null; updatedAt?: Date } = {}
  ): Promise<void> {
    await adminPool.query(
      `INSERT INTO wmd_defense_batteries (id, clan_id, status, intercept_chance, cooldown_duration, battery_id, cooldown_until, repair_completes_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET clan_id = $2, status = $3, intercept_chance = $4, cooldown_duration = $5,
         battery_id = $6, cooldown_until = $7, repair_completes_at = $8, updated_at = $9`,
      [id, clanId, opts.status ?? 'IDLE', opts.chance ?? '0.90', opts.duration ?? 3600000, batteryId,
       opts.cooldownUntil ?? null, opts.repairCompletesAt ?? null, opts.updatedAt ?? new Date()],
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

  async function batteryRow(id: string): Promise<Record<string, unknown>> {
    const r = await adminPool.query(
      `SELECT status, cooldown_until, repair_completes_at, updated_at FROM wmd_defense_batteries WHERE id = $1`,
      [id]
    );
    return r.rows[0];
  }

  it('REAL processDueMissiles interception persists the DURABLE deadline (not just updatedAt) and consumes the battery', async () => {
    await seedPlayer('wmd_target', 'CLANB', [titan('T1')]);
    await seedBattery('bat000000000000001', 'battery-A', 'CLANB', { duration: 3600000 });
    await seedMissile('m000000000000000001', 'M-LIFE-1', 'wmd_target');

    const { processDueMissiles } = await import('@/lib/wmd/jobs/missileTracker');
    await processDueMissiles();

    const missile = await adminPool.query(`SELECT status, intercepted_by FROM missiles WHERE missile_id = 'M-LIFE-1'`);
    expect(missile.rows[0].status).toBe('INTERCEPTED');
    expect(missile.rows[0].intercepted_by).toBe('battery-A');

    // R13 (RED): the old write left cooldown_until NULL — only the mutable
    // updatedAt moved. The durable deadline is now persisted.
    const battery = await batteryRow('bat000000000000001');
    expect(battery.status).toBe('COOLDOWN');
    expect(battery.cooldown_until).not.toBeNull();
    const deadline = new Date(battery.cooldown_until as string).getTime();
    const shotTime = new Date(battery.updated_at as string).getTime();
    expect(deadline - shotTime).toBe(3600000); // now + the battery's OWN duration
  });

  it('intercept → not eligible while cooling → scheduler-registered completer restores IDLE → can intercept again; paid repair stays separate', async () => {
    await seedPlayer('wmd_cycle', 'CLANC', [titan('C1')]);
    await seedBattery('bat000000000000002', 'battery-B', 'CLANC', { duration: 1000 });
    await seedMissile('m000000000000000002', 'M-LIFE-2', 'wmd_cycle');

    const { processDueMissiles } = await import('@/lib/wmd/jobs/missileTracker');
    const { defenseRepairCompleter } = await import('@/lib/wmd/jobs/defenseRepairCompleter');
    const { db } = await import('@/lib/db');

    // (1) Intercepted.
    await processDueMissiles();
    let battery = await batteryRow('bat000000000000002');
    expect(battery.status).toBe('COOLDOWN');

    // (2) NOT eligible while cooling: a new missile against the same clan
    // cannot be intercepted — it DETONATES through the real impact path.
    await seedMissile('m000000000000000003', 'M-LIFE-3', 'wmd_cycle');
    await processDueMissiles();
    const second = await adminPool.query(`SELECT status, damage_dealt FROM missiles WHERE missile_id = 'M-LIFE-3'`);
    expect(second.rows[0].status).toBe('DETONATED');
    expect(second.rows[0].damage_dealt.unitsDestroyed).toBe(17);
    battery = await batteryRow('bat000000000000002');
    expect(battery.status).toBe('COOLDOWN'); // untouched by the detonation

    // (3) AUTOMATIC recovery through the SCHEDULER-REGISTERED handler.
    await adminPool.query(`UPDATE wmd_defense_batteries SET cooldown_until = NOW() - INTERVAL '1 second' WHERE id = 'bat000000000000002'`);
    await defenseRepairCompleter(db);
    battery = await batteryRow('bat000000000000002');
    expect(battery.status).toBe('IDLE');
    expect(battery.cooldown_until).toBeNull();

    // (4) Can intercept again.
    await seedMissile('m000000000000000004', 'M-LIFE-4', 'wmd_cycle');
    await processDueMissiles();
    const third = await adminPool.query(`SELECT status, intercepted_by FROM missiles WHERE missile_id = 'M-LIFE-4'`);
    expect(third.rows[0].status).toBe('INTERCEPTED');
    expect(third.rows[0].intercepted_by).toBe('battery-B');
    expect((await batteryRow('bat000000000000002')).status).toBe('COOLDOWN');
  });

  it('race: two concurrent interception paths against ONE battery — exactly one consumes it', async () => {
    await seedBattery('bat000000000000003', 'battery-C', 'CLAND', { duration: 3600000 });

    const { attemptInterception } = await import('@/lib/wmd/defenseService');
    const [a, b] = await Promise.all([
      attemptInterception('missile-race-1', 'CLAND'),
      attemptInterception('missile-race-2', 'CLAND'),
    ]);

    // Exactly one path got a battery to shoot; the loser reports failure (the
    // battery was already consumed — it can neither reserve nor succeed).
    const successes = [a, b].filter((r) => r.success && r.result === 'SUCCESS');
    expect(successes).toHaveLength(1);
    expect([a, b].filter((r) => r.success)).toHaveLength(1);

    // One consumption: one battery in COOLDOWN, one interception record.
    const rows = await adminPool.query(
      `SELECT status, cooldown_until FROM wmd_defense_batteries WHERE id = 'bat000000000000003'`
    );
    expect(rows.rows[0].status).toBe('COOLDOWN');
    expect(rows.rows[0].cooldown_until).not.toBeNull();
    const intercepts = await adminPool.query(
      `SELECT count(*)::int AS c FROM wmd_interceptions WHERE defender_id = 'CLAND' AND result = 'SUCCESS'`
    );
    expect(intercepts.rows[0].c).toBe(1);
  });

  it('the recovery sweep cannot override a future cooldown, DAMAGED, or null-deadline rows; paid repair still completes', async () => {
    const future = new Date(Date.now() + 3600000);
    await seedBattery('bat000000000000004', 'battery-D', 'CLANE', { status: 'COOLDOWN', cooldownUntil: future });
    await seedBattery('bat000000000000005', 'battery-E', 'CLANE', { status: 'DAMAGED', repairCompletesAt: new Date(Date.now() - 60000), cooldownUntil: null });
    await seedBattery('bat000000000000006', 'battery-F', 'CLANE', { status: 'COOLDOWN', cooldownUntil: null }); // ambiguous legacy

    const { defenseRepairCompleter } = await import('@/lib/wmd/jobs/defenseRepairCompleter');
    const { db } = await import('@/lib/db');
    await defenseRepairCompleter(db);

    const cooling = await batteryRow('bat000000000000004');
    expect(cooling.status).toBe('COOLDOWN'); // future deadline untouched
    expect(new Date(cooling.cooldown_until as string).getTime()).toBe(future.getTime());

    const damaged = await batteryRow('bat000000000000005');
    expect(damaged.status).toBe('IDLE'); // paid-repair completion (separate path)
    expect(damaged.repair_completes_at).toBeNull();

    const ambiguous = await batteryRow('bat000000000000006');
    expect(ambiguous.status).toBe('COOLDOWN'); // null deadline is NOT guessed
    expect(ambiguous.cooldown_until).toBeNull();
  });

  it('migration 0041 applied TWICE: validated backfill, ambiguous rows reported not guessed, real deadlines preserved', async () => {
    // Legacy RED-state rows: COOLDOWN with only updatedAt + duration.
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
    await seedBattery('bat000000000000007', 'battery-G', 'CLANF', { status: 'COOLDOWN', duration: 3600000, updatedAt: twoHoursAgo });
    await adminPool.query(`UPDATE wmd_defense_batteries SET cooldown_until = NULL WHERE id = 'bat000000000000007'`);
    await seedBattery('bat000000000000008', 'battery-H', 'CLANF', { status: 'COOLDOWN', duration: 0, updatedAt: twoHoursAgo });
    await adminPool.query(`UPDATE wmd_defense_batteries SET cooldown_until = NULL WHERE id = 'bat000000000000008'`);
    await seedBattery('bat000000000000009', 'battery-I', 'CLANF', { status: 'COOLDOWN', duration: 3600000, cooldownUntil: new Date(Date.now() + 5000) });

    const migrationSql = readFileSync(resolve('lib/db/migrations/0041_battery_cooldown_until.sql'), 'utf8');

    // First apply.
    await adminPool.query(migrationSql);

    const validated = await batteryRow('bat000000000000007');
    expect(validated.cooldown_until).not.toBeNull();
    const expected = new Date(twoHoursAgo.getTime() + 3600000).getTime();
    expect(new Date(validated.cooldown_until as string).getTime()).toBe(expected); // updated_at + validated duration (already due)

    const ambiguous = await batteryRow('bat000000000000008');
    expect(ambiguous.cooldown_until).toBeNull(); // duration 0 → reported, not guessed

    const real = await batteryRow('bat000000000000009');
    const realBefore = new Date(real.cooldown_until as string).getTime();

    // Second apply: idempotent — no deadline changes.
    await adminPool.query(migrationSql);

    expect(new Date((await batteryRow('bat000000000000007')).cooldown_until as string).getTime()).toBe(expected);
    expect((await batteryRow('bat000000000000008')).cooldown_until).toBeNull();
    expect(new Date((await batteryRow('bat000000000000009')).cooldown_until as string).getTime()).toBe(realBefore);
  });

});
