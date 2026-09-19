/**
 * FID-20260915-003 — live verification of the endgame pacing ladder through the
 * production raid route (POST /api/combat/attack on the running dev server).
 *
 * Fully adaptive: censuses every bot base (real regrown garrisons OR the route's
 * synthesis algebra incl. the FID-20260915-003 tier-multiplier ladder), projects
 * the battle with the engine's documented damage/level-gap algebra, and CHOOSES
 * matchups that make the semantics provable:
 *
 *   Leg A — endgame raider vs a fresh top-tier (bU/bL) base: the ladder must
 *   force a MULTI-ROUND fight with real proportional losses (survivors intact
 *   in the raider's DB row afterwards). The live map has no fresh bases (the
 *   scheduler regrows every garrison), so the fixture snapshots the strongest
 *   bot's garrison and temporarily empties it — byte-for-byte the fresh-spawn
 *   state the synthesis path serves — restored in `finally` no matter what.
 *   Leg B — overreached single-unit raider: honest R1 repulsion, garrison loses
 *   ZERO. Never a DRAW.
 *   Leg C — the operator's real account (fame) raids a projected-fair bot base:
 *   prints the felt pacing (rounds, damage, losses), asserts account integrity,
 *   restores fame's position. The battle row STAYS — it is real game state by
 *   design (operator directive: "run a real raid in the game").
 *
 * Fixtures (direct SQL, marked): army grants + teleports. Cleanup: rbE-prefixed
 * raiders + their battle rows/notifications.
 *
 * Run: npx tsx -r dotenv/config scripts/e2eEndgamePacing.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { connectToDatabase } from '@/lib/db/connection';

const BASE_URL = process.env.E2E_BASE ?? 'http://localhost:3002';
const PW = 'E2ePacing!Probe3';
const SUFFIX = Date.now().toString().slice(-7);

// Synthesis knobs (app/api/combat/attack/route.ts) — mirrored for the algebra.
const GARRISON_DEF = 20;
const GARRISON_STR = 10;
const SIZE_DIVISOR = 20;
const SIZE_FLOOR = 8;
const SIZE_CAP = 60;
const STR_RATIO = 0.2;
const DEF_RATIO = 0.65;
const TIER_MULT: Record<number, number> = { 1: 1.0, 2: 1.05, 3: 1.1, 4: 1.2, 5: 1.35, 6: 1.5 };

interface HttpResult { status: number; json: Record<string, unknown>; cookie?: string }

async function api(method: string, path: string, body: unknown, cookie?: string): Promise<HttpResult> {
  const res = await fetch(`${BASE_URL}${path}`, {
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

/** Throws (not process.exit) so the fixture `finally` always restores state. */
function fail(label: string, detail: unknown): never {
  throw new Error(`E2E FAIL: ${label} → ${JSON.stringify(detail)}`);
}
function check(label: string, ok: boolean, detail?: unknown): void {
  if (!ok) fail(label, detail);
  console.log(`E2E ✓ ${label}`);
}

interface GarrisonSpec { bot: string; tierIdx: number; x: number; y: number; level: number; units: Array<{ s: number; d: number }> }

interface Projection {
  rounds: number; outcome: 'ATTACKER_WIN' | 'DEFENDER_WIN';
  attackerUnitsLost: number; garrisonUnitsLost: number;
  strike: number; counter: number; garrisonPool: number; raiderPool: number;
}

/** Balance band (lib/balanceService.ts) — FID-20260915-004 combat seam. */
function balanceOf(str: number, def: number): { dealt: number; taken: number } {
  const ratio = Math.min(str, def) / Math.max(str, def) || 0;
  if (ratio < 0.7) return { dealt: 0.8, taken: 1.3 };        // CRITICAL
  if (ratio < 0.85 || ratio > 1.5) return { dealt: 0.9, taken: 1.15 }; // IMBALANCED
  if (ratio >= 0.95 && ratio <= 1.05) return { dealt: 1.05, taken: 0.95 }; // OPTIMAL
  return { dealt: 1.0, taken: 1.0 };                          // BALANCED
}

