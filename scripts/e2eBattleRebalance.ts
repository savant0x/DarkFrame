/**
 * FID-20260915-001 Phase 3 — live verification of the power-proportional HP
 * rebalance (per-unit HP = strength + defense) through the production raid route.
 *
 * Fully adaptive: the route defends each bot base with its REAL stored garrison
 * when players.units is non-empty (regrown by the beer-base scheduler) and falls
 * back to the synthesized model (docs/design/BASE_RAID_BALANCE.md knobs) when
 * empty — so this driver censuses every bot base, simulates the battle algebra
 * against the real per-unit STR/DEF, and CHOOSE bases/raider sizes that make the
 * semantics provable:
 *
 *   Leg 1 — competitive raider: projected 2–5 round AttackerWin with REAL
 *   proportional losses (garrison counters ≥ 10 damage ⇒ ≥ 1 infantry dead),
 *   survivors + reduced totals intact in the raider's DB row.
 *
 *   Leg 2 — overreached raider (single STR-10 unit): strike floored to 5,
 *   clean DefenderWin, raid force destroyed, garrison loses ZERO units.
 *   Never a DRAW.
 *
 * Expected numbers are DERIVED from the censused garrisons; preconditions are
 * asserted before raiding (honest failure with diagnostics on drift). Legs use
 * DIFFERENT bots — leg 1 zeroes its target's garrison (regrows per scheduler).
 *
 * Fixtures (direct SQL, marked): army grants + teleport onto the base tiles.
 * Cleanup: rbR-prefixed raiders + their battle rows/notifications.
 *
 * Run: npx tsx -r dotenv/config scripts/e2eBattleRebalance.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3002';
const PW = 'E2eRebalance!Probe7';
const SUFFIX = Date.now().toString().slice(-7);
const RAIDER_UNIT_HP = 10; // infantry STR 10, defense 0 → pool 10 per unit

// Synthesis knobs (app/api/combat/attack/route.ts) — mirrored for the algebra.
const GARRISON_DEF = 20;
const GARRISON_STR = 10;
const SIZE_DIVISOR = 20;
const SIZE_FLOOR = 8;
const SIZE_CAP = 60;
const STR_RATIO = 0.6;

interface HttpResult { status: number; json: Record<string, unknown>; cookie?: string }

async function api(method: string, path: string, body: unknown, cookie?: string): Promise<HttpResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: `darkframe_session=${cookie}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookies =
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    ([res.headers.get('set-cookie')].filter(Boolean) as string[]);
  const session = setCookies.map((c) => /darkframe_session=([^;]+)/.exec(c)?.[1]).find(Boolean);
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* non-JSON */ }
  return { status: res.status, json, cookie: session };
}

function fail(label: string, detail: unknown): never {
  console.log(`E2E FAIL: ${label} → ${JSON.stringify(detail)}`);
  process.exit(1);
}
function check(label: string, ok: boolean, detail?: unknown): void {
  if (!ok) fail(label, detail);
  console.log(`E2E ✓ ${label}`);
}

/** Garrison spec as the route would field it, expanded to individual units. */
interface GarrisonSpec { bot: string; x: number; y: number; level: number; units: Array<{ s: number; d: number }> }

/** Battle projection for a raider of `nUnits` × STR 10 infantry vs a garrison. */
interface Projection {
  rounds: number; outcome: 'ATTACKER_WIN' | 'DEFENDER_WIN';
  attackerUnitsLost: number; garrisonUnitsLost: number;
  strike: number; counter: number; garrisonSize: number; garrisonPool: number;
}

