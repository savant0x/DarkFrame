// @vitest-environment node
/**
 * @file __tests__/lib/economyTransactions.integration.test.ts
 * @overview FID-20261002-002 §5 acceptance — REAL-PostgreSQL interleaving tests
 *           for the atomic-economy contract. Mocks establish call contracts;
 *           they cannot prove database race safety, so the FID's core
 *           acceptance criteria (concurrent spends, checkpoint claims,
 *           injected-failure rollback) are pinned here against a disposable
 *           PostgreSQL instance.
 *
 * SAFETY CONTRACT (FID-002 §5, binding):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL. Unset → the suite SKIPS
 *    (CI and local full-suite runs stay DB-less and green).
 *  - A production-shaped URL (Supabase/RDS/Neon/Azure/Heroku/Render) is
 *    REFUSED with a thrown error, never quietly used — fail-closed, per the
 *    FID's "reject production connection targets".
 *  - The suite seeds its own fixtures and drops its own tables; it never
 *    reads or writes anything it did not create.
 *
 * Run locally with the disposable container:
 *   ECHO_DISPOSABLE_DATABASE_URL=postgresql://postgres:<pw>@localhost:55432/disposable \
 *     npx vitest run __tests__/lib/economyTransactions.integration.test.ts
 *
 * Or let the suite self-provision a throwaway PostgreSQL from the REAL
 * binaries shipped by the `embedded-postgres` devDependency (no Docker, no
 * external service; data dir under gitignored dev/tmp, deleted on stop):
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/economyTransactions.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const EXTERNAL_URL = process.env.ECHO_DISPOSABLE_DATABASE_URL;
const AUTO_PROVISION = process.env.ECHO_AUTO_DISPOSABLE_PG === '1';

/** Fail-closed refusal of any production-shaped target (FID-002 §5). */
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

