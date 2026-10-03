// @vitest-environment node
/**
 * @file __tests__/api/combat/combatAttrition.integration.test.ts
 * @overview FID-20261002-013 §5 acceptance — the attrition pipeline's
 *           DB-facing seams on a REAL disposable PostgreSQL. The resolver's
 *           pure arithmetic is pinned exactly in
 *           __tests__/lib/battleResolution.test.ts; THIS suite drives the
 *           production seams the routes compose, against actual database
 *           contention (no module mocks — the 012 effect seam's batch
 *           side-row read hits the real players table):
 *
 *  - Attrition conservation on a real resolved battle: per-round loss sums
 *    equal the participant totals, survivorCount = initial copies −
 *    casualties, casualtiesByType sums equal the totals, final HP ≥ 0.
 *  - Persistence seam: persistBattleLog writes the full-fidelity row and
 *    getPlayerCombatHistory reads it back with the tallies intact.
 *  - Persisted jsonb conservation: the stored rounds' per-round loss sums
 *    equal the persisted column totals, and jsonb units-length − units_lost
 *    equals the in-memory survivorCount (the persisted identity; survivorCount
 *    itself lives on the participant, not the column set).
 *  - Terminal precedence end-to-end: a kill landing exactly ON round 100
 *    resolves ATTACKER_WIN and persists with total_rounds = 100.
 *  - Human-combat wiring (§5.5): with real players rows (the same rows the
 *    infantry service derives its trusted context from), the frozen
 *    powerMultiplier band executes on effective STR/DEF — the with-context
 *    strike is strictly smaller, without mocks in the chain.
 *  - The saved-army floor persists through a REAL transaction
 *    (applyDefenderCasualtiesWithFloorTx): capped casualties ≤ battle
 *    casualties, surviving pool ≥ 25% of the pre-battle pool, DB units and
 *    recomputed totals written.
 *
 * Same safety contract as the FID-002/003/004/011 suites. Port 55444
 * (55436/55441–55443 are taken by the earlier harnesses).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Unit, PlayerUnit, BattleLog } from '@/types/game.types';
import { BattleType, BattleOutcome } from '@/types';

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

describe.skipIf(skipSuite)('FID-20261002-013 — combat attrition terminal outcomes + army roles (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-013'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-013'),
        user: 'postgres',
        password: 'disposable',
        port: 55444,
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
      url = 'postgresql://postgres:disposable@localhost:55444/postgres';
    }
    assertDisposableTarget(url);
    adminPool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      -- Full players shape: resolveBattle's effect seam reads real side rows
      -- and the floor helper locks whole rows (select() with no projection),
      -- so the fixture carries every column the drizzle schema declares.
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
      await adminPool.query(`DROP TABLE IF EXISTS players, battle_logs CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(username: string, opts: { units?: PlayerUnit[]; unlockedTechs?: string[] | null } = {}): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, units, unlocked_techs)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (username) DO UPDATE SET units = $2::jsonb, unlocked_techs = $3::jsonb`,
      [username, JSON.stringify(opts.units ?? []), JSON.stringify(opts.unlockedTechs ?? null)],
    );
  }

  function unitArmy(type: string, count: number, strength: number, defense: number, owner: string): Unit[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `${type}-${owner}-${i}`,
      type: type as Unit['type'],
      strength,
      defense,
      producedAt: { x: 0, y: 0 },
      producedDate: new Date(),
      owner,
    })) as unknown as Unit[];
  }

  function playerUnits(type: string, quantity: number, strength: number, defense: number): PlayerUnit[] {
    return [{
      id: `${type}-pu`,
      unitId: `${type}-pu`,
      unitType: type as PlayerUnit['unitType'],
      name: type,
      category: strength >= defense ? 'STR' : 'DEF',
      rarity: 'common',
      strength,
      defense,
      quantity,
      producedAt: { x: 0, y: 0 },
      producedDate: new Date('2026-01-01'),
    } as unknown as PlayerUnit];
  }

  const BALANCED = {
    ratio: 1.0, status: 'BALANCED' as const, powerMultiplier: 1.0,
    damageTakenMultiplier: 1.0, damageDealtMultiplier: 1.0,
    gatheringMultiplier: 1.0, slotRegenMultiplier: 1.0,
    effectivePower: 0, warnings: [], bonuses: [], recommendation: '',
  };

  it('attrition conservation on a REAL resolved battle: round sums, survivorCount, tallies, HP bounds', async () => {
    await seedPlayer('attr_atk', { unlockedTechs: null });
    await seedPlayer('attr_def', { unlockedTechs: null });

    const attackerUnits = [...unitArmy('T1_Rifleman', 40, 100, 0, 'attr_atk'), ...unitArmy('T2_Grenadier', 10, 200, 0, 'attr_atk')];
    const defenderUnits = [...unitArmy('T1_Scout', 5, 0, 100, 'attr_def'), ...unitArmy('T1_Militia', 6, 90, 0, 'attr_def')];
    const log = await (await import('@/lib/battleService')).resolveBattle(
      attackerUnits, defenderUnits, 'attr_atk', 'attr_def', BattleType.BaseRaid, { x: 1, y: 2 },
      { attackerLevel: 10, defenderLevel: 10, applyCasualties: false },
    );

    // §5.4 invariants — the attrition accounting on the real engine path.
    expect(log.rounds.reduce((s, r) => s + r.attackerUnitsLost, 0)).toBe(log.attacker.unitsLost);
    expect(log.rounds.reduce((s, r) => s + r.defenderUnitsLost, 0)).toBe(log.defender.unitsLost);
    expect(log.attacker.survivorCount).toBe(attackerUnits.length - log.attacker.unitsLost);
    expect(log.defender.survivorCount).toBe(defenderUnits.length - log.defender.unitsLost);
    const tallySum = Object.values(log.attacker.casualtiesByType ?? {}).reduce((s, n) => s + (n ?? 0), 0);
    expect(tallySum).toBe(log.attacker.unitsLost);
    const defTallySum = Object.values(log.defender.casualtiesByType ?? {}).reduce((s, n) => s + (n ?? 0), 0);
    expect(defTallySum).toBe(log.defender.unitsLost);
    expect(log.attacker.finalHP).toBeGreaterThanOrEqual(0);
    expect(log.defender.finalHP).toBeGreaterThanOrEqual(0);
    expect(log.attacker.initialHP).toBe(40 * 100 + 10 * 200);
    expect(log.defender.initialHP).toBe(5 * 100 + 6 * 90);
  });

  it('persistBattleLog writes the full-fidelity row and getPlayerCombatHistory reads it back', async () => {
    await seedPlayer('persist_atk', { unlockedTechs: null });
    await seedPlayer('persist_def', { unlockedTechs: null });

    const { resolveBattle, persistBattleLog, getPlayerCombatHistory } = await import('@/lib/battleService');
    const log = await resolveBattle(
      unitArmy('T5_Titan', 20, 5000, 0, 'persist_atk'),
      unitArmy('T1_Scout', 4, 0, 5, 'persist_def'),
      'persist_atk', 'persist_def', BattleType.BaseRaid, { x: 3, y: 4 },
      { attackerLevel: 10, defenderLevel: 10, applyCasualties: false },
    );
    await persistBattleLog(log);

    const rows = await adminPool.query(
      `SELECT total_rounds, outcome, attacker_units_lost, defender_units_lost, rounds
       FROM battle_logs WHERE battle_id = $1`, [log.battleId],
    );
    expect(rows.rowCount).toBe(1);
    expect(Number(rows.rows[0].total_rounds)).toBe(log.totalRounds);
    expect(rows.rows[0].outcome).toBe(log.outcome);
    expect(Number(rows.rows[0].attacker_units_lost)).toBe(log.attacker.unitsLost);
    expect(Number(rows.rows[0].defender_units_lost)).toBe(log.defender.unitsLost);

    // The read-back seam returns the same battle with the round array intact.
    const history = await getPlayerCombatHistory('persist_atk', 10);
    const readBack = history.find((b) => b.battleId === log.battleId);
    expect(readBack).toBeDefined();
    expect(readBack!.rounds.length).toBe(log.rounds.length);
    expect(readBack!.defender.unitsLost).toBe(log.defender.unitsLost);
  });

  it('persisted jsonb rounds conserve the attrition truth: per-round sums and the units − lost identity', async () => {
    await seedPlayer('jsonb_atk', { unlockedTechs: null });
    await seedPlayer('jsonb_def', { unlockedTechs: null });

    const { resolveBattle, persistBattleLog } = await import('@/lib/battleService');
    const log = await resolveBattle(
      unitArmy('T1_Rifleman', 6, 120, 10, 'jsonb_atk'),
      unitArmy('T1_Scout', 4, 0, 40, 'jsonb_def'),
      'jsonb_atk', 'jsonb_def', BattleType.BaseRaid, { x: 5, y: 6 },
      { attackerLevel: 10, defenderLevel: 10, applyCasualties: false },
    );
    await persistBattleLog(log);

    const row = (await adminPool.query(
      `SELECT attacker_units, defender_units, attacker_units_lost, defender_units_lost,
              attacker_final_hp, defender_final_hp, total_rounds, rounds
       FROM battle_logs WHERE battle_id = $1`, [log.battleId],
    )).rows[0];
    expect(row).toBeDefined();

    // The per-round losses survive the jsonb round-trip and still sum to the
    // persisted column totals — no hidden wipe casualties in the stored rows.
    const rounds = row.rounds as Array<{ attackerUnitsLost: number; defenderUnitsLost: number }>;
    expect(rounds).toHaveLength(log.totalRounds);
    expect(rounds.reduce((s, r) => s + r.attackerUnitsLost, 0)).toBe(Number(row.attacker_units_lost));
    expect(rounds.reduce((s, r) => s + r.defenderUnitsLost, 0)).toBe(Number(row.defender_units_lost));

    // The persisted conservation identity: brought units − losses = survivors
    // (survivorCount lives on the participant, not the column set).
    expect((row.attacker_units as Unit[]).length - Number(row.attacker_units_lost)).toBe(log.attacker.survivorCount);
    expect((row.defender_units as Unit[]).length - Number(row.defender_units_lost)).toBe(log.defender.survivorCount);

    expect(Number(row.attacker_final_hp)).toBe(log.attacker.finalHP);
    expect(Number(row.defender_final_hp)).toBe(log.defender.finalHP);
  });

  it('terminal precedence end-to-end: a kill ON round 100 resolves ATTACKER_WIN and persists total_rounds = 100', async () => {
    await seedPlayer('cap_atk', { unlockedTechs: null });
    await seedPlayer('cap_def', { unlockedTechs: null });

    const { resolveBattle, persistBattleLog } = await import('@/lib/battleService');
    // Single-copy duel pinned BALANCED: strike floor(457 − 895/2) = 9/round →
    // pool 895 dies exactly on round 100 (the R6 round-100-kill defect shape).
    const log = await resolveBattle(
      unitArmy('T1_Rifleman', 1, 457, 65478, 'cap_atk'),
      unitArmy('T1_Scout', 1, 0, 895, 'cap_def'),
      'cap_atk', 'cap_def', BattleType.BaseRaid, undefined,
      { attackerLevel: 1, defenderLevel: 1, attackerBalance: BALANCED, defenderBalance: BALANCED, applyCasualties: false },
    );
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.totalRounds).toBe(100);
    expect(log.defender.unitsLost).toBe(1);
    expect(log.attacker.survivorCount).toBe(1);

    await persistBattleLog(log);
    const row = await adminPool.query(
      `SELECT total_rounds, outcome FROM battle_logs WHERE battle_id = $1`, [log.battleId],
    );
    expect(row.rowCount).toBe(1);
    expect(Number(row.rows[0].total_rounds)).toBe(100);
    expect(row.rows[0].outcome).toBe('ATTACKER_WIN');
  });

  it('human-combat context executes on REAL rows: the power band shrinks the strike (no mocks in the chain)', async () => {
    // Two human players rows (is_bot 0, no techs) — the same rows the
    // infantry service derives its trusted context from. Attacker 10×(100,0)
    // is raw-CRITICAL (power ×0.5); the with-context strike must be strictly
    // smaller because the frozen powerMultiplier now joins effective STR.
    await seedPlayer('human_atk', { unlockedTechs: null });
    await seedPlayer('human_def', { unlockedTechs: null });

    const { resolveBattle } = await import('@/lib/battleService');
    const atk = unitArmy('T1_Rifleman', 10, 100, 0, 'human_atk');
    const def = unitArmy('T1_Scout', 3, 0, 45, 'human_def');
    const base = { attackerLevel: 1, defenderLevel: 1, applyCasualties: false as const };

    const neutral = await resolveBattle(atk, def, 'human_atk', 'human_def', BattleType.Infantry, undefined, { ...base });
    const human = await resolveBattle(atk, def, 'human_atk', 'human_def', BattleType.Infantry, undefined, {
      ...base, humanCombat: { attackerIsHuman: true, defenderIsHuman: true },
    });

    // CRITICAL ×0.5 on BOTH human sides' axes (both rows are human, the
    // infantry-service derivation): attacker STR 1000→500, defender DEF
    // 135→67 → 969 (pre-013 seam) → 484 — the four-cell pin's both-human cell.
    expect(neutral.rounds[0].attackerDamage).toBe(969);
    expect(human.rounds[0].attackerDamage).toBe(484);
    expect(human.rounds[0].attackerDamage).toBeLessThan(neutral.rounds[0].attackerDamage);
  });

  it('saved-army floor persists through a REAL transaction: capped casualties, pool floor holds, DB units + totals written', async () => {
    // Defender army: 10×(20,10) + 10×(10,0) → pool 400; floor allows killing
    // at most 300 of pool. The battle log reports more deaths than the floor
    // permits (the route's §5.4 label condition).
    const defenderUnits: PlayerUnit[] = [...playerUnits('T1_Rifleman', 10, 20, 10), ...playerUnits('T1_Militia', 10, 10, 0)];
    await seedPlayer('floor_atk', { unlockedTechs: null });
    await seedPlayer('floor_def', { units: defenderUnits, unlockedTechs: null });
    const preBattlePool = 10 * 30 + 10 * 10;

    const { resolveBattle, applyDefenderCasualtiesWithFloorTx } = await import('@/lib/battleService');
    const { db } = await import('@/lib/db');
    const { players } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    // An overwhelming raider wipes the defender's pool in battle.
    const battleLog: BattleLog = await resolveBattle(
      unitArmy('T5_Titan', 30, 5000, 0, 'floor_atk'),
      defenderUnits.flatMap((pu) => Array.from({ length: pu.quantity }, (_, i) => ({
        id: `${pu.unitType}-${i}`, type: pu.unitType as Unit['type'], strength: pu.strength,
        defense: pu.defense, producedAt: { x: 0, y: 0 }, producedDate: new Date(), owner: 'floor_def',
      })) as unknown as Unit[]),
      'floor_atk', 'floor_def', BattleType.BaseRaid, undefined,
      { attackerLevel: 10, defenderLevel: 10, applyCasualties: false },
    );
    expect(battleLog.defender.unitsLost).toBe(20); // annihilated in battle
    expect(battleLog.defender.casualtiesByType).toBeDefined();

    // The route's committed path: the floor caps what PERSISTS, in-lock.
    const floorResult = await db.transaction(async (tx) => {
      await tx.select().from(players).where(eq(players.username, 'floor_def')).limit(1).for('update');
      return applyDefenderCasualtiesWithFloorTx(battleLog, preBattlePool, tx);
    });

    // The route's label condition: battle truth vs saved-army rule differ.
    expect(floorResult.unitsLost).toBeLessThan(battleLog.defender.unitsLost);
    // Surviving pool never drops below 25% of the pre-battle pool.
    const survived = await adminPool.query(
      `SELECT units, total_strength, total_defense FROM players WHERE username = 'floor_def'`,
    );
    const finalUnits = survived.rows[0].units as PlayerUnit[];
    const survivingPool = finalUnits.reduce((s, pu) => s + ((pu.strength || 0) + (pu.defense || 0)) * (pu.quantity || 0), 0);
    expect(survivingPool).toBeGreaterThanOrEqual(preBattlePool * 0.25);
    expect(survivingPool).toBe(100); // exactly the floor: 300 of pool removed
    // DB totals recomputed from the persisted army.
    expect(Number(survived.rows[0].total_strength)).toBe(finalUnits.reduce((s, pu) => s + (pu.strength || 0) * (pu.quantity || 0), 0));
    expect(Number(survived.rows[0].total_defense)).toBe(finalUnits.reduce((s, pu) => s + (pu.defense || 0) * (pu.quantity || 0), 0));
    // The capped tally is what the route re-stamps onto the log.
    const cappedSum = Object.values(floorResult.casualtiesByType).reduce((s, n) => s + (n ?? 0), 0);
    expect(cappedSum).toBe(floorResult.unitsLost);
  });
});