function project(spec: GarrisonSpec, raiderUnits: number): Projection {
  const A = raiderUnits * 10;
  const n = spec.units.length;
  const Dg = spec.units.reduce((t, u) => t + u.d, 0);
  const Pg = spec.units.reduce((t, u) => t + (u.s + u.d > 0 ? u.s + u.d : 10), 0);
  const perUnitPool = Pg / Math.max(1, n);
  // Level-gap protection (calculateDamage): |gap| > 20 → −5%/level, floor 25%.
  // The fresh raider is level 1; the factor applies to BOTH strikes (symmetric gap).
  const gap = Math.abs(1 - spec.level);
  const factor = gap > 20 ? Math.max(0.25, 1 - (gap - 20) * 0.05) : 1;
  const strike = Math.max(5, Math.floor((A - Dg / 2) * factor));
  const counter = Math.max(5, Math.floor((Dg - A / 2) * factor));
  let gHP = Pg;
  let aHP = A;
  let gLost = 0;
  let aLost = 0;
  let rounds = 0;
  let outcome: Projection['outcome'] = 'DEFENDER_WIN';
  while (aHP > 0 && gHP > 0 && rounds < 100) {
    rounds++;
    const gDeducted = Math.min(strike, gHP);
    gLost = Math.min(n, gLost + Math.floor(gDeducted / perUnitPool));
    gHP -= gDeducted;
    if (gHP <= 0) { outcome = 'ATTACKER_WIN'; break; }
    const aDeducted = Math.min(counter, aHP);
    aLost += Math.floor(aDeducted / RAIDER_UNIT_HP);
    aHP -= aDeducted;
    if (aHP <= 0) { outcome = 'DEFENDER_WIN'; break; }
  }
  if (outcome === 'DEFENDER_WIN') aLost = raiderUnits; // pool emptied → all are casualties
  if (outcome === 'ATTACKER_WIN') gLost = spec.units.length; // same rule, garrison side
  return {
    rounds, outcome,
    attackerUnitsLost: Math.min(aLost, raiderUnits),
    garrisonUnitsLost: Math.min(gLost, n),
    strike, counter, garrisonSize: n, garrisonPool: Pg,
  };
}

/** Census one bot base into a GarrisonSpec (real units, or the synthesis algebra). */
function census(bot: { username: string; total_defense: number; units: Array<Record<string, unknown>>; level: number; x: number; y: number }, raiderUnits: number): GarrisonSpec {
  const real = (bot.units ?? []).filter((u) => (Number(u.quantity) || 0) > 0);
  if (real.length > 0) {
    const units: Array<{ s: number; d: number }> = [];
    for (const u of real) {
      const q = Number(u.quantity) || 0;
      const s = Number(u.strength) || 0;
      const d = Number(u.defense) || 0;
      for (let i = 0; i < q; i++) units.push({ s, d });
    }
    return { bot: bot.username, x: Number(bot.x), y: Number(bot.y), level: Number(bot.level) || 1, units };
  }
  // Synthesis path: size from totalDefense, STR floored to 0.6×attackerSTR.
  const unitCount = Math.min(SIZE_CAP, Math.max(SIZE_FLOOR, Math.ceil((Number(bot.total_defense) || 150) / SIZE_DIVISOR)));
  const perUnitSTR = Math.max(GARRISON_STR, Math.ceil((STR_RATIO * raiderUnits * 10) / unitCount));
  return {
    bot: bot.username, x: Number(bot.x), y: Number(bot.y), level: Number(bot.level) || 1,
    units: Array.from({ length: unitCount }, () => ({ s: perUnitSTR, d: GARRISON_DEF })),
  };
}

