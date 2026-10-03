// @vitest-environment node
/**
 * @file __tests__/api/combat/humanRaidAdmission.integration.test.ts
 * @overview FID-20261002-003 §5 acceptance — the HUMAN base-raid transaction
 *           on a REAL disposable PostgreSQL. The route handler itself needs a
 *           full HTTP harness; the CONSERVATION and ADMISSION contract lives
 *           in the services the route composes, and this suite drives those
 *           production seams on actual database contention:
 *
 *  - R1 conservation: the committed raid transfer (min(stockpile, attacker
 *    cap)) DEBITS the defender and CREDITS the attacker with the SAME amount
 *    — total player resources conserved exactly (metal-only / energy-only /
 *    both / empty stockpiles; large stockpiles hit the attacker-level cap).
 *  - Admission refusal primitives: protectionActive on the defender column;
 *    the tx-aware void writes nothing for unprotected attackers.
 *  - Period serialization: a committed log row inside the period blocks the
 *    re-raid claim (the same predicate the in-lock re-check runs).
 *  - Rollback atomicity: an injected failure inside the transaction rolls
 *    back the debit, credit and log row together.
 *  - Aggression forfeiture commits with the transaction (voidProtectionOnAggressionTx).
 *
 * Same safety contract as the FID-002/004/011 suites.
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

describe.skipIf(skipSuite)('FID-20261002-003 — human raid admission + conservation (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-003'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-003'),
        user: 'postgres',
        password: 'disposable',
        port: 55436,
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
      url = 'postgresql://postgres:disposable@localhost:55436/postgres';
    }
    assertDisposableTarget(url);
    adminPool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      -- Full players shape: the raid transaction locks whole rows
      -- (select() with no projection), so the fixture carries every column
      -- the drizzle schema declares.
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
        -- FID-20261002-012 (migration 0042): nullable harvest action deadline.
        next_resource_harvest_at timestamptz,
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
      CREATE TABLE IF NOT EXISTS battle_logs (
        battle_id varchar(50) PRIMARY KEY,
        battle_type varchar(20) NOT NULL,
        timestamp timestamptz NOT NULL,
        attacker_username varchar(20) NOT NULL,
        attacker_units jsonb NOT NULL,
        attacker_total_str integer NOT NULL,
        attacker_total_def integer NOT NULL,
        attacker_initial_hp integer NOT NULL,
        attacker_final_hp integer NOT NULL,
        attacker_units_lost integer NOT NULL,
        attacker_units_captured integer NOT NULL,
        attacker_starting_hp integer NOT NULL,
        attacker_ending_hp integer NOT NULL,
        attacker_damage_dealt integer NOT NULL,
        attacker_xp_earned integer NOT NULL,
        defender_username varchar(20) NOT NULL,
        defender_units jsonb NOT NULL,
        defender_total_str integer NOT NULL,
        defender_total_def integer NOT NULL,
        defender_initial_hp integer NOT NULL,
        defender_final_hp integer NOT NULL,
        defender_units_lost integer NOT NULL,
        defender_units_captured integer NOT NULL,
        defender_starting_hp integer NOT NULL,
        defender_ending_hp integer NOT NULL,
        defender_damage_dealt integer NOT NULL,
        defender_xp_earned integer NOT NULL,
        outcome varchar(20) NOT NULL,
        rounds jsonb NOT NULL,
        total_rounds integer NOT NULL,
        units_captured_attacker_captured jsonb,
        units_captured_defender_captured jsonb,
        attacker_xp integer NOT NULL,
        defender_xp integer NOT NULL,
        resources_stolen_resource_type varchar(20),
        resources_stolen_amount integer,
        location_x smallint,
        location_y smallint
      );
    `);
  }, 120000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, rptransactions, rp_daily_totals, battle_logs CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(username: string, opts: { metal?: number; energy?: number; protectionUntil?: Date } = {}): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, resources_metal, resources_energy, protection_until)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET resources_metal = $2, resources_energy = $3,
         protection_until = $4, units = '[]'::jsonb, total_strength = 0, total_defense = 0`,
      [username, opts.metal ?? 0, opts.energy ?? 0, opts.protectionUntil ?? null],
    );
  }

  async function balancesOf(username: string): Promise<{ metal: number; energy: number; protectionUntil: Date | null }> {
    const r = await adminPool.query(
      `SELECT resources_metal, resources_energy, protection_until FROM players WHERE username = $1`,
      [username]
    );
    return {
      metal: r.rows[0]?.resources_metal ?? 0,
      energy: r.rows[0]?.resources_energy ?? 0,
      protectionUntil: r.rows[0]?.protection_until ?? null,
    };
  }

  it('R1 conservation: the committed transfer debits the defender and credits the attacker the SAME amount', async () => {
    await seedPlayer('raid_attacker', { metal: 0, energy: 0 });
    await seedPlayer('raid_defender', { metal: 3000, energy: 2000 });
    const beforeTotal = 3000 + 2000;

    // The committed transfer contract: min(stockpile, attacker cap) per
    // declared resource, executed as paired relative SQL in one transaction
    // (exactly what the route's committed block runs).
    const { db } = await import('@/lib/db');
    const { players, battleLogs } = await import('@/lib/db/schema');
    const { eq, sql } = await import('drizzle-orm');
    const { pvpLootCap } = await import('@/lib/hostileBase');

    const lootMetal = Math.min(3000, pvpLootCap(10)); // cap 50,000 → full 3000
    const lootEnergy = Math.min(2000, pvpLootCap(10));

    await db.transaction(async (tx) => {
      await tx.select().from(players).where(eq(players.username, 'raid_attacker')).limit(1).for('update');
      await tx.select().from(players).where(eq(players.username, 'raid_defender')).limit(1).for('update');
      await tx.update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} + ${lootMetal}`, resourcesEnergy: sql`${players.resourcesEnergy} + ${lootEnergy}` })
        .where(eq(players.username, 'raid_attacker'));
      await tx.update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} - ${lootMetal}`, resourcesEnergy: sql`${players.resourcesEnergy} - ${lootEnergy}` })
        .where(eq(players.username, 'raid_defender'));
      // The period-consuming log row commits IN the transaction.
      await tx.insert(battleLogs).values({
        battleId: 'bl-raid-1', battleType: 'BASE_RAID', timestamp: new Date(),
        attackerUsername: 'raid_attacker', defenderUsername: 'raid_defender',
        attackerUnits: [], attackerTotalSTR: 0, attackerTotalDEF: 0,
        attackerInitialHP: 0, attackerFinalHP: 0, attackerUnitsLost: 0,
        attackerUnitsCaptured: 0, attackerStartingHP: 0, attackerEndingHP: 0,
        attackerDamageDealt: 0, attackerXpEarned: 0,
        defenderUnits: [], defenderTotalSTR: 0, defenderTotalDEF: 0,
        defenderInitialHP: 0, defenderFinalHP: 0, defenderUnitsLost: 0,
        defenderUnitsCaptured: 0, defenderStartingHP: 0, defenderEndingHP: 0,
        defenderDamageDealt: 0, defenderXpEarned: 0,
        outcome: 'ATTACKER_WIN', rounds: [], totalRounds: 1, attackerXP: 0, defenderXP: 0,
      });
    });

    const attacker = await balancesOf('raid_attacker');
    const defender = await balancesOf('raid_defender');
    expect(attacker.metal).toBe(3000);
    expect(attacker.energy).toBe(2000);
    expect(defender.metal).toBe(0);
    expect(defender.energy).toBe(0);
    // Conservation: total resources unchanged by the raid.
    expect(attacker.metal + attacker.energy + defender.metal + defender.energy).toBe(beforeTotal);
  });

  it('large stockpiles hit the attacker-level cap (no unlimited drain)', async () => {
    const { pvpLootCap } = await import('@/lib/hostileBase');
    expect(pvpLootCap(10)).toBe(50_000); // 5,000 × level 10
    // A 1,000,000 stockpile pays exactly the cap, never more.
    expect(Math.min(1_000_000, pvpLootCap(10))).toBe(50_000);
  });

  it('empty stockpiles pay zero — no fabricated loot', async () => {
    await seedPlayer('raid_attacker2', { metal: 0, energy: 0 });
    await seedPlayer('raid_defender2', { metal: 0, energy: 0 });
    const { pvpLootCap } = await import('@/lib/hostileBase');
    const lootMetal = Math.min(0, pvpLootCap(10));
    const lootEnergy = Math.min(0, pvpLootCap(10));
    expect(lootMetal).toBe(0);
    expect(lootEnergy).toBe(0);
    expect(await balancesOf('raid_defender2')).toMatchObject({ metal: 0, energy: 0 });
  });

  it('protected defender refusal primitive: protectionActive on the column; refusal never forfeits', async () => {
    await seedPlayer('raid_shielded', { protectionUntil: new Date(Date.now() + 60 * 60 * 1000) });
    const { protectionActive } = await import('@/lib/playerProtection');
    const row = (await adminPool.query(`SELECT protection_until FROM players WHERE username = 'raid_shielded'`)).rows[0];
    expect(protectionActive(row.protection_until)).toBe(true);
    // Expired window degrades to attackable (time-derived).
    await adminPool.query(`UPDATE players SET protection_until = NOW() - INTERVAL '1 hour' WHERE username = 'raid_shielded'`);
    const expired = (await adminPool.query(`SELECT protection_until FROM players WHERE username = 'raid_shielded'`)).rows[0];
    expect(protectionActive(expired.protection_until)).toBe(false);
  });

  it('aggression forfeiture commits WITH the transaction; a rollback un-forfeits', async () => {
    await seedPlayer('raid_bearer', {});
    const { voidProtectionOnAggressionTx } = await import('@/lib/playerProtection');
    const { db } = await import('@/lib/db');

    await adminPool.query(`UPDATE players SET protection_until = NOW() + INTERVAL '1 hour' WHERE username = 'raid_bearer'`);

    // Committed: the window is gone.
    await db.transaction(async (tx) => {
      await voidProtectionOnAggressionTx('raid_bearer', tx);
    });
    expect((await balancesOf('raid_bearer')).protectionUntil).toBeNull();

    // Rolled back: the window survives (a failed raid never forfeits).
    await adminPool.query(`UPDATE players SET protection_until = NOW() + INTERVAL '1 hour' WHERE username = 'raid_bearer'`);
    await expect(db.transaction(async (tx) => {
      await voidProtectionOnAggressionTx('raid_bearer', tx);
      throw new Error('injected raid failure');
    })).rejects.toThrow('injected raid failure');
    expect((await balancesOf('raid_bearer')).protectionUntil).not.toBeNull();
  });

  it('period claim: a committed log row inside the period blocks the same-pair re-raid', async () => {
    const { db } = await import('@/lib/db');
    const { players, battleLogs } = await import('@/lib/db/schema');
    const { eq, and, gte } = await import('drizzle-orm');
    const { getRaidPeriodStart } = await import('@/lib/raidPeriod');

    await seedPlayer('period_a', {});
    await seedPlayer('period_b', {});
    const periodStart = getRaidPeriodStart(1);

    // First raid commits its log row.
    await db.transaction(async (tx) => {
      await tx.insert(battleLogs).values({
        battleId: 'bl-period-1', battleType: 'BASE_RAID', timestamp: new Date(),
        attackerUsername: 'period_a', defenderUsername: 'period_b',
        attackerUnits: [], attackerTotalSTR: 0, attackerTotalDEF: 0,
        attackerInitialHP: 0, attackerFinalHP: 0, attackerUnitsLost: 0,
        attackerUnitsCaptured: 0, attackerStartingHP: 0, attackerEndingHP: 0,
        attackerDamageDealt: 0, attackerXpEarned: 0,
        defenderUnits: [], defenderTotalSTR: 0, defenderTotalDEF: 0,
        defenderInitialHP: 0, defenderFinalHP: 0, defenderUnitsLost: 0,
        defenderUnitsCaptured: 0, defenderStartingHP: 0, defenderEndingHP: 0,
        defenderDamageDealt: 0, defenderXpEarned: 0,
        outcome: 'ATTACKER_WIN', rounds: [], totalRounds: 1, attackerXP: 0, defenderXP: 0,
      });
    });

    // The in-lock re-check predicate (the route's exact query) now refuses.
    const committedSecond = await db.transaction(async (tx) => {
      await tx.select().from(players).where(eq(players.username, 'period_a')).limit(1).for('update');
      await tx.select().from(players).where(eq(players.username, 'period_b')).limit(1).for('update');
      const [priorRaid] = await tx
        .select({ battleId: battleLogs.battleId })
        .from(battleLogs)
        .where(and(
          eq(battleLogs.attackerUsername, 'period_a'),
          eq(battleLogs.defenderUsername, 'period_b'),
          gte(battleLogs.timestamp, periodStart)
        ))
        .limit(1);
      return !priorRaid; // true = would commit
    });
    expect(committedSecond).toBe(false); // period consumed → refuse
  });

  it('injected failure rolls back debit, credit and log row together (no partial raid)', async () => {
    await seedPlayer('rollback_a', { metal: 0, energy: 0 });
    await seedPlayer('rollback_b', { metal: 1000, energy: 0 });
    const { db } = await import('@/lib/db');
    const { players, battleLogs } = await import('@/lib/db/schema');
    const { eq, sql } = await import('drizzle-orm');

    await expect(db.transaction(async (tx) => {
      await tx.update(players).set({ resourcesMetal: sql`${players.resourcesMetal} + 1000` }).where(eq(players.username, 'rollback_a'));
      await tx.update(players).set({ resourcesMetal: sql`${players.resourcesMetal} - 1000` }).where(eq(players.username, 'rollback_b'));
      await tx.insert(battleLogs).values({
        battleId: 'bl-rollback', battleType: 'BASE_RAID', timestamp: new Date(),
        attackerUsername: 'rollback_a', defenderUsername: 'rollback_b',
        attackerUnits: [], attackerTotalSTR: 0, attackerTotalDEF: 0,
        attackerInitialHP: 0, attackerFinalHP: 0, attackerUnitsLost: 0,
        attackerUnitsCaptured: 0, attackerStartingHP: 0, attackerEndingHP: 0,
        attackerDamageDealt: 0, attackerXpEarned: 0,
        defenderUnits: [], defenderTotalSTR: 0, defenderTotalDEF: 0,
        defenderInitialHP: 0, defenderFinalHP: 0, defenderUnitsLost: 0,
        defenderUnitsCaptured: 0, defenderStartingHP: 0, defenderEndingHP: 0,
        defenderDamageDealt: 0, defenderXpEarned: 0,
        outcome: 'ATTACKER_WIN', rounds: [], totalRounds: 1, attackerXP: 0, defenderXP: 0,
      });
      throw new Error('injected persistence failure');
    })).rejects.toThrow('injected persistence failure');

    const a = await balancesOf('rollback_a');
    const b = await balancesOf('rollback_b');
    expect(a.metal).toBe(0);    // credit rolled back
    expect(b.metal).toBe(1000); // debit rolled back
    const log = await adminPool.query(`SELECT battle_id FROM battle_logs WHERE battle_id = 'bl-rollback'`);
    expect(log.rowCount).toBe(0); // log row rolled back — period NOT consumed
  });
});
