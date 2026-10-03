// @vitest-environment node
/**
 * @file __tests__/lib/harvestActionDeadline.integration.test.ts
 * @overview FID-20261002-012 §5.3 acceptance — the REAL harvestResourceTile
 *           on a disposable PostgreSQL, pinning the authoritative
 *           resource-harvest action deadline end-to-end:
 *
 *  - advanced-mining payout: base roll 1150 (Math.random 0.5 pinned) →
 *    ×1.10 yield stage = 1265 credited; control (no tech) = 1150.
 *  - the deadline commits WITH the payout in the SAME transaction:
 *    result.nextResourceHarvestAt === the players.next_resource_harvest_at
 *    column, ≈ now + 2400ms (tech) / + 3000ms (base).
 *  - in-lock admission: an immediate second harvest on a FRESH unclaimed tile
 *    is refused with retryAt === the stored deadline, NO payout, NO claim on
 *    the second tile (the tile stays harvestable once the clock allows).
 *  - deadline expiry: a past deadline admits; the payout rewrites it.
 *  - a depleted tile refuses on the CLAIM, not the clock (claim check first),
 *    and refusals write no deadline (a null deadline stays null).
 *
 * Reset periods / claim eligibility are untouched by the deadline (yield +
 * cadence only) — the claim records still gate per (player, period).
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002..009):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL is REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/harvestActionDeadline.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { TerrainType, type Tile } from '@/types/game.types';

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

describe.skipIf(skipSuite)('FID-20261002-012 — resource-harvest action deadline (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-012'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-012'),
        user: 'postgres',
        password: 'disposable',
        port: 55443,
        persistent: false,
        // Force a UTF8 cluster: the Windows default (locale-derived WIN1252)
        // breaks on non-ASCII content.
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
      url = 'postgresql://postgres:disposable@localhost:55443/postgres?client_encoding=UTF8';
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
        next_resource_harvest_at timestamptz,
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
      CREATE TABLE IF NOT EXISTS dailyharvestprogress (
        playerusername varchar(20) NOT NULL,
        date varchar(10) NOT NULL,
        resetperiod varchar(40) NOT NULL,
        harvestcount integer NOT NULL DEFAULT 0,
        milestonescompleted jsonb NOT NULL DEFAULT '[]',
        totalrpearned integer NOT NULL DEFAULT 0,
        lastharvestat timestamptz,
        updatedat timestamptz,
        createdat timestamptz,
        PRIMARY KEY (playerusername, date, resetperiod)
      );
    `);

    // Pin the base harvest roll: floor(0.5 × 701) + 800 = 1150.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  }, 120000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, tiles, flags, dailyharvestprogress CASCADE`);
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

  async function seedPlayer(username: string, opts: { techs?: string[] } = {}): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, unlocked_techs, next_resource_harvest_at)
       VALUES ($1, $2, NULL)
       ON CONFLICT (username) DO UPDATE SET
         unlocked_techs = $2, next_resource_harvest_at = NULL,
         resources_metal = 0, resources_energy = 0`,
      [username, JSON.stringify(opts.techs ?? [])],
    );
  }

  async function seedTile(x: number, y: number, terrain: string, claimedBy: { username: string; period: string } | null = null): Promise<void> {
    await adminPool.query(
      `INSERT INTO tiles (x, y, terrain, last_harvested_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (x, y) DO UPDATE SET terrain = $3, last_harvested_by = $4`,
      [x, y, terrain, claimedBy ? JSON.stringify([{ playerId: claimedBy.username, timestamp: new Date().toISOString(), resetPeriod: claimedBy.period }]) : null],
    );
  }

  async function playerRow(username: string): Promise<{ resources_metal: number; resources_energy: number; next_resource_harvest_at: Date | null; unlocked_techs: string[] | null }> {
    const { rows } = await adminPool.query(
      `SELECT resources_metal, resources_energy, next_resource_harvest_at, unlocked_techs FROM players WHERE username = $1`,
      [username],
    );
    return rows[0];
  }

  function metalTile(x: number, y: number): Tile {
    return { x, y, terrain: TerrainType.Metal } as unknown as Tile;
  }

  it('advanced-mining: +10% yield (1150 → 1265) and a 2400ms deadline committed WITH the payout', async () => {
    await seedPlayer('miner', { techs: ['advanced-mining'] });
    await seedTile(10, 10, 'Metal');
    await seedTile(10, 11, 'Metal');

    const { harvestResourceTile } = await import('@/lib/harvestService');

    const before = Date.now();
    const result = await harvestResourceTile('miner', metalTile(10, 10));
    const after = Date.now();

    expect(result.success).toBe(true);
    // Base roll 1150 (pinned), balance 0/0 → ×1.0 gathering, ×1.10 tech stage.
    expect(result.metalGained).toBe(1265);
    expect(result.nextResourceHarvestAt).toBeDefined();

    // Deadline written to the SAME players update — column === result value.
    const row = await playerRow('miner');
    expect(row.resources_metal).toBe(1265);
    expect(row.next_resource_harvest_at).not.toBeNull();
    expect(row.next_resource_harvest_at!.getTime()).toBe(result.nextResourceHarvestAt!.getTime());
    // 2400ms cadence (± slop for clock skew between nowForDeadline and Date.now()).
    expect(result.nextResourceHarvestAt!.getTime()).toBeGreaterThanOrEqual(before + 2400 - 50);
    expect(result.nextResourceHarvestAt!.getTime()).toBeLessThanOrEqual(after + 2400 + 50);
  }, 30000);

  it('in-lock admission: an immediate second harvest refuses with retryAt === the stored deadline, no payout, no claim', async () => {
    await seedPlayer('miner2', { techs: ['advanced-mining'] });
    await seedTile(20, 10, 'Metal');
    await seedTile(20, 11, 'Metal'); // FRESH tile — only the clock can refuse.

    const { harvestResourceTile } = await import('@/lib/harvestService');

    const first = await harvestResourceTile('miner2', metalTile(20, 10));
    expect(first.success).toBe(true);
    const deadline = first.nextResourceHarvestAt!.getTime();

    const second = await harvestResourceTile('miner2', metalTile(20, 11));
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/rate-limited/i);
    expect(second.retryAt).toBe(deadline); // exact — read back from the locked row
    expect(second.metalGained).toBeUndefined();

    // No payout, no claim on the fresh tile.
    const row = await playerRow('miner2');
    expect(row.resources_metal).toBe(1265);
    const { rows } = await adminPool.query(`SELECT last_harvested_by FROM tiles WHERE x = 20 AND y = 11`);
    expect(rows[0].last_harvested_by).toBeNull();
  }, 30000);

  it('base cadence: a player WITHOUT the tech gets 3000ms and the un-researched payout (1150)', async () => {
    await seedPlayer('plain');
    await seedTile(30, 10, 'Metal');
    await seedTile(30, 11, 'Metal');

    const { harvestResourceTile } = await import('@/lib/harvestService');

    const before = Date.now();
    const first = await harvestResourceTile('plain', metalTile(30, 10));
    const after = Date.now();

    expect(first.success).toBe(true);
    expect(first.metalGained).toBe(1150); // no ×1.10 stage
    expect(first.nextResourceHarvestAt!.getTime()).toBeGreaterThanOrEqual(before + 3000 - 50);
    expect(first.nextResourceHarvestAt!.getTime()).toBeLessThanOrEqual(after + 3000 + 50);

    const second = await harvestResourceTile('plain', metalTile(30, 11));
    expect(second.success).toBe(false);
    expect(second.retryAt).toBe(first.nextResourceHarvestAt!.getTime());
  }, 30000);

  it('deadline expiry admits: a past deadline harvests again and the payout REWRITES the deadline', async () => {
    await seedPlayer('returning', { techs: ['advanced-mining'] });
    await seedTile(40, 10, 'Metal');
    await seedTile(40, 11, 'Metal');
    await adminPool.query(
      `UPDATE players SET next_resource_harvest_at = NOW() - INTERVAL '1 millisecond' WHERE username = 'returning'`,
    );

    const { harvestResourceTile } = await import('@/lib/harvestService');

    const before = Date.now();
    const result = await harvestResourceTile('returning', metalTile(40, 10));
    const after = Date.now();

    expect(result.success).toBe(true);
    expect(result.metalGained).toBe(1265);
    // The consumed deadline was in the past — the new one is FRESH (~now+2400).
    expect(result.nextResourceHarvestAt!.getTime()).toBeGreaterThanOrEqual(before + 2400 - 50);
    expect(result.nextResourceHarvestAt!.getTime()).toBeLessThanOrEqual(after + 2400 + 50);
    const row = await playerRow('returning');
    expect(row.next_resource_harvest_at!.getTime()).toBe(result.nextResourceHarvestAt!.getTime());
  }, 30000);

  it('a depleted tile refuses on the CLAIM, not the clock — and refusals write no deadline', async () => {
    await seedPlayer('greedy'); // deadline currently NULL
    const { getCurrentResetPeriod, harvestResourceTile } = await import('@/lib/harvestService');
    const period = getCurrentResetPeriod(50);
    await seedTile(50, 10, 'Metal', { username: 'greedy', period }); // already claimed THIS period

    const result = await harvestResourceTile('greedy', metalTile(50, 10));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already harvested/i);
    expect(result.retryAt).toBeUndefined(); // NOT the rate-limit envelope

    // The refusal never wrote a deadline.
    const row = await playerRow('greedy');
    expect(row.next_resource_harvest_at).toBeNull();
  }, 30000);
});