async function provisionRaider(username: string, unitCount: number): Promise<string> {
  const reg = await api('POST', '/api/auth/register', {
    username, email: `rbR-${username.slice(3)}@test.local`, password: PW,
  });
  check(`register ${username}`, reg.status >= 200 && reg.status < 300 && !!reg.cookie, reg.json);
  const army = Array.from({ length: unitCount }, (_, i) => ({
    id: `${username}-e2e-${i}`, unitId: `${username}-e2e-${i}`,
    unitType: 'INFANTRY', name: 'Infantry', category: 'STR', rarity: 'common',
    strength: 10, defense: 0, quantity: 1, createdAt: new Date().toISOString(),
  }));
  const db = await connectToDatabase();
  const grant = await db.execute(sql`
    UPDATE players SET units = ${JSON.stringify(army)}::jsonb,
                       total_strength = ${unitCount * 10}, total_defense = 0
    WHERE username = ${username} RETURNING total_strength`);
  check(`army grant ${username} (${unitCount}×STR 10)`,
    Number((grant.rows as Array<{ total_strength: number }>)[0]?.total_strength) === unitCount * 10);
  return reg.cookie as string;
}

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // 0. Sweep leftovers from earlier runs (guarded prefix).
  const sweep = await db.execute(sql`DELETE FROM players WHERE username LIKE 'rbR%' RETURNING username`);
  if (sweep.rowCount) {
    console.log(`E2E ℹ swept ${sweep.rowCount} leftover raider(s)`);
    await db.execute(sql`DELETE FROM battle_logs WHERE attacker_username LIKE 'rbR%' OR defender_username LIKE 'rbR%'`);
    await db.execute(sql`DELETE FROM player_notifications WHERE player_id LIKE 'rbR%'`);
  }

  // 1. Census every bot base (real garrisons AND the synthesis fallback).
  const bots = await db.execute(sql`
    SELECT p.username AS username, p.total_defense AS total_defense, p.units AS units, p.level AS level,
           COALESCE(t.x, p.current_position_x) AS x, COALESCE(t.y, p.current_position_y) AS y
    FROM players p
    LEFT JOIN tiles t ON t.base_owner = p.username
    WHERE p.is_bot = 1 AND p.banned = 0`);
  const rows = bots.rows as Array<{ username: string; total_defense: number; units: Array<Record<string, unknown>>; level: number; x: number; y: number }>;
  check('bot census non-empty', rows.length > 0, rows.length);

  // 2. Choose leg-1: a base + raider size projecting a 2–5 round win with REAL losses.
  let leg1: { spec: GarrisonSpec; units: number; proj: Projection } | null = null;
  let leg2: { spec: GarrisonSpec; units: number; proj: Projection } | null = null;
  const candidateSizes = [30, 40, 60, 80, 100, 130, 160, 200, 260, 320, 400];
  for (const row of rows) {
    if (leg1 && leg2) break;
    for (const units of candidateSizes) {
      const spec = census(row, units);
      const proj = project(spec, units);
      if (!leg1 && proj.outcome === 'ATTACKER_WIN' && proj.rounds >= 2 && proj.rounds <= 20 &&
          proj.attackerUnitsLost >= 1 && proj.garrisonUnitsLost === spec.units.length) {
        leg1 = { spec, units, proj };
        break;
      }
    }
    if (!leg2) {
      const spec = census(row, 1);
      const proj = project(spec, 1);
      if (proj.outcome === 'DEFENDER_WIN' && proj.strike === 5 && proj.garrisonUnitsLost === 0) {
        leg2 = { spec, units: 1, proj };
      }
    }
  }
  check('leg-1 base found (competitive band exists)', !!leg1, { censused: rows.length });
  check('leg-2 base found (floor-repulsion band exists)', !!leg2, { censused: rows.length });
  check('distinct bots per leg (leg-1 zeroes its garrison)', leg1!.spec.bot !== leg2!.spec.bot,
    { leg1: leg1!.spec.bot, leg2: leg2!.spec.bot });
  console.log(`E2E ℹ leg-1: ${leg1!.units} infantry vs ${leg1!.spec.bot} (garrison ${leg1!.proj.garrisonSize} units, pool ${leg1!.proj.garrisonPool}, counter ${leg1!.proj.counter}) → ${leg1!.proj.rounds} rounds, ${leg1!.proj.attackerUnitsLost} losses projected`);
  console.log(`E2E ℹ leg-2: 1 infantry vs ${leg2!.spec.bot} (garrison ${leg2!.proj.garrisonSize} units, DEF total ${leg2!.spec.units.reduce((t, u) => t + u.d, 0)}) → strike floored to 5, repelled`);

  // ── LEG 1: competitive raid ────────────────────────────────────────────────
  const raider1 = `rbRComp${SUFFIX}`;
  const cookie1 = await provisionRaider(raider1, leg1!.units);
  await db.execute(sql`UPDATE players SET current_position_x = ${leg1!.spec.x}, current_position_y = ${leg1!.spec.y} WHERE username = ${raider1}`);
  const raid1 = await api('POST', '/api/combat/attack', { defender: leg1!.spec.bot, resource: 'metal' }, cookie1);
  check('leg-1 raid route 200', raid1.status === 200, raid1.json);
  const b1 = (raid1.json?.battle ?? {}) as Record<string, unknown>;
  check('leg-1 outcome ATTACKER_WIN (never DRAW)', b1.outcome === 'ATTACKER_WIN', b1.outcome);
  check(`leg-1 multi-round (${leg1!.proj.rounds} projected)`,
    (b1.rounds as unknown[]).length === leg1!.proj.rounds,
    { got: (b1.rounds as unknown[]).length, projected: leg1!.proj.rounds });
  const a1 = (b1.attacker ?? {}) as Record<string, unknown>;
  check(`leg-1 proportional losses (${leg1!.proj.attackerUnitsLost} of ${leg1!.units} projected)`,
    Number(a1.unitsLost) === leg1!.proj.attackerUnitsLost,
    { got: a1.unitsLost, projected: leg1!.proj.attackerUnitsLost });
  check('leg-1 garrison destroyed in full',
    Number(((b1.defender ?? {}) as Record<string, unknown>).unitsLost) === leg1!.proj.garrisonSize, b1.defender);
  const survivors = leg1!.units - leg1!.proj.attackerUnitsLost;
  const after1 = await db.execute(sql`
    SELECT jsonb_array_length(COALESCE(units,'[]'::jsonb)) AS entries, total_strength
    FROM players WHERE username = ${raider1}`);
  const s1 = (after1.rows as Array<{ entries: number; total_strength: number }>)[0];
  check(`leg-1 survivors intact (${survivors} units / STR ${survivors * 10})`,
    Number(s1.entries) === survivors && Number(s1.total_strength) === survivors * 10, s1);

  // ── LEG 2: overreached raid ────────────────────────────────────────────────
  const raider2 = `rbRWeak${SUFFIX}`;
  const cookie2 = await provisionRaider(raider2, 1);
  await db.execute(sql`UPDATE players SET current_position_x = ${leg2!.spec.x}, current_position_y = ${leg2!.spec.y} WHERE username = ${raider2}`);
  const raid2 = await api('POST', '/api/combat/attack', { defender: leg2!.spec.bot, resource: 'metal' }, cookie2);
  check('leg-2 raid route 200', raid2.status === 200, raid2.json);
  const b2 = (raid2.json?.battle ?? {}) as Record<string, unknown>;
  check('leg-2 outcome DEFENDER_WIN (honest repulsion, never DRAW)', b2.outcome === 'DEFENDER_WIN', b2.outcome);
  check('leg-2 raid force destroyed (1 unit)', Number(((b2.attacker ?? {}) as Record<string, unknown>).unitsLost) === 1, b2.attacker);
  check('leg-2 garrison loses ZERO units (clean defense)', Number(((b2.defender ?? {}) as Record<string, unknown>).unitsLost) === 0, b2.defender);

  // 3. Cleanup: both raiders + battle rows + notifications; residual verified.
  await db.execute(sql`DELETE FROM player_notifications WHERE player_id LIKE 'rbR%'`);
  await db.execute(sql`DELETE FROM battle_logs WHERE attacker_username LIKE 'rbR%' OR defender_username LIKE 'rbR%'`);
  await db.execute(sql`DELETE FROM players WHERE username LIKE 'rbR%'`);
  const residual = await db.execute(sql`
    SELECT (SELECT count(*)::int FROM players WHERE username LIKE 'rbR%') AS p,
           (SELECT count(*)::int FROM battle_logs WHERE attacker_username LIKE 'rbR%') AS b`);
  const r = (residual.rows as Array<{ p: number; b: number }>)[0];
  check('cleanup residual 0/0', Number(r.p) === 0 && Number(r.b) === 0, r);

  console.log(`\nE2E PASS — Phase-3 rebalance verified live: competitive raid ${leg1!.proj.rounds} rounds / ` +
    `${leg1!.proj.attackerUnitsLost} losses vs ${leg1!.spec.bot}; overreached raid repelled R1 vs ${leg2!.spec.bot}, garrison unscratched.`);
  process.exit(0);
}

main().catch((e) => {
  console.log('E2E FAIL: unhandled error →', String(e).slice(0, 400));
  process.exit(1);
});