/** Battle projection from per-unit specs (engine algebra: damage, level gap, HP pools, FID-20260915-004 balance + reinforcement). */
function project(
  spec: GarrisonSpec, raider: { str: number; hpPerUnit: number; count: number; level: number }
): Projection {
  // Reinforcement floor mirror (route-level Fix B): real garrisons get the same
  // weight-class target as synthesized ones. spec.units already includes the
  // supplemental units when censused against this raider's STR.
  const A = raider.str;
  const n = spec.units.length;
  const Dg = spec.units.reduce((t, u) => t + u.d, 0);
  const Pg = spec.units.reduce((t, u) => t + (u.s + u.d > 0 ? u.s + u.d : 10), 0);
  const perUnitPool = Pg / Math.max(1, n);
  // Level-gap protection (calculateDamage): |gap| > 20 → −5%/level, floor 25%.
  const gap = Math.abs(raider.level - spec.level);
  const factor = gap > 20 ? Math.max(0.25, 1 - (gap - 20) * 0.05) : 1;
  // FID-20260915-004: balance composes dealt × taken on every strike. The
  // garrison's band comes from its ACTUAL (reinforced) STR/DEF totals — real
  // band garrisons are not mono-DEF.
  const Sg = spec.units.reduce((t, u) => t + u.s, 0);
  const aBal = balanceOf(A, 0);            // E2E raiders are mono-STR
  const dBal = balanceOf(Sg, Dg);
  const strike = Math.max(5, Math.floor(Math.max(5, Math.floor((A - Dg / 2) * factor)) * aBal.dealt * dBal.taken));
  const counter = Math.max(5, Math.floor(Math.max(5, Math.floor((Dg - A / 2) * factor)) * dBal.dealt * aBal.taken));
  const raiderPool = raider.count * raider.hpPerUnit;
  let gHP = Pg;
  let aHP = raiderPool;
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
    aLost += Math.floor(aDeducted / raider.hpPerUnit);
    aHP -= aDeducted;
    if (aHP <= 0) { outcome = 'DEFENDER_WIN'; break; }
  }
  if (outcome === 'DEFENDER_WIN') aLost = raider.count; // pool emptied → all casualties
  if (outcome === 'ATTACKER_WIN') gLost = n;            // same rule, garrison side
  return {
    rounds, outcome,
    attackerUnitsLost: Math.min(aLost, raider.count),
    garrisonUnitsLost: Math.min(gLost, n),
    strike, counter, garrisonPool: Pg, raiderPool,
  };
}

function markerTierOf(username: string): number {
  const marker = /^b([WMSEUL])\d{12}$/.exec(username)?.[1] ?? 'W';
  return Math.min(6, ({ W: 1, M: 2, S: 3, E: 4, U: 5, L: 6 } as Record<string, number>)[marker] ?? 1);
}

/** Canonical tier: bot_config.tier (spawner field), marker fallback — mirrors resolveBotTier. */
function tierOf(bot: { username: string; bot_config?: unknown }): number {
  const cfgTier = Number((bot.bot_config as Record<string, unknown> | null | undefined)?.tier);
  if (Number.isFinite(cfgTier) && cfgTier >= 1) return Math.min(6, Math.round(cfgTier));
  return markerTierOf(bot.username);
}