describe.skipIf(skipSuite)('FID-20261002-002 — atomic economy interleaving (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      // Self-provisioned throwaway cluster: REAL PostgreSQL binaries from the
      // embedded-postgres devDependency, data dir under gitignored dev/tmp.
      rmSync(resolve('dev/tmp/echo-pg-data'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data'),
        user: 'postgres',
        password: 'disposable',
        port: 55432,
        persistent: false, // stop() deletes the data dir — disposable by construction
        // TLS on: the app's pool always requests SSL (rejectUnauthorized:false),
        // so the throwaway server must speak it. Self-signed throwaway certs.
        postgresFlags: [
          '-c', 'ssl=on',
          '-c', `ssl_cert_file=${resolve('dev/tmp/pg-certs/server.crt')}`,
          '-c', `ssl_key_file=${resolve('dev/tmp/pg-certs/server.key')}`,
        ],
      });
      await instance.initialise();
      await instance.start();
      embedded = instance;
      url = 'postgresql://postgres:disposable@localhost:55432/postgres';
    }
    assertDisposableTarget(url);

    adminPool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });

    // The app's pool is lazy: point it at the disposable target before the
    // first app query of this process. This suite runs standalone (it self-
    // skips inside test:ci), so the shared pool has not been built yet.
    process.env.DATABASE_URL = url;

    // Minimal schema for the touched writer paths — disposable, rebuilt here.
    await adminPool.query(`
      CREATE TABLE IF NOT EXISTS players (
        username varchar(20) PRIMARY KEY,
        resources_metal integer NOT NULL DEFAULT 0,
        resources_energy integer NOT NULL DEFAULT 0,
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
        specialization jsonb,
        discoveries jsonb,
        achievements jsonb,
        stats jsonb
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
      -- Full clans shape: lockClanRow selects the whole row (FOR UPDATE),
      -- so the fixture must carry every column the drizzle schema declares.
      CREATE TABLE IF NOT EXISTS clans (
        id varchar(24) PRIMARY KEY,
        name varchar(30) NOT NULL DEFAULT 'Probe Clan',
        tag varchar(6) NOT NULL DEFAULT 'PRB',
        description text NOT NULL DEFAULT '',
        leader_id varchar(20) NOT NULL DEFAULT 'cont_a',
        members jsonb NOT NULL DEFAULT '[]',
        max_members integer NOT NULL DEFAULT 20,
        level_current_level integer NOT NULL DEFAULT 1,
        level_total_xp integer NOT NULL DEFAULT 0,
        level_current_level_xp integer NOT NULL DEFAULT 0,
        level_xp_to_next_level integer NOT NULL DEFAULT 0,
        level_features_unlocked jsonb NOT NULL DEFAULT '[]',
        level_milestones_completed jsonb NOT NULL DEFAULT '[]',
        level_last_level_up timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        settings_message_of_the_day varchar(500) NOT NULL DEFAULT '',
        settings_is_recruiting smallint NOT NULL DEFAULT 1,
        settings_min_level_to_join integer NOT NULL DEFAULT 1,
        settings_requires_approval smallint NOT NULL DEFAULT 0,
        settings_allow_territory_control smallint NOT NULL DEFAULT 0,
        settings_allow_war_declarations smallint NOT NULL DEFAULT 0,
        stats_total_power integer NOT NULL DEFAULT 0,
        stats_total_territories integer NOT NULL DEFAULT 0,
        stats_total_monuments integer NOT NULL DEFAULT 0,
        stats_wars_won integer NOT NULL DEFAULT 0,
        stats_wars_lost integer NOT NULL DEFAULT 0,
        stats_total_rp integer NOT NULL DEFAULT 0,
        research_research_points integer NOT NULL DEFAULT 0,
        research_unlocked_techs jsonb NOT NULL DEFAULT '[]',
        research_active_research varchar(50),
        bank_treasury_metal integer NOT NULL DEFAULT 0,
        bank_treasury_energy integer NOT NULL DEFAULT 0,
        bank_treasury_research_points integer NOT NULL DEFAULT 0,
        bank_tax_rates_metal numeric(5,2) NOT NULL DEFAULT 0,
        bank_tax_rates_energy numeric(5,2) NOT NULL DEFAULT 0,
        bank_tax_rates_research_points numeric(5,2) NOT NULL DEFAULT 0,
        bank_upgrade_level integer NOT NULL DEFAULT 1,
        bank_capacity integer NOT NULL DEFAULT 0,
        bank_transactions jsonb NOT NULL DEFAULT '[]',
        active_perks jsonb NOT NULL DEFAULT '[]',
        territories jsonb NOT NULL DEFAULT '[]',
        monuments jsonb NOT NULL DEFAULT '[]',
        wars_active jsonb NOT NULL DEFAULT '[]',
        wars_history jsonb NOT NULL DEFAULT '[]',
        wmd_cooldown_until timestamptz,
        last_wmd_launch timestamptz,
        last_territory_income_collection timestamptz
      );
      CREATE TABLE IF NOT EXISTS mod_log (
        id varchar(24) PRIMARY KEY,
        moderator_id varchar(20) NOT NULL,
        action varchar(50) NOT NULL,
        target_id varchar(50),
        reason varchar(500) NOT NULL,
        details text,
        created_at timestamptz NOT NULL
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
      CREATE TABLE IF NOT EXISTS player_research (
        id varchar(50) PRIMARY KEY,
        player_id varchar(20) NOT NULL UNIQUE,
        player_username varchar(20) NOT NULL,
        clan_id varchar(24),
        completed_techs jsonb DEFAULT '[]',
        available_techs jsonb DEFAULT '[]',
        locked_techs jsonb DEFAULT '[]',
        current_research_tech_id varchar(50),
        current_research_started_at timestamptz,
        current_research_rp_spent integer,
        current_research_rp_required integer,
        current_research_progress numeric(5,2),
        missile_tier integer DEFAULT 0,
        defense_tier integer DEFAULT 0,
        intelligence_tier integer DEFAULT 0,
        total_rp_spent integer DEFAULT 0,
        total_techs_unlocked integer DEFAULT 0,
        clan_research_bonus numeric(5,2) DEFAULT 0,
        updated_at timestamptz
      );
    `);
  }, 120000); // initdb + first start of a real cluster takes seconds, not ms

  afterAll(async () => {
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, rptransactions, rp_daily_totals, clans, mod_log, factories, player_research CASCADE`);
      await adminPool.end();
    }
    // persistent:false → stop() deletes the throwaway data dir entirely.
    if (embedded) {
      await embedded.stop();
    }
  }, 30000);

  async function seedPlayer(username: string, rp: number): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, research_points) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET research_points = $2, rp_history = NULL, xp = 0, level = 1`,
      [username, rp]
    );
  }

  async function balanceOf(username: string): Promise<number> {
    const r = await adminPool.query('SELECT research_points FROM players WHERE username = $1', [username]);
    return r.rows[0]?.research_points ?? 0;
  }

  it('R15 core acceptance: two concurrent 60-RP spends from 100 produce exactly ONE success, final 40, one debit ledger row', async () => {
    await seedPlayer('race_spend', 100);
    const { spendRP } = await import('@/lib/researchPointService');

    const [a, b] = await Promise.all([
      spendRP('race_spend', 60, 'concurrent probe A'),
      spendRP('race_spend', 60, 'concurrent probe B'),
    ]);

    const successes = [a, b].filter((r) => r.success);
    const refusals = [a, b].filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(1);
    expect(successes[0].newBalance).toBe(40);

    // Balance conserved: exactly one debit committed.
    expect(await balanceOf('race_spend')).toBe(40);

    // Exactly one debit ledger row and one history entry.
    const ledger = await adminPool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0)::int AS total FROM rptransactions WHERE playerusername = $1`,
      ['race_spend']
    );
    expect(ledger.rows[0].n).toBe(1);
    expect(ledger.rows[0].total).toBe(-60);

    const player = await adminPool.query('SELECT rp_history FROM players WHERE username = $1', ['race_spend']);
    expect(player.rows[0].rp_history).toHaveLength(1);
    expect(player.rows[0].rp_history[0].amount).toBe(-60);
  });

  it('concurrent CREDITS both survive: balances, history and ledger contain both awards', async () => {
    await seedPlayer('race_award', 0);
    const { awardRP } = await import('@/lib/researchPointService');

    const [a, b] = await Promise.all([
      awardRP('race_award', 100, 'battle', 'probe win A'),
      awardRP('race_award', 150, 'daily_login', 'probe streak B'),
    ]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);

    expect(await balanceOf('race_award')).toBe(250); // relative credits compose

    const ledger = await adminPool.query(
      `SELECT COUNT(*)::int AS n FROM rptransactions WHERE playerusername = $1 AND amount > 0`,
      ['race_award']
    );
    expect(ledger.rows[0].n).toBe(2);

    const history = await adminPool.query('SELECT rp_history FROM players WHERE username = $1', ['race_award']);
    expect(history.rows[0].rp_history).toHaveLength(2);
  });

  it('concurrent XP awards crossing a level boundary conserve XP exactly (no lost update) and grant level RP once per crossing', async () => {
    await seedPlayer('race_xp', 0);
    await adminPool.query(`UPDATE players SET xp = 480, level = 1 WHERE username = 'race_xp'`);
    const { awardXP, XPAction } = await import('@/lib/xpService');

    // L1→L2 costs 500 XP; two concurrent +50 awards both cross it, each from
    // its own locked view. The old snapshot write lost one award's XP.
    const [r1, r2] = await Promise.all([
      awardXP('race_xp', XPAction.FIRST_LOGIN, 0.25), // 200 × 0.25 = 50 XP
      awardXP('race_xp', XPAction.DAILY_LOGIN, 2.5),  // 20 × 2.5  = 50 XP
    ]);
    expect(r1.xpAwarded).toBe(50);
    expect(r2.xpAwarded).toBe(50);

    const row = (
      await adminPool.query('SELECT xp, level, research_points FROM players WHERE username = $1', ['race_xp'])
    ).rows[0];
    expect(row.xp).toBe(580); // both awards survive — no lost update
    expect(row.level).toBe(2);

    // Exactly-once grants: the player crossed L1→L2 once in total, so exactly
    // one 10-RP level_up grant exists (the second award, seeing level 2 under
    // its lock, correctly grants nothing — no double grant for one transition).
    expect(row.research_points).toBe(10);
    const ledger = await adminPool.query(
      `SELECT COUNT(*)::int AS n FROM rptransactions WHERE playerusername = 'race_xp' AND source = 'level_up'`
    );
    expect(ledger.rows[0].n).toBe(1);
  });

  it('factory income double-collection pays exactly once: checkpoints and credit commit together', async () => {
    await seedPlayer('income_p', 0);
    await adminPool.query(
      `INSERT INTO factories (x, y, owner, level, slots, last_resource_generation)
       VALUES (10, 10, 'income_p', 10, 50, NOW() - INTERVAL '1 hour')
       ON CONFLICT (x, y) DO UPDATE SET owner = 'income_p', level = 10,
         last_resource_generation = NOW() - INTERVAL '1 hour'`,
      []
    );
    const { collectAllFactoryIncome } = await import('@/lib/factoryService');

    const [a, b] = await Promise.all([
      collectAllFactoryIncome('income_p'),
      collectAllFactoryIncome('income_p'),
    ]);

    // Level 10: 10,000 metal/hour + 5,000 energy/hour — exactly ONE sweep pays.
    expect(a.totalMetal + b.totalMetal).toBe(10000);
    expect(a.totalEnergy + b.totalEnergy).toBe(5000);

    const player = await adminPool.query(
      'SELECT resources_metal, resources_energy FROM players WHERE username = $1',
      ['income_p']
    );
    expect(player.rows[0].resources_metal).toBe(10000);
    expect(player.rows[0].resources_energy).toBe(5000);

    // Sequential repeat: no second payout (checkpoint already advanced).
    const again = await collectAllFactoryIncome('income_p');
    expect(again.totalMetal).toBe(0);
    expect(again.totalEnergy).toBe(0);
  });

  it('clan contribution race under the global lock order (clan first): both members contribute, pool exact', async () => {
    await adminPool.query(
      `INSERT INTO clans (id, members, research_research_points)
       VALUES ('fid002clan',
               '[{"playerId":"cont_a","role":"MEMBER"},{"playerId":"cont_b","role":"MEMBER"}]',
               0)
       ON CONFLICT (id) DO UPDATE SET members = $1, research_research_points = 0`,
      ['[{"playerId":"cont_a","role":"MEMBER"},{"playerId":"cont_b","role":"MEMBER"}]']
    );
    await seedPlayer('cont_a', 1000);
    await seedPlayer('cont_b', 1000);
    const { contributeRP } = await import('@/lib/clanResearchService');

    const [a, b] = await Promise.all([
      contributeRP('fid002clan', 'cont_a', 400),
      contributeRP('fid002clan', 'cont_b', 600),
    ]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);

    const clan = await adminPool.query(
      'SELECT research_research_points FROM clans WHERE id = $1',
      ['fid002clan']
    );
    expect(clan.rows[0].research_research_points).toBe(1000); // 400 + 600, no lost update
    expect(await balanceOf('cont_a')).toBe(600);
    expect(await balanceOf('cont_b')).toBe(400);
  });

  it('injected ledger failure rolls the WHOLE spend back: balance, history and ledger unchanged', async () => {
    await seedPlayer('fail_spend', 100);
    const { spendRP } = await import('@/lib/researchPointService');

    // Make the in-transaction ledger INSERT impossible: the rename simulates
    // a ledger outage mid-operation (the FID's injected-failure probe).
    await adminPool.query('ALTER TABLE rptransactions RENAME TO rptransactions_bak');

    let result: Awaited<ReturnType<typeof spendRP>>;
    try {
      result = await spendRP('fail_spend', 40, 'failure injection probe');
    } finally {
      await adminPool.query('ALTER TABLE rptransactions_bak RENAME TO rptransactions');
    }

    expect(result.success).toBe(false);
    // Nothing moved: the relative debit rolled back with the ledger failure.
    expect(await balanceOf('fail_spend')).toBe(100);
    const history = await adminPool.query('SELECT rp_history FROM players WHERE username = $1', ['fail_spend']);
    expect(history.rows[0].rp_history).toBeNull();
  });

  it('WMD research completion is atomic: debit, contribution, completion effects and recalculation commit together', async () => {
    await seedPlayer('wmd_p', 500);
    await adminPool.query(
      `INSERT INTO player_research (id, player_id, player_username, completed_techs, available_techs, locked_techs,
         current_research_tech_id, current_research_started_at, current_research_rp_spent, current_research_rp_required,
         total_rp_spent, total_techs_unlocked, updated_at)
       VALUES ('fid002pr', 'wmd_p', 'wmd_p', '["wmd_tier_1"]'::jsonb, '["wmd_tier_2"]'::jsonb, '[]'::jsonb,
         'wmd_tier_2', NOW(), 0, 100, 0, 0, NOW())
       ON CONFLICT (player_id) DO UPDATE SET current_research_tech_id = 'wmd_tier_2',
         current_research_rp_spent = 0, current_research_rp_required = 100,
         completed_techs = '["wmd_tier_1"]'::jsonb`,
      []
    );
    const { spendRPOnResearch } = await import('@/lib/wmd/researchService');

    const result = await spendRPOnResearch('wmd_p', 100);
    expect(result.success).toBe(true);
    expect(result.completed).toBe(true);

    // Debit committed exactly once.
    expect(await balanceOf('wmd_p')).toBe(400);

    const pr = await adminPool.query('SELECT * FROM player_research WHERE player_id = $1', ['wmd_p']);
    const row = pr.rows[0];
    expect(row.completed_techs).toContain('wmd_tier_2'); // completion effect (same tx)
    expect(row.current_research_tech_id).toBeNull(); // active track cleared
    expect(row.total_rp_spent).toBe(100);
    expect(row.total_techs_unlocked).toBe(1);
    // Recalculation (same tx): the completed tech left the available set.
    expect(row.available_techs).not.toContain('wmd_tier_2');
    // Domain tier derived from the completed set (same tx).
    expect(Number(row.missile_tier) + Number(row.defense_tier) + Number(row.intelligence_tier)).toBeGreaterThan(0);
  });
});
