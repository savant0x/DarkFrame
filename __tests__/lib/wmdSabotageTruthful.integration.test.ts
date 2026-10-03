// @vitest-environment node
/**
 * @file __tests__/lib/wmdSabotageTruthful.integration.test.ts
 * @overview FID-20261002-008 §5 acceptance — REAL executeSabotage on a
 *           disposable PostgreSQL. The RED defect (R12): battery sabotage
 *           returned success with ZERO target writes (a hypothetical resource
 *           figure only), research had NO branch, and the missile branch
 *           fabricated metal/energy losses. These probes pin the corrected,
 *           truthful engine on real database contention:
 *
 *  - Battery sabotage: the 007 lifecycle — the battery lands in COOLDOWN with
 *    the persisted deadline extended by ceil(skill/100 × duration) from
 *    max(now, existing); returned delayDuration MATCHES the persisted delta;
 *    resourcesWasted is ZERO (time is time, not metal).
 *  - Research sabotage: currentResearchRpSpent reduced by
 *    min(spent, floor(required × skill/100 × 0.25)); the progress column
 *    rewritten from remaining/required; completed techs and lifetime RP spent
 *    untouched; progressLost = the ACTUAL RP destroyed.
 *  - Truthful no-effect: no active research / zero RP / DAMAGED battery →
 *    success roll with zero applied delta + explicit noEffectReason — and the
 *    operation record says so.
 *  - Concurrency: two concurrent battery sabotages SERIALIZE under the row
 *    lock and their cooldown extensions COMPOSE (no overwritten deadline);
 *    sabotage racing a research RP contribution ends with the contribution
 *    and the destruction BOTH applied (48 = 50 + 10 − 12 under either order).
 *  - Rollback: a persistence failure inside the impact transaction rolls back
 *    the target mutation, the record and the spy exposure together.
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002..007):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL is REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/wmdSabotageTruthful.integration.test.ts
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
    throw new Error('Disposable-database URL looks like a PRODUCTION target — refusing.');
  }
}
if (EXTERNAL_URL) assertDisposableTarget(EXTERNAL_URL);

const skipSuite = !EXTERNAL_URL && !AUTO_PROVISION;

// Deterministic rolls (Math.random = 0.5): success roll 0.5 < successChance
// (skill 100: MISSILE 0.8 / BATTERY 0.7 / RESEARCH 0.6) succeeds; detection
// 0.5 < clamp(base − stealth/200) with stealth 200 → 0.1 → never detected.
let idCounter = 0;
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    generateId: () => `testid-${String(++idCounter).padStart(6, '0')}`,
  };
});
let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

describe.skipIf(skipSuite)('FID-20261002-008 — truthful sabotage effects (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-008'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-008'),
        user: 'postgres',
        password: 'disposable',
        port: 55440,
        persistent: false,
        // Force a UTF8 cluster: the Windows default (locale-derived WIN1252)
        // cannot store notification content that carries non-ASCII.
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
      url = 'postgresql://postgres:disposable@localhost:55440/postgres?client_encoding=UTF8';
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
        resources_metal integer NOT NULL DEFAULT 0,
        resources_energy integer NOT NULL DEFAULT 0,
        units jsonb NOT NULL DEFAULT '[]',
        total_strength integer NOT NULL DEFAULT 0,
        total_defense integer NOT NULL DEFAULT 0,
        inventory_items jsonb NOT NULL DEFAULT '[]',
        protection_until timestamptz,
        research_points integer NOT NULL DEFAULT 0,
        rp_history jsonb,
        xp integer NOT NULL DEFAULT 0,
        level integer NOT NULL DEFAULT 10,
        vip smallint DEFAULT 0,
        vip_expiration timestamptz,
        unlocked_tiers jsonb NOT NULL DEFAULT '[]',
        unlocked_techs jsonb,
        clan_id varchar(24),
        clan_name varchar(30),
        created_at timestamptz DEFAULT NOW()
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
      CREATE TABLE IF NOT EXISTS clans (
        id varchar(24) PRIMARY KEY,
        name varchar(30) NOT NULL,
        tag varchar(6) NOT NULL,
        description text NOT NULL DEFAULT '',
        leader_id varchar(20) NOT NULL,
        members jsonb NOT NULL DEFAULT '[]'::jsonb,
        max_members integer NOT NULL DEFAULT 20
      );
      CREATE TABLE IF NOT EXISTS wmd_spies (
        id varchar(24) PRIMARY KEY,
        spy_id varchar(50) NOT NULL,
        owner_id varchar(20) NOT NULL,
        owner_username varchar(50) NOT NULL,
        clan_id varchar(24),
        codename varchar(50) NOT NULL,
        rank varchar(20) NOT NULL DEFAULT 'RECRUIT',
        experience integer NOT NULL DEFAULT 0,
        specialization varchar(20) NOT NULL DEFAULT 'INFILTRATOR',
        status varchar(20) NOT NULL DEFAULT 'AVAILABLE',
        current_mission_id varchar(50),
        mission_history jsonb DEFAULT '[]'::jsonb,
        skills_stealth smallint NOT NULL DEFAULT 0,
        skills_hacking smallint NOT NULL DEFAULT 0,
        skills_sabotage smallint NOT NULL DEFAULT 0,
        skills_intelligence smallint NOT NULL DEFAULT 0,
        last_mission_at timestamptz,
        recruited_at timestamptz NOT NULL DEFAULT NOW(),
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS wmd_spies_spy_id_unique ON wmd_spies (spy_id);
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
      CREATE TABLE IF NOT EXISTS player_research (
        id varchar(24) PRIMARY KEY,
        player_id varchar(20) NOT NULL,
        player_username varchar(20) NOT NULL,
        clan_id varchar(24),
        completed_techs jsonb DEFAULT '[]'::jsonb,
        available_techs jsonb DEFAULT '[]'::jsonb,
        locked_techs jsonb DEFAULT '[]'::jsonb,
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
        clan_research_bonus numeric(5,2) DEFAULT '0',
        updated_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS player_research_player_id_unique ON player_research (player_id);
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
      CREATE TABLE IF NOT EXISTS wmd_sabotage_operations (
        id varchar(24) PRIMARY KEY,
        sabotage_id varchar(50) NOT NULL,
        spy_id varchar(50) NOT NULL,
        spy_codename varchar(50),
        operator_id varchar(20) NOT NULL,
        operator_username varchar(50) NOT NULL,
        target_type varchar(30) NOT NULL,
        target_id varchar(50) NOT NULL,
        target_player_id varchar(20) NOT NULL,
        target_username varchar(50),
        success smallint NOT NULL DEFAULT 0,
        detected smallint NOT NULL DEFAULT 0,
        damage_dealt jsonb,
        executed_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS wmd_sabotage_sabotage_id_unique ON wmd_sabotage_operations (sabotage_id);
      CREATE TABLE IF NOT EXISTS wmd_notifications (
        id varchar(24) PRIMARY KEY,
        notification_id varchar(50) NOT NULL,
        event_type varchar(40) NOT NULL,
        priority varchar(20) NOT NULL,
        scope varchar(20) NOT NULL,
        source_id varchar(50) NOT NULL,
        source_name varchar(50) NOT NULL,
        target_id varchar(50),
        target_name varchar(50),
        title varchar(200) NOT NULL,
        message text NOT NULL,
        details jsonb,
        view_count integer NOT NULL DEFAULT 0,
        viewed_by jsonb DEFAULT '[]'::jsonb,
        broadcast_at timestamptz,
        created_at timestamptz NOT NULL
      );
    `);

    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  }, 120000);

  afterAll(async () => {
    randomSpy?.mockRestore();
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, rptransactions, rp_daily_totals, clans, wmd_spies, wmd_defense_batteries, player_research, missiles, wmd_sabotage_operations, wmd_notifications CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(username: string, protectionUntil: Date | null = null): Promise<void> {
    await adminPool.query(
      `INSERT INTO players (username, protection_until) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET protection_until = $2`,
      [username, protectionUntil],
    );
  }

  async function seedClan(id: string, leaderUsername: string): Promise<void> {
    await adminPool.query(
      `INSERT INTO clans (id, name, tag, leader_id) VALUES ($1, $2, 'TAG', $3)
       ON CONFLICT (id) DO UPDATE SET leader_id = $3`,
      [id, `Clan-${id}`, leaderUsername],
    );
  }

  async function seedSpy(spyId: string, owner: string): Promise<void> {
    await adminPool.query(
      `INSERT INTO wmd_spies (id, spy_id, owner_id, owner_username, codename, status, skills_stealth, skills_sabotage)
       VALUES ($1, $2, $3, $3, 'SHADOW', 'AVAILABLE', 200, 100)
       ON CONFLICT (id) DO UPDATE SET status = 'AVAILABLE', skills_stealth = 200, skills_sabotage = 100`,
      [`spyrow-${spyId}`, spyId, owner],
    );
  }

  async function seedBattery(
    id: string,
    batteryId: string,
    clanId: string,
    opts: { status?: string; duration?: number; cooldownUntil?: Date | null } = {}
  ): Promise<void> {
    await adminPool.query(
      `INSERT INTO wmd_defense_batteries (id, clan_id, status, intercept_chance, cooldown_duration, cooldown_until, battery_id)
       VALUES ($1, $2, $3, '0.60', $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET status = $3, cooldown_duration = $4, cooldown_until = $5`,
      [id, clanId, opts.status ?? 'IDLE', opts.duration ?? 600000, opts.cooldownUntil ?? null, batteryId],
    );
  }

  async function seedResearch(
    id: string,
    playerId: string,
    opts: { techId?: string | null; spent?: number | null; required?: number | null; completed?: string[] } = {}
  ): Promise<void> {
    await adminPool.query(
      `INSERT INTO player_research (id, player_id, player_username, completed_techs, current_research_tech_id,
         current_research_rp_spent, current_research_rp_required, current_research_progress, total_rp_spent)
       VALUES ($1, $2, $2, $3::jsonb, $4, $5, $6, $7, 500)
       ON CONFLICT (id) DO UPDATE SET completed_techs = $3::jsonb, current_research_tech_id = $4,
         current_research_rp_spent = $5, current_research_rp_required = $6, current_research_progress = $7, total_rp_spent = 500`,
      [id, playerId, JSON.stringify(opts.completed ?? []), opts.techId ?? null,
       opts.spent ?? null, opts.required ?? null,
       opts.spent && opts.required ? String(((opts.spent / opts.required) * 100).toFixed(2)) : null],
    );
  }

  async function researchRow(id: string): Promise<Record<string, unknown>> {
    const r = await adminPool.query(
      `SELECT current_research_tech_id, current_research_rp_spent, current_research_rp_required,
        current_research_progress, completed_techs, total_rp_spent, total_techs_unlocked FROM player_research WHERE id = $1`,
      [id]
    );
    return r.rows[0];
  }

  async function batteryRow(id: string): Promise<Record<string, unknown>> {
    const r = await adminPool.query(
      `SELECT status, cooldown_until, cooldown_duration FROM wmd_defense_batteries WHERE id = $1`,
      [id]
    );
    return r.rows[0];
  }

  it('battery sabotage: the 007 lifecycle lands the battery in COOLDOWN with the persisted extension; returned delayDuration matches; ZERO invented resource loss', async () => {
    await seedPlayer('sab_leader');
    await seedClan('CLANSAB1', 'sab_leader');
    await seedSpy('sab_bat', 'sab_leader');
    await seedBattery('bat0000000000000S1', 'battery-S1', 'CLANSAB1', { duration: 600000 });

    const { executeSabotage } = await import('@/lib/wmd/spyService');
    const result = await executeSabotage('sab_bat', 'DEFENSE_BATTERY', 'battery-S1', 'sab_leader');

    // Skill 100 → success roll 0.5 < 0.7 succeeds; detection 0.5 < 0.1 fails.
    expect(result.success).toBe(true);
    const damage = result.damage!;
    expect(damage.noEffectReason).toBeUndefined();
    // ceil(100/100 × 600000) = 600000 — recorded as TIME.
    expect(damage.delayDuration).toBe(600000);
    expect(damage.progressLost).toBe(0);
    expect(damage.resourcesWasted).toEqual({ metal: 0, energy: 0 }); // R12's invented figure is gone

    const battery = await batteryRow('bat0000000000000S1');
    expect(battery.status).toBe('COOLDOWN');
    const persisted = new Date(battery.cooldown_until as string).getTime();
    const startedAt = new Date(damage.executedAt).getTime();
    // deadline − shot time = the SAME extension the response reported.
    expect(persisted - startedAt).toBe(600000);

    // The operation record carries the committed, truthful damage.
    const record = await adminPool.query(
      `SELECT success, damage_dealt FROM wmd_sabotage_operations WHERE spy_id = 'sab_bat' ORDER BY executed_at DESC LIMIT 1`
    );
    expect(record.rows[0].success).toBe(1);
    expect(record.rows[0].damage_dealt.delayDuration).toBe(600000);
  });

  it('research sabotage: ACTUAL RP destroyed, progress rewritten from remaining/required, completed techs and lifetime RP untouched', async () => {
    await seedPlayer('sab_victim');
    // The operator OWNS the spy; the victim is derived FROM the research row.
    await seedPlayer('sab_operator');
    await seedSpy('sab_res', 'sab_operator');
    await seedResearch('res0000000000000S1', 'sab_victim', { techId: 'tech_nukes', spent: 50, required: 100, completed: ['tech_basic'] });

    const { executeSabotage } = await import('@/lib/wmd/spyService');
    const result = await executeSabotage('sab_res', 'RESEARCH', 'res0000000000000S1', 'sab_operator');

    expect(result.success, result.message).toBe(true);
    const damage = result.damage!;
    expect(damage.noEffectReason).toBeUndefined();
    // floor(100 × 1.0 × 0.25) = 25 RP destroyed (spent 50 → remaining 25).
    expect(damage.progressLost).toBe(25);
    expect(damage.delayDuration).toBe(0);
    expect(damage.resourcesWasted).toEqual({ metal: 0, energy: 0 }); // RP is RP, not metal

    const row = await researchRow('res0000000000000S1');
    expect(row.current_research_rp_spent).toBe(25);
    expect(Number(row.current_research_progress)).toBe(25); // remaining/required
    expect(row.completed_techs).toEqual(['tech_basic']); // never revoked
    expect(row.total_rp_spent).toBe(500); // lifetime spend untouched
    expect(row.current_research_tech_id).toBe('tech_nukes'); // still active, just rolled back
  });

  it('truthful no-effect: no active research, zero RP, DAMAGED battery — zero deltas with explicit reasons, recorded truthfully', async () => {
    await seedPlayer('ne_owner');
    await seedPlayer('ne_owner2');
    await seedPlayer('ne_operator');
    await seedSpy('sab_ne1', 'ne_operator');
    await seedSpy('sab_ne2', 'ne_operator');
    await seedSpy('sab_ne3', 'ne_operator');
    await seedResearch('res0000000000000N1', 'ne_owner', { techId: null, spent: null, required: null });
    await seedResearch('res0000000000000N2', 'ne_owner2', { techId: 'tech_x', spent: 0, required: 100 });
    await seedBattery('bat0000000000000N3', 'battery-N3', 'CLANSAB1', { status: 'DAMAGED', duration: 600000 });

    const { executeSabotage } = await import('@/lib/wmd/spyService');

    const noResearch = await executeSabotage('sab_ne1', 'RESEARCH', 'res0000000000000N1', 'ne_operator');
    expect(noResearch.success).toBe(true);
    expect(noResearch.damage!.noEffectReason).toContain('no active research');
    expect(noResearch.damage!.progressLost).toBe(0);

    const zeroRp = await executeSabotage('sab_ne2', 'RESEARCH', 'res0000000000000N2', 'ne_operator');
    expect(zeroRp.success).toBe(true);
    expect(zeroRp.damage!.noEffectReason).toContain('no destructible RP progress');
    expect(zeroRp.damage!.progressLost).toBe(0);

    const damaged = await executeSabotage('sab_ne3', 'DEFENSE_BATTERY', 'battery-N3', 'ne_operator');
    expect(damaged.success).toBe(true);
    expect(damaged.damage!.noEffectReason).toContain('unavailable');
    expect(damaged.damage!.delayDuration).toBe(0);

    // All three records persist the truthful zero-delta + reason.
    const records = await adminPool.query(
      `SELECT damage_dealt FROM wmd_sabotage_operations WHERE spy_id LIKE 'sab_ne%' ORDER BY executed_at`
    );
    expect(records.rows).toHaveLength(3);
    for (const r of records.rows) {
      expect(r.damage_dealt.noEffectReason).toBeTruthy();
    }
    // The DAMAGED battery was NOT moved into COOLDOWN by the no-effect roll.
    expect((await batteryRow('bat0000000000000N3')).status).toBe('DAMAGED');
  });

  it('concurrency: two battery sabotages SERIALIZE under the row lock and their cooldown extensions COMPOSE', async () => {
    await seedPlayer('comp_leader');
    await seedClan('CLANSAB2', 'comp_leader');
    await seedSpy('sab_c1', 'comp_leader');
    await seedSpy('sab_c2', 'comp_leader');
    await seedBattery('bat0000000000000C1', 'battery-C1', 'CLANSAB2', { duration: 600000 });

    const { executeSabotage } = await import('@/lib/wmd/spyService');
    const [a, b] = await Promise.all([
      executeSabotage('sab_c1', 'DEFENSE_BATTERY', 'battery-C1', 'comp_leader'),
      executeSabotage('sab_c2', 'DEFENSE_BATTERY', 'battery-C1', 'comp_leader'),
    ]);

    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    const start = Math.min(
      new Date(a.damage!.executedAt).getTime(),
      new Date(b.damage!.executedAt).getTime()
    );
    const battery = await batteryRow('bat0000000000000C1');
    expect(battery.status).toBe('COOLDOWN');
    // The second sabotage read the FIRST's committed deadline (max(now, T1))
    // and extended FROM it — extensions compose, never overwrite (2×600000).
    const persisted = new Date(battery.cooldown_until as string).getTime();
    expect(persisted - start).toBeGreaterThanOrEqual(1199000);
    expect(persisted - start).toBeLessThanOrEqual(1201000);
  });

  it('sabotage racing a research RP contribution: the 002 row lock keeps BOTH effects — no lost update, no lost unlock (50+10−25 = 35 under either order)', async () => {
    await adminPool.query(
      `INSERT INTO players (username, research_points) VALUES ('race_owner', 10)
       ON CONFLICT (username) DO UPDATE SET research_points = 10`
    );
    await seedSpy('sab_race', 'race_owner');
    await seedResearch('res0000000000000R1', 'race_owner', { techId: 'tech_r', spent: 50, required: 100 });

    const { executeSabotage } = await import('@/lib/wmd/spyService');
    const { spendRPOnResearch } = await import('@/lib/wmd/researchService');

    // Contribution (+10 RP from the player's wallet) and sabotage
    // (−floor(100×1.0×0.25) = −25 RP) race. Both lock the SAME player_research
    // row, so they serialize; each computes from the other's committed state →
    // 50 + 10 − 25 = 35 under EITHER order.
    await Promise.all([
      executeSabotage('sab_race', 'RESEARCH', 'res0000000000000R1', 'race_owner'),
      spendRPOnResearch('race_owner', 10),
    ]);

    const row = await researchRow('res0000000000000R1');
    expect(row.current_research_rp_spent).toBe(35);
    expect(Number(row.current_research_progress)).toBe(35);
    expect(row.current_research_tech_id).toBe('tech_r'); // still in progress
    expect(row.completed_techs).toEqual([]); // no lost unlock, no phantom unlock
  });

  it('failure injection: a persistence failure rolls back the target mutation, the record AND the spy exposure together', async () => {
    await seedPlayer('fail_leader');
    await seedClan('CLANSAB3', 'fail_leader');
    await seedSpy('sab_fail', 'fail_leader');
    await seedBattery('bat0000000000000F1', 'battery-F1', 'CLANSAB3', { duration: 600000 });

    const { executeSabotage } = await import('@/lib/wmd/spyService');

    // Inject: the operation-record insert cannot persist (table gone) — the
    // WHOLE impact transaction (battery deadline + record + exposure) must
    // roll back, and the service must NOT report success-with-no-write.
    await adminPool.query(`DROP TABLE wmd_sabotage_operations CASCADE`);
    let result: Awaited<ReturnType<typeof executeSabotage>>;
    try {
      result = await executeSabotage('sab_fail', 'DEFENSE_BATTERY', 'battery-F1', 'fail_leader');
    } finally {
      await adminPool.query(`
        CREATE TABLE IF NOT EXISTS wmd_sabotage_operations (
          id varchar(24) PRIMARY KEY,
          sabotage_id varchar(50) NOT NULL,
          spy_id varchar(50) NOT NULL,
          spy_codename varchar(50),
          operator_id varchar(20) NOT NULL,
          operator_username varchar(50) NOT NULL,
          target_type varchar(30) NOT NULL,
          target_id varchar(50) NOT NULL,
          target_player_id varchar(20) NOT NULL,
          target_username varchar(50),
          success smallint NOT NULL DEFAULT 0,
          detected smallint NOT NULL DEFAULT 0,
          damage_dealt jsonb,
          executed_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL
        )`);
      await adminPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS wmd_sabotage_sabotage_id_unique ON wmd_sabotage_operations (sabotage_id)`);
    }

    expect(result.success).toBe(false);
    expect(result.message).toBe('Internal server error'); // the failure propagated, not a fake success
    // The battery mutation rolled back with the failed insert.
    const battery = await batteryRow('bat0000000000000F1');
    expect(battery.status).toBe('IDLE');
    expect(battery.cooldown_until).toBeNull();
    // No record, no exposure.
    const records = await adminPool.query(`SELECT count(*)::int AS c FROM wmd_sabotage_operations`);
    expect(records.rows[0].c).toBe(0);
    const spy = await adminPool.query(`SELECT status FROM wmd_spies WHERE spy_id = 'sab_fail'`);
    expect(spy.rows[0].status).toBe('AVAILABLE');
  });

});