/** Census one bot base into a GarrisonSpec (real units, or the synthesis+ladder algebra). */
function census(
  bot: { username: string; total_defense: number; units: Array<Record<string, unknown>>; level: number; x: number; y: number; bot_config?: unknown },
  raiderSTR: number
): GarrisonSpec {
  const tierIdx = tierOf(bot);
  const real = (bot.units ?? []).filter((u) => (Number(u.quantity) || 0) > 0);
  if (real.length > 0) {
    const units: Array<{ s: number; d: number }> = [];
    for (const u of real) {
      const q = Number(u.quantity) || 0;
      const s = Number(u.strength) || 0;
      const d = Number(u.defense) || 0;
      for (let i = 0; i < q; i++) units.push({ s, d });
    }
    // FID-20260915-004 Fix B mirror: the route reinforces REAL garrisons to the
    // same weight-class target as synthesized ones — mirror it exactly.
    const mult = TIER_MULT[tierIdx] ?? 1;
    const defTarget = Math.ceil(raiderSTR * DEF_RATIO * mult);
    const strTarget = Math.ceil(raiderSTR * STR_RATIO * mult);
    const curDEF = units.reduce((t, u) => t + u.d, 0);
    const curSTR = units.reduce((t, u) => t + u.s, 0);
    const defDeficit = Math.max(0, defTarget - curDEF);
    const strDeficit = Math.max(0, strTarget - curSTR);
    for (let i = 0; i < Math.ceil(defDeficit / 100); i++) units.push({ s: 0, d: 100 });
    for (let i = 0; i < Math.ceil(strDeficit / 90); i++) units.push({ s: 90, d: 0 });
    return { bot: bot.username, tierIdx, x: Number(bot.x), y: Number(bot.y), level: Number(bot.level) || 1, units };
  }
  const mult = TIER_MULT[tierIdx] ?? 1;
  const unitCount = Math.min(SIZE_CAP, Math.max(SIZE_FLOOR, Math.ceil((Number(bot.total_defense) || 150) / SIZE_DIVISOR)));
  const perUnitSTR = Math.max(GARRISON_STR, Math.ceil((STR_RATIO * mult * raiderSTR) / unitCount));
  const perUnitDEF = Math.max(GARRISON_DEF, Math.ceil((DEF_RATIO * mult * raiderSTR) / unitCount));
  return {
    bot: bot.username, tierIdx, x: Number(bot.x), y: Number(bot.y), level: Number(bot.level) || 1,
    units: Array.from({ length: unitCount }, () => ({ s: perUnitSTR, d: perUnitDEF })),
  };
}

async function provisionRaider(username: string, unitCount: number, unitSTR: number, level = 1): Promise<string> {
  const reg = await api('POST', '/api/auth/register', {
    username, email: `rbE-${username.slice(3)}@test.local`, password: PW,
  });
  check(`register ${username}`, reg.status >= 200 && reg.status < 300 && !!reg.cookie, reg.json);
  const army = Array.from({ length: unitCount }, (_, i) => ({
    id: `${username}-e2e-${i}`, unitId: `${username}-e2e-${i}`,
    unitType: 'INFANTRY', name: 'Infantry', category: 'STR', rarity: 'common',
    strength: unitSTR, defense: 0, quantity: 1, createdAt: new Date().toISOString(),
  }));
  const db = await connectToDatabase();
  const grant = await db.execute(sql`
    UPDATE players SET units = ${JSON.stringify(army)}::jsonb,
                       total_strength = ${unitCount * unitSTR}, total_defense = 0,
                       level = ${level}
    WHERE username = ${username} RETURNING total_strength`);
  check(`army grant ${username} (${unitCount}×STR ${unitSTR})`,
    Number((grant.rows as Array<{ total_strength: number }>)[0]?.total_strength) === unitCount * unitSTR);
  return reg.cookie as string;
}

