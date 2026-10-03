// @vitest-environment node
/**
 * @file __tests__/lib/botSummonPlacement.integration.test.ts
 * @overview FID-20261002-009 §5 acceptance — REAL summonBots/createBotPlayer
 *           on a disposable PostgreSQL. The RED defect (R18): summonBots
 *           claimed a Wasteland tile via createBotPlayer, then substituted
 *           unchecked client-derived offsets — claimed tile stayed at the old
 *           location, rows/response disagreed with tile ownership, positions
 *           could collide or leave the map. These probes pin the corrected
 *           engine on real database contention:
 *
 *  - Real summon: exactly five DISTINCT claims within Euclidean radius 20 of
 *    the summoner's LOCKED row position; player rows = response = claimed
 *    tiles; tile base_owner matches the bot username (identity rides with its
 *    tile); no claim at an unrelated tile (the summoner's own base and a
 *    foreign base stay untouched); cooldown + botConfig.summonedBy set.
 *  - Concurrent summons on one account: both batch transactions serialize on
 *    the FOR UPDATE player row — exactly one batch commits (5 claims, 5 bots),
 *    the other refuses on cooldown; no tile is double-claimed.
 *  - Contention over a scarce overlap: two adjacent summoners with exactly
 *    five legal Wasteland tiles between them — one batch wins whole, the
 *    other refuses; competing claims never share a tile.
 *  - Fewer than five legal positions: refusal rolls back EVERYTHING — zero
 *    claims, zero bot rows, cooldown untouched.
 *  - Injected failure after claims (missing bot_config column): the whole
 *    transaction rolls back — no orphan claims, no consumed cooldown.
 *  - Ordinary createBotPlayer spawn keeps the original defaults (zone sector,
 *    claim invariant, identity generation) with zero summon-only restrictions.
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002..008):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL is REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/botSummonPlacement.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { BotSpecialization } from '@/types/game.types';

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

// Deterministic bot identities: summonBots pre-generates ownerUsernames via
// the exported generateBotName — replace it with a counter so concurrent/
// repeated summons can never collide on the players PK. The REAL claim and
// placement engine (claimBotBaseTile, claimBotTilesInRadius, createBotPlayer,
// zoneForTile) stays production-exact.
vi.mock('@/lib/botService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/botService')>();
  let n = 0;
  return {
    ...actual,
    generateBotName: () => `SummonedBot${String(++n).padStart(3, '0')}`,
  };
});

describe.skipIf(skipSuite)('FID-20261002-009 — summoned bot placement + tile ownership (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-009'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-009'),
        user: 'postgres',
        password: 'disposable',
        port: 55441,
        persistent: false,
        // Force a UTF8 cluster: the Windows default (locale-derived WIN1252)
        // breaks on non-ASCII content (base greetings).
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
      url = 'postgresql://postgres:disposable@localhost:55441/postgres?client_encoding=UTF8';
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
    `);

    // Pin every in-process roll (bot tiers, resource ranges, greetings); the
    // SQL-side random() ordering in claimBotBaseTile is not Math.random.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  }, 120000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, tiles CASCADE`);
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

  const TECH = ['bot-summoning-circle'];

  async function seedPlayer(username: string, opts: {
    x?: number; y?: number; tech?: boolean; lastBotSummon?: Date | null;
  } = {}): Promise<void> {
    const x = opts.x ?? 0;
    const y = opts.y ?? 0;
    await adminPool.query(
      `INSERT INTO players (username, base_x, base_y, current_position_x, current_position_y, unlocked_techs, last_bot_summon)
       VALUES ($1, $2, $3, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE SET
         base_x = $2, base_y = $3, current_position_x = $2, current_position_y = $3,
         unlocked_techs = $4, last_bot_summon = $5, is_bot = 0`,
      [username, x, y, opts.tech === false ? '[]' : JSON.stringify(TECH), opts.lastBotSummon ?? null],
    );
  }

  async function seedTile(x: number, y: number, terrain = 'Wasteland', owner: string | null = null): Promise<void> {
    await adminPool.query(
      `INSERT INTO tiles (x, y, terrain, occupied_by_base, base_owner)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (x, y) DO UPDATE SET
         terrain = $3, occupied_by_base = $4, base_owner = $5`,
      [x, y, terrain, owner ? 1 : null, owner],
    );
  }

  /** Wasteland grid inside radius 20 of (cx,cy), on-map; count deterministic. */
  async function seedWastelandRing(cx: number, cy: number, count: number): Promise<void> {
    let placed = 0;
    for (let dy = 0; placed < count && dy <= 20; dy++) {
      for (let dx = 0; placed < count && dx * dx + dy * dy <= 400; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 1 && y >= 1 && x <= 150 && y <= 150) {
          await seedTile(x, y);
          placed++;
        }
      }
    }
    if (placed < count) throw new Error(`ring seeding needed ${count}, placed ${placed}`);
  }

  async function claimedTiles(): Promise<Array<{ x: number; y: number; base_owner: string }>> {
    const res = await adminPool.query(
      `SELECT x, y, base_owner FROM tiles WHERE occupied_by_base = 1 AND base_owner LIKE 'SummonedBot%'`
    );
    return res.rows;
  }

  /** Claims scoped to one probe's region (earlier tests' claims stay put). */
  async function claimsNear(cx: number, cy: number, r: number): Promise<Array<{ x: number; y: number; base_owner: string }>> {
    const res = await adminPool.query(
      `SELECT x, y, base_owner FROM tiles
       WHERE occupied_by_base = 1 AND base_owner LIKE 'SummonedBot%'
         AND (x - $1) ^ 2 + (y - $2) ^ 2 <= $3 ^ 2`,
      [cx, cy, r],
    );
    return res.rows;
  }

  async function botRows(): Promise<Array<Record<string, unknown>>> {
    const res = await adminPool.query(
      `SELECT username, base_x, base_y, current_position_x, current_position_y, is_bot, bot_config, resources_metal, resources_energy
       FROM players WHERE is_bot = 1 ORDER BY username`
    );
    return res.rows;
  }

  async function lastSummonOf(username: string): Promise<Date | null> {
    const res = await adminPool.query(`SELECT last_bot_summon FROM players WHERE username = $1`, [username]);
    return res.rows[0]?.last_bot_summon ?? null;
  }

  it('real summon: 5 distinct claims within Euclidean radius 20, rows=response=tiles, identity matches base_owner, no claim at unrelated tiles', async () => {
    await seedPlayer('summoner', { x: 75, y: 75, tech: true });
    await seedTile(75, 75, 'Wasteland', 'summoner'); // the summoner's OWN base tile
    await seedTile(60, 80, 'Wasteland', 'foreigner'); // an unrelated foreign base
    await seedWastelandRing(75, 75, 40);
    await seedTile(75, 75, 'Wasteland', 'summoner'); // restore own-base ownership after ring overwrite
    await seedTile(60, 80, 'Wasteland', 'foreigner');
    await seedTile(101, 75, 'Metal'); // in the box but wrong terrain (x=101 > 75+20 anyway)
    await seedTile(75, 101, 'Metal'); // wrong terrain

    const { summonBots } = await import('@/lib/botSummoningService');
    const res = await summonBots('summoner', BotSpecialization.Hoarder);

    expect(res.success).toBe(true);
    expect(res.bots).toHaveLength(5);

    const positions = res.bots!.map((b) => b.position);
    // Distinct, on-map, within Euclidean radius 20 of the LOCKED row position.
    expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).toBe(5);
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(150);
      expect(p.y).toBeLessThanOrEqual(150);
      expect((p.x - 75) ** 2 + (p.y - 75) ** 2).toBeLessThanOrEqual(400);
    }

    // Player rows = response = claimed tiles; base_owner matches the bot.
    const tiles = await claimedTiles();
    expect(tiles).toHaveLength(5);
    const tileByKey = new Map(tiles.map((t) => [`${t.x},${t.y}`, t.base_owner]));
    const rows = await botRows();
    expect(rows).toHaveLength(5);
    for (const bot of res.bots!) {
      const row = rows.find((r) => r.username === bot.username);
      expect(row).toBeDefined();
      expect(Number(row!.base_x)).toBe(bot.position.x);
      expect(Number(row!.base_y)).toBe(bot.position.y);
      expect(Number(row!.current_position_x)).toBe(bot.position.x);
      expect(Number(row!.current_position_y)).toBe(bot.position.y);
      expect(tileByKey.get(`${bot.position.x},${bot.position.y}`)).toBe(bot.username);
      const cfg = row!.bot_config as { summonedBy?: string };
      expect(cfg.summonedBy).toBe('summoner');
    }

    // No claim at the summoner's own base or the foreign base.
    const own = await adminPool.query(`SELECT base_owner FROM tiles WHERE x = 75 AND y = 75`);
    expect(own.rows[0].base_owner).toBe('summoner');
    const foreign = await adminPool.query(`SELECT base_owner FROM tiles WHERE x = 60 AND y = 80`);
    expect(foreign.rows[0].base_owner).toBe('foreigner');

    // Cooldown consumed in the same transaction.
    expect(await lastSummonOf('summoner')).not.toBeNull();
  });

  it('in-lock admission: tech gate and cooldown gate refuse without claiming anything', async () => {
    await seedPlayer('notech', { x: 30, y: 30, tech: false });
    await seedWastelandRing(30, 30, 10);
    const { summonBots } = await import('@/lib/botSummoningService');
    const noTech = await summonBots('notech', BotSpecialization.Raider);
    expect(noTech.success).toBe(false);
    expect(noTech.message).toContain('Bot Summoning Circle');
    expect(await claimsNear(30, 30, 20)).toHaveLength(0);

    await seedPlayer('cooling', { x: 30, y: 30, tech: true, lastBotSummon: new Date(Date.now() - 3600_000) });
    const onCooldown = await summonBots('cooling', BotSpecialization.Raider);
    expect(onCooldown.success).toBe(false);
    expect(onCooldown.message).toContain('cooldown');
    expect(await claimsNear(30, 30, 20)).toHaveLength(0);
  });

  it('concurrent summons on ONE account: one batch commits, the other refuses on cooldown — no double claims', async () => {
    await seedPlayer('racer', { x: 100, y: 100, tech: true });
    await seedWastelandRing(100, 100, 30);

    const { summonBots } = await import('@/lib/botSummoningService');
    const [a, b] = await Promise.all([
      summonBots('racer', BotSpecialization.Fortress),
      summonBots('racer', BotSpecialization.Raider),
    ]);

    const outcomes = [a, b];
    expect(outcomes.filter((r) => r.success)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.success)).toHaveLength(1);
    // Exactly one batch of five claims, all distinct tiles.
    const tiles = await claimsNear(100, 100, 20);
    expect(tiles).toHaveLength(5);
    expect(new Set(tiles.map((t) => `${t.x},${t.y}`)).size).toBe(5);
  });

  it('scarce overlap: two adjacent summoners, exactly 5 legal tiles — one batch wins whole, the loser claims NOTHING', async () => {
    await seedPlayer('adjA', { x: 10, y: 10, tech: true });
    await seedPlayer('adjB', { x: 11, y: 10, tech: true });
    // Exactly five legal Wasteland tiles inside BOTH radii; a sixth lies
    // outside adjA's radius but inside adjB's, proving the loser isn't merely
    // radius-starved — it lost the race for the shared five.
    await seedTile(5, 5); await seedTile(6, 5); await seedTile(7, 5); await seedTile(8, 5); await seedTile(9, 5);
    await seedTile(30, 5); // only legal for adjB (distance 19 from 11,10... within 20)
    // A decoy inside adjB's radius but outside adjA's, on-map: (31,5) is 20 from adjA? no — make it clearly out.
    await seedTile(50, 50); // outside both radii

    const { summonBots } = await import('@/lib/botSummoningService');
    const [a, b] = await Promise.all([
      summonBots('adjA', BotSpecialization.Hoarder),
      summonBots('adjB', BotSpecialization.Hoarder),
    ]);

    // Both radii share only the five clustered tiles: (5..9,5) are within 20
    // of (10,10) AND of (11,10); (30,5) is 19.0 from (11,10) but 25.2 from
    // (10,10) — so adjB has six candidates, adjA exactly five.
    const winners = [a, b].filter((r) => r.success);
    const losers = [a, b].filter((r) => !r.success);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].message).toMatch(/legal summon position/i);

    // All five clustered tiles are claimed, exclusively by the winner's batch.
    const tiles = await adminPool.query(
      `SELECT x, y, base_owner FROM tiles WHERE occupied_by_base = 1 AND x BETWEEN 5 AND 9 AND y = 5`
    );
    expect(tiles.rows).toHaveLength(5);
    for (const t of tiles.rows) {
      expect(winners[0].bots!.some((bot) => bot.username === t.base_owner)).toBe(true);
    }
  });

  it('fewer than 5 legal positions: refusal rolls back claims, inserts AND cooldown', async () => {
    await seedPlayer('starved', { x: 140, y: 140, tech: true });
    await seedTile(135, 135); await seedTile(136, 135); await seedTile(137, 135); // only 3 legal
    await seedTile(150, 150, 'Metal'); // wrong terrain inside the box

    const { summonBots } = await import('@/lib/botSummoningService');
    const baseline = (await botRows()).length;
    const res = await summonBots('starved', BotSpecialization.Ghost);

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Only 3 legal summon position/);
    expect(await claimsNear(140, 140, 20)).toHaveLength(0);
    expect(await botRows()).toHaveLength(baseline); // no new bot rows
    expect(await lastSummonOf('starved')).toBeNull(); // cooldown NOT consumed
  });

  it('injected failure after claims: the whole transaction rolls back — no orphan claims, no cooldown', async () => {
    await seedPlayer('doomed', { x: 120, y: 120, tech: true });
    await seedWastelandRing(120, 120, 20);

    // Injection: a BEFORE INSERT trigger on players raises only for the
    // summoned identities — so the failure lands AFTER all five tile claims
    // have been written inside the transaction (a dropped column would break
    // the very first SELECT, before any claim).
    await adminPool.query(`
      CREATE OR REPLACE FUNCTION raise_if_summoned() RETURNS trigger AS $$
      BEGIN
        IF NEW.username LIKE 'SummonedBot%' THEN
          RAISE EXCEPTION 'injected post-claim failure for %', NEW.username;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER players_inject_failure BEFORE INSERT ON players
        FOR EACH ROW EXECUTE FUNCTION raise_if_summoned();
    `);
    const { summonBots } = await import('@/lib/botSummoningService');
    const res = await summonBots('doomed', BotSpecialization.Balanced);
    await adminPool.query(`DROP TRIGGER players_inject_failure ON players`);

    expect(res.success).toBe(false);
    expect(res.message).toContain('no bots, claims or cooldown were consumed');
    expect(await claimsNear(120, 120, 20)).toHaveLength(0); // claims rolled back
    expect(await lastSummonOf('doomed')).toBeNull(); // cooldown rolled back
  });

  it('ordinary createBotPlayer spawn keeps the original defaults (no summon-only restrictions)', async () => {
    await seedTile(60, 60); // Wasteland inside zone 4's sector (x,y ∈ 51..100)
    const { createBotPlayer, zoneForTile } = await import('@/lib/botService');
    const bot = await createBotPlayer(null, BotSpecialization.Raider, false, null);
    expect(bot.username).toBeTruthy();
    expect(bot.base).toBeDefined();
    const { x, y } = bot.base as { x: number; y: number };
    // Zone 4's sector: the claim must respect the caller's zone constraint
    // (candidates outside 51..100 exist on the map but are ineligible).
    expect(x).toBeGreaterThanOrEqual(51); expect(x).toBeLessThanOrEqual(100);
    expect(y).toBeGreaterThanOrEqual(51); expect(y).toBeLessThanOrEqual(100);
    expect(bot.currentPosition).toEqual(bot.base);
    expect((bot.botConfig as { zone?: number }).zone).toBe(zoneForTile(x, y));

    // The claimed tile is now occupied by THIS bot (identity = claim owner).
    const tile = await adminPool.query(
      `SELECT occupied_by_base, base_owner FROM tiles WHERE x = $1 AND y = $2`, [x, y]
    );
    expect(Number(tile.rows[0].occupied_by_base)).toBe(1);
    expect(tile.rows[0].base_owner).toBe(bot.username);
  });

  it('zoneForTile matches the repository convention (sector 50, 1-based, clamped)', async () => {
    const { zoneForTile } = await import('@/lib/botService');
    expect(zoneForTile(1, 1)).toBe(0);
    expect(zoneForTile(50, 50)).toBe(0);
    expect(zoneForTile(51, 1)).toBe(3);
    expect(zoneForTile(75, 75)).toBe(4);
    expect(zoneForTile(1, 51)).toBe(1);
    expect(zoneForTile(150, 150)).toBe(8);
    expect(zoneForTile(101, 75)).toBe(7);
  });
});