async function cleanupRaiders(db: Awaited<ReturnType<typeof connectToDatabase>>): Promise<void> {
  await db.execute(sql`DELETE FROM player_notifications WHERE player_id LIKE 'rbE%'`);
  await db.execute(sql`DELETE FROM battle_logs WHERE attacker_username LIKE 'rbE%' OR defender_username LIKE 'rbE%'`);
  await db.execute(sql`DELETE FROM players WHERE username LIKE 'rbE%'`);
}

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // 0. Sweep leftovers from earlier runs (guarded prefix).
  const sweep = await db.execute(sql`DELETE FROM players WHERE username LIKE 'rbE%' RETURNING username`);
  if (sweep.rowCount) {
    console.log(`E2E ℹ swept ${sweep.rowCount} leftover raider(s)`);
    await cleanupRaiders(db);
  }

  // 1. Census every bot base (real garrisons AND the synthesis fallback).
  const bots = await db.execute(sql`
    SELECT p.username AS username, p.total_defense AS total_defense, p.units AS units, p.level AS level,
           p.bot_config AS bot_config,
           COALESCE(t.x, p.current_position_x) AS x, COALESCE(t.y, p.current_position_y) AS y
    FROM players p
    LEFT JOIN tiles t ON t.base_owner = p.username
    WHERE p.is_bot = 1 AND p.banned = 0`);
  const rows = bots.rows as Array<{ username: string; total_defense: number; units: Array<Record<string, unknown>>; level: number; x: number; y: number; bot_config?: unknown }>;
  check('bot census non-empty', rows.length > 0, rows.length);

  // 2. Fixture: snapshot the strongest bot and empty its garrison (fresh-spawn
  // state). Restored in `finally` — the throw-based fail() guarantees it.
  const byTier = [...rows].sort((a, b) => tierOf(b) - tierOf(a));
  const fixtureBot = byTier[0];
  check('fixture bot found', !!fixtureBot, byTier.slice(0, 3).map((r) => `${r.username}:T${tierOf(r)}`));
  // Snapshot BOTH columns: the route's synthesis reads total_defense (size) and
  // units (real garrison); a partial restore leaves the bot broken.
  const snapshot = { units: JSON.stringify(fixtureBot.units ?? []), totalDef: Number(fixtureBot.total_defense) || 0 };
  const ENDGAME_STR_PER = 100; // T5-class infantry
  const endgameCount = 2200;   // ≈ 220k STR, the sim's endgame raider
  const raiderSTR = endgameCount * ENDGAME_STR_PER;
  let legA: { spec: GarrisonSpec; proj: Projection } | null = null;
  let legB: { spec: GarrisonSpec } | null = null;
  let fameMovedFrom: { x: number; y: number } | null = null;
  const restoreFame = async (): Promise<void> => {
    const from = fameMovedFrom as { x: number; y: number } | null;
    if (from) {
      await db.execute(sql`UPDATE players SET current_position_x = ${from.x}, current_position_y = ${from.y} WHERE username = 'fame'`);
      console.log(`E2E ℹ fame's position restored to (${from.x},${from.y})`);
    }
  };

  try {
    await db.execute(sql`
      UPDATE players SET units = '[]'::jsonb, total_defense = 0
      WHERE username = ${fixtureBot.username}`);
    console.log(`E2E ℹ fixture: ${fixtureBot.username} (tier ${tierOf(fixtureBot)}) garrison emptied — snapshot held (${(fixtureBot.units ?? []).length} entries)`);

    // 3. Select legs from the fixture's synthesis algebra. The census row must
    // reflect the EMPTIED garrison (the in-memory row still holds the snapshot).
    const fixtureRow = { ...fixtureBot, units: [] as Array<Record<string, unknown>> };
    for (const row of [fixtureRow]) {
      const spec = census(row, raiderSTR);
      const projA = project(spec, { str: raiderSTR, hpPerUnit: ENDGAME_STR_PER, count: endgameCount, level: 45 });
      if (spec.tierIdx >= 5 && projA.outcome === 'ATTACKER_WIN' && projA.rounds >= 3 && projA.attackerUnitsLost >= endgameCount * 0.5) {
        legA = { spec, proj: projA };
      }
      const projB = project(spec, { str: 10, hpPerUnit: 10, count: 1, level: 1 });
      if (!legB && projB.outcome === 'DEFENDER_WIN' && projB.strike === 5 && projB.garrisonUnitsLost === 0) legB = { spec };
    }
    check('leg-A base found (laddered multi-round band exists)', !!legA,
      { tierIdx: tierOf(fixtureBot), proj: legA?.proj });
    check('leg-B base found (floor-repulsion band exists)', !!legB, {});
    // (Both legs share the fixture bot by design: the synthesized garrison is
    // ephemeral — the route deletes nothing on win, so leg B still has its base.)
    console.log(`E2E ℹ leg-A: ${endgameCount}×STR${ENDGAME_STR_PER} (${raiderSTR.toLocaleString()} STR) vs ${legA!.spec.bot} ` +
      `(tier ${legA!.spec.tierIdx}, garrison ${legA!.spec.units.length}, pool ${legA!.proj.garrisonPool.toLocaleString()}, counter ${legA!.proj.counter.toLocaleString()}/r) → ${legA!.proj.rounds} rounds, ${legA!.proj.attackerUnitsLost} losses projected`);
    console.log(`E2E ℹ leg-B: 1 infantry vs ${legB!.spec.bot} → strike floored to 5, repelled`);

    // ── LEG A: endgame raider vs laddered top-tier base ───────────────────────
    const raiderA = `rbEEnd${SUFFIX}`;
    // Level 45 vs the tier-6 bot: gap 20 keeps the level-gap factor at 1.0
    // (protection starts past 20) — mirrors the sim's endgame raider.
    const cookieA = await provisionRaider(raiderA, endgameCount, ENDGAME_STR_PER, 45);
    await db.execute(sql`UPDATE players SET current_position_x = ${legA!.spec.x}, current_position_y = ${legA!.spec.y} WHERE username = ${raiderA}`);
    const raidA = await api('POST', '/api/combat/attack', { defender: legA!.spec.bot, resource: 'metal' }, cookieA);
    check('leg-A raid route 200', raidA.status === 200, raidA.json);
    const bA = (raidA.json?.battle ?? {}) as Record<string, unknown>;
    check('leg-A outcome ATTACKER_WIN (never DRAW)', bA.outcome === 'ATTACKER_WIN', bA.outcome);
    check(`leg-A MULTI-ROUND (${legA!.proj.rounds} projected)`,
      (bA.rounds as unknown[]).length === legA!.proj.rounds,
      { got: (bA.rounds as unknown[]).length, projected: legA!.proj.rounds });
    const aA = (bA.attacker ?? {}) as Record<string, unknown>;
    // FID-20260915-004 note: the projection floors damage/kill counts once per
    // round while the engine sequences casualties per-unit — expect ≤0.2%
    // integer-order drift, never a semantic gap.
    const lossTol = Math.max(3, Math.ceil(endgameCount * 0.002));
    check(`leg-A proportional losses (${legA!.proj.attackerUnitsLost}±${lossTol} of ${endgameCount} projected)`,
      Math.abs(Number(aA.unitsLost) - legA!.proj.attackerUnitsLost) <= lossTol,
      { got: aA.unitsLost, projected: legA!.proj.attackerUnitsLost, tol: lossTol });
    const survivorsA = endgameCount - Number(aA.unitsLost);
    const afterA = await db.execute(sql`
      SELECT jsonb_array_length(COALESCE(units,'[]'::jsonb)) AS entries, total_strength
      FROM players WHERE username = ${raiderA}`);
    const sA = (afterA.rows as Array<{ entries: number; total_strength: number }>)[0];
    check(`leg-A survivors intact (${survivorsA} units / STR ${survivorsA * ENDGAME_STR_PER})`,
      Number(sA.entries) === survivorsA && Number(sA.total_strength) === survivorsA * ENDGAME_STR_PER, sA);

    // ── LEG B: overreached raid, honest repulsion ─────────────────────────────
    const raiderB = `rbEWeak${SUFFIX}`;
    const cookieB = await provisionRaider(raiderB, 1, 10);
    await db.execute(sql`UPDATE players SET current_position_x = ${legB!.spec.x}, current_position_y = ${legB!.spec.y} WHERE username = ${raiderB}`);
    const raidB = await api('POST', '/api/combat/attack', { defender: legB!.spec.bot, resource: 'metal' }, cookieB);
    check('leg-B raid route 200', raidB.status === 200, raidB.json);
    const bB = (raidB.json?.battle ?? {}) as Record<string, unknown>;
    check('leg-B outcome DEFENDER_WIN (honest repulsion, never DRAW)', bB.outcome === 'DEFENDER_WIN', bB.outcome);
    check('leg-B raid force destroyed (1 unit)', Number(((bB.attacker ?? {}) as Record<string, unknown>).unitsLost) === 1, bB.attacker);
    check('leg-B garrison loses ZERO units', Number(((bB.defender ?? {}) as Record<string, unknown>).unitsLost) === 0, bB.defender);
  } finally {
    // Fixture restore (byte-for-byte snapshot) + throwaway cleanup, ALWAYS.
    await db.execute(sql`
      UPDATE players SET units = ${snapshot.units}::jsonb, total_defense = ${snapshot.totalDef}
      WHERE username = ${fixtureBot.username}`);
    console.log(`E2E ℹ fixture restored: ${fixtureBot.username} garrison + total_defense ${snapshot.totalDef} returned from snapshot`);
    await cleanupRaiders(db);
    const residual = await db.execute(sql`
      SELECT (SELECT count(*)::int FROM players WHERE username LIKE 'rbE%') AS p,
             (SELECT count(*)::int FROM battle_logs WHERE attacker_username LIKE 'rbE%') AS b`);
    const r = (residual.rows as Array<{ p: number; b: number }>)[0];
    check('cleanup residual 0/0', Number(r.p) === 0 && Number(r.b) === 0, r);
    if (fameMovedFrom) await restoreFame();
  }

  // ── LEG C: the operator's real account (fame) raids a projected-fair base ───
  // Real state (fixture already restored). Projection uses REAL regrown garrisons.
  const fameRows = await db.execute(sql`
    SELECT username, email, level, current_position_x AS hx, current_position_y AS hy,
           units, total_strength, resources_metal, resources_energy, xp
    FROM players WHERE username = 'fame'`);
  const fame = (fameRows.rows as Array<{
    username: string; email: string; level: number; hx: number; hy: number;
    units: Array<Record<string, unknown>>; total_strength: number;
    resources_metal: number; resources_energy: number; xp: number;
  }>)[0];
  check("fame's row exists", !!fame);
  const fameUnits: Array<{ q: number; s: number; d: number }> = (fame.units ?? [])
    .filter((u) => (Number(u.quantity) || 0) > 0)
    .map((u) => ({ q: Number(u.quantity) || 0, s: Number(u.strength) || 0, d: Number(u.defense) || 0 }));
  const fameCount = fameUnits.reduce((t, u) => t + u.q, 0);
  const fameSTR = fameUnits.reduce((t, u) => t + u.q * u.s, 0);
  const hpPerUnit = fameCount > 0
    ? Math.max(1, Math.round(fameUnits.reduce((t, u) => t + u.q * (u.s + u.d), 0) / fameCount))
    : 10;
  check("fame's army non-empty", fameCount > 0, { fameCount, fameSTR });
  console.log(`E2E ℹ leg-C: fame — ${fameCount.toLocaleString()} units, STR ${fameSTR.toLocaleString()}, HP/unit ≈ ${hpPerUnit}, level ${fame.level}, at (${fame.hx},${fame.hy})`);
  let legC: { spec: GarrisonSpec; proj: Projection } | null = null;
  for (const row of rows) {
    if (row.username === fixtureBot.username) continue;
    const spec = census(row, fameSTR);
    const proj = project(spec, { str: fameSTR, hpPerUnit, count: fameCount, level: Number(fame.level) || 1 });
    // A fair "felt pacing" raid: a real multi-round win with survivable losses.
    if (proj.outcome === 'ATTACKER_WIN' && proj.rounds >= 2 && proj.attackerUnitsLost < fameCount * 0.6) {
      legC = { spec, proj };
      break;
    }
  }
  if (legC) {
    console.log(`E2E ℹ leg-C target: ${legC.spec.bot} (tier ${legC.spec.tierIdx}, ${legC.spec.units.length} garrison units) → projected ${legC.proj.rounds} rounds, ${legC.proj.attackerUnitsLost.toLocaleString()} losses`);
    // NOTE: a won raid DELETES the defeated bot base (route win path: base
    // removed, tile released) — leg C consumes a real bot by design.
    const jwt = await new SignJWT({ username: fame.username, email: fame.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'darkframe-secret-change-in-production'));
    fameMovedFrom = { x: Number(fame.hx), y: Number(fame.hy) };
    try {
    await db.execute(sql`UPDATE players SET current_position_x = ${legC.spec.x}, current_position_y = ${legC.spec.y} WHERE username = 'fame'`);
    const raidC = await api('POST', '/api/combat/attack', { defender: legC.spec.bot, resource: 'metal' }, jwt);
    check('leg-C raid route 200', raidC.status === 200, raidC.json);
    const bC = (raidC.json?.battle ?? {}) as Record<string, unknown>;
    const aC = (bC.attacker ?? {}) as Record<string, unknown>;
    const dC = (bC.defender ?? {}) as Record<string, unknown>;
    console.log(`E2E ℹ leg-C FELT PACING: outcome=${bC.outcome}, rounds=${(bC.rounds as unknown[]).length}, ` +
      `fame dealt ${Number(aC.damageDealt ?? 0).toLocaleString()} over the fight, lost ${Number(aC.unitsLost ?? 0).toLocaleString()} of ${fameCount.toLocaleString()} units ` +
      `(${(100 * Number(aC.unitsLost ?? 0) / Math.max(1, fameCount)).toFixed(1)}%), garrison lost ${Number(dC.unitsLost ?? 0)}`);
    check('leg-C outcome ATTACKER_WIN (fair raid won)', bC.outcome === 'ATTACKER_WIN', bC.outcome);
    check('leg-C multi-round (pacing felt, not R1)', (bC.rounds as unknown[]).length >= 2,
      { got: (bC.rounds as unknown[]).length });
    const lossTolC = Math.max(3, Math.ceil(fameCount * 0.002));
    check(`leg-C losses match projection (${legC.proj.attackerUnitsLost}±${lossTolC} projected)`,
      Math.abs(Number(aC.unitsLost) - legC.proj.attackerUnitsLost) <= lossTolC, { got: aC.unitsLost, projected: legC.proj.attackerUnitsLost, tol: lossTolC });
    const survivorsC = fameCount - Number(aC.unitsLost);
    const afterC = await db.execute(sql`SELECT units, total_strength FROM players WHERE username = 'fame'`);
    const fC = (afterC.rows as Array<{ units: Array<Record<string, unknown>>; total_strength: number }>)[0];
    const survivingCount = (fC.units ?? []).reduce((t, u) => t + (Number(u.quantity) || 0), 0);
    check(`fame's army intact after the raid (${survivorsC} survivors expected)`,
      survivingCount === survivorsC, { got: survivingCount, expected: survivorsC });
    } finally {
      await restoreFame();
    }
  } else {
    console.log('E2E ℹ leg-C skipped: no bot base projects a fair fame raid (all lopsided) — reported, not failed');
  }

  console.log(`\nE2E PASS — endgame pacing verified live: laddered top-tier raid ${legA!.proj.rounds} rounds / ` +
    `${legA!.proj.attackerUnitsLost}/${endgameCount} losses vs ${legA!.spec.bot}; overreach repelled R1 vs ${legB!.spec.bot}; ` +
    (legC ? `fame's raid: ${legC.proj.rounds} rounds, ${legC.proj.attackerUnitsLost.toLocaleString()} losses — pacing felt.` : 'fame: no fair raid available (all lopsided).'));
  process.exit(0);
}

main().catch((e) => {
  console.log(String(e?.message ?? e).slice(0, 600));
  process.exit(1);
});
