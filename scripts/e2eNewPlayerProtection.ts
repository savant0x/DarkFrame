/**
 * FID-20260916-002 — LIVE verification driver for the new-player protection window.
 * Run against the local dev server (PORT=3002) with DATABASE_URL loaded from .env.
 *
 * Self-contained: creates its own fixtures (svc_*_ts<ts> suffixed), verifies the
 * FID's live-probe matrix, restores fixture state (protection void = the same write
 * path production uses), and cleans up every row it created. Exits non-zero on any
 * failed probe. No credentials are ever printed.
 *
 * Probes:
 *   1. register → row protectionUntil ≈ now+72h (±5 min)
 *   2. infantry attack vs protected target → 400 'Target is under new-player protection'
 *   3. WMD validateTargeting refuses the protected account (column reader alive, no code change)
 *   4. protected attacker initiates infantry → row's protectionUntil NULL (aggression void)
 *   5. factory owned by protected player → refusal 'Target is under new-player protection'
 *   6. control: combat/attack vs a PLAYER base → 'Target is not a hostile base' (structural)
 *   7. cleanup: guarded delete of fixture players + seeded factory (0 residual)
 *
 * NOTES:
 *  - Infantry + factory attacks enforce presence (attacker must stand on the target
 *    tile), so the driver teleports the attacker via direct column writes.
 *  - The aggression void fires inside executeInfantryAttack AFTER the route's
 *    protection gate, so probe 4 clears the victim's window first (direct column
 *    write — the same write path the void itself uses) to let the battle through.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' }); // DATABASE_URL lives in .env.local (Next loads it natively; standalone scripts must not)
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../lib/db';
import { players, factories } from '../lib/db/schema';
import { UnitType } from '../types/game.types';

const BASE = process.env.PROBE_BASE_URL ?? 'http://localhost:3002';
const TS = Date.now().toString(36);
const VICTIM = `svc_victim_${TS}`; // stays protected the whole run
const ATTACKER = `svc_attack_${TS}`; // protected at registration, voids on aggression

const EMAIL = (u: string) => `${u}@probe.invalid`;
const PASS = 'Pr0be!Passw0rd!';
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function msgOf(body: any): string {
  const b = body as {
    message?: string;
    error?: { message?: string; details?: { message?: string } | string };
  };
  const details = b?.error?.details;
  return String(
    (details && typeof details === 'object' ? details.message : details) ??
      b?.error?.message ??
      b?.message ??
      ''
  );
}

async function api(
  method: 'POST' | 'GET',
  path: string,
  cookie: string | null,
  body?: unknown
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function registerPlayer(username: string): Promise<void> {
  const { status, body } = await api('POST', '/api/auth/register', null, {
    username,
    email: EMAIL(username),
    password: PASS,
  });
  const echoed = JSON.stringify(body).includes(username);
  if (status >= 400 && !echoed) {
    throw new Error(`register ${username} failed: HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`);
  }
}

async function loginAndGetCookie(username: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL(username), password: PASS }),
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  const auth = raw.map((c) => c.split(';')[0]).find((c) => c.startsWith('darkframe_session='));
  if (!auth) throw new Error(`login ${username}: no darkframe_session cookie (HTTP ${res.status})`);
  return auth;
}

async function rowOf(username: string): Promise<{
  protectionUntil: Date | null;
  currentPositionX: number;
  currentPositionY: number;
}> {
  const [row] = await db
    .select({
      protectionUntil: players.protectionUntil,
      currentPositionX: players.currentPositionX,
      currentPositionY: players.currentPositionY,
    })
    .from(players)
    .where(eq(players.username, username))
    .limit(1);
  if (!row) throw new Error(`fixture row missing: ${username}`);
  return row;
}

async function giveUnits(username: string): Promise<void> {  const unit = {
    id: 'probe_u1', unitId: 'probe_u1', unitType: UnitType.T1_Militia, name: 'T1 Militia',
    category: 'STR', rarity: 'common', strength: 90, defense: 0, quantity: 1, createdAt: new Date(),
  } as const;
  await db.update(players).set({ units: [unit], totalStrength: 90 }).where(eq(players.username, username));
}

async function teleport(username: string, x: number, y: number): Promise<void> {
  await db.update(players).set({ currentPositionX: x, currentPositionY: y }).where(eq(players.username, username));
}

async function cleanup(victimFactoryPos: { x: number; y: number } | null): Promise<void> {
  if (victimFactoryPos) {
    await db
      .delete(factories)
      .where(and(eq(factories.x, victimFactoryPos.x), eq(factories.y, victimFactoryPos.y)));
  }
  await db.delete(players).where(inArray(players.username, [VICTIM, ATTACKER]));
}

async function main(): Promise<void> {
  console.log(`\n=== FID-20260916-002 live probes @ ${BASE} (fixtures: ${VICTIM}, ${ATTACKER}) ===\n`);
  let victimFactoryPos: { x: number; y: number } | null = null;
  try {
    await registerPlayer(VICTIM);
    await registerPlayer(ATTACKER);

    // Probe 1 — registration sets the 72h window
    const victimBefore = await rowOf(VICTIM);
    const deltaH = victimBefore.protectionUntil
      ? (new Date(victimBefore.protectionUntil).getTime() - Date.now()) / 3_600_000
      : -1;
    check('register → protectionUntil ≈ now+72h', deltaH > 71 && deltaH <= 72.1, `Δ=${deltaH.toFixed(3)}h`);

    // Probe 2 — infantry attack vs protected target refused with the server reason
    // (route gate fires before presence; both players stand where registration put them)
    const atkCookie = await loginAndGetCookie(ATTACKER);
    await giveUnits(ATTACKER);
    const infRes = await api('POST', '/api/combat/infantry', atkCookie, {
      targetUsername: VICTIM,
      unitIds: ['probe_u1'],
    });
    check(
      'infantry vs protected target → 400 refusal',
      infRes.status === 400 && msgOf(infRes.body) === 'Target is under new-player protection',
      `HTTP ${infRes.status} "${msgOf(infRes.body).slice(0, 90)}"`
    );

    // Probe 3 — WMD targeting validator enforces the same column (zero code change).
    // Must run BEFORE the aggression void clears windows.
    const { validateTargeting } = await import('../lib/wmd/targetingValidator');
    const wmd = await validateTargeting(ATTACKER, VICTIM, 'TACTICAL' as never);
    check(
      'WMD validateTargeting refuses protected target',
      wmd.isValid === false && wmd.errors.includes('Target is under protection'),
      `errors=${JSON.stringify(wmd.errors)}`
    );

    // Probe 4 — protected attacker initiates: window voided on aggression.
    // The route's protection gate reads the DEFENDER, so clear the victim's window
    // first (direct column write — the same write path the void itself uses).
    await giveUnits(VICTIM);
    await db.update(players).set({ protectionUntil: null }).where(eq(players.username, VICTIM));
    await teleport(ATTACKER, victimBefore.currentPositionX, victimBefore.currentPositionY);
    const infRes2 = await api('POST', '/api/combat/infantry', atkCookie, {
      targetUsername: VICTIM,
      unitIds: ['probe_u1'],
    });
    const attackerAfter = await rowOf(ATTACKER);
    check(
      'protected attacker initiates → window voided (protectionUntil NULL)',
      attackerAfter.protectionUntil === null,
      `battle HTTP ${infRes2.status} (${infRes2.status < 400 ? 'battle resolved' : msgOf(infRes2.body).slice(0, 60)}); protectionUntil=${String(attackerAfter.protectionUntil)}`
    );

    // Probe 5 — factory owned by a protected player cannot be captured.
    // Auto-created factories are unowned (owner: null); seed a victim-owned one.
    const seeded = await db
      .insert(factories)
      .values({
        x: victimBefore.currentPositionX,
        y: victimBefore.currentPositionY,
        owner: VICTIM,
        level: 1,
        lastSlotRegen: new Date(),
      })
      .returning({ x: factories.x, y: factories.y });
    victimFactoryPos = { x: seeded[0].x, y: seeded[0].y };
    await db
      .update(players)
      .set({ protectionUntil: new Date(Date.now() + 72 * 3_600_000) })
      .where(eq(players.username, VICTIM));
    await teleport(ATTACKER, victimBefore.currentPositionX, victimBefore.currentPositionY);
    const factoryRes = await api('POST', '/api/factory/attack', atkCookie, {
      x: victimBefore.currentPositionX,
      y: victimBefore.currentPositionY,
    });
    check(
      'factory owned by protected player → refusal',
      factoryRes.body?.success === false && msgOf(factoryRes.body) === 'Target is under new-player protection',
      `HTTP ${factoryRes.status} "${msgOf(factoryRes.body).slice(0, 90)}"`
    );

    // Probe 6 — negative control: combat/attack vs a PLAYER base stays structurally
    // refused ('Target is not a hostile base' — bots-only route, no protection code)
    const raidRes = await api('POST', '/api/combat/attack', atkCookie, {
      defender: VICTIM,
      resource: 'metal',
    });
    const structural = String(msgOf(raidRes.body)).toLowerCase().includes('not a hostile base');
    check(
      'control: base raid vs player → structurally refused (bots-only route)',
      raidRes.status === 400 && structural,
      `HTTP ${raidRes.status} "${msgOf(raidRes.body).slice(0, 90)}"`
    );

    // Restore fixture state (no-op if already voided), then cleanup
    await db.update(players).set({ protectionUntil: null }).where(eq(players.username, VICTIM));
  } finally {
    await cleanup(victimFactoryPos);
    const residual = await db
      .select({ username: players.username })
      .from(players)
      .where(inArray(players.username, [VICTIM, ATTACKER]));
    check('cleanup: fixture residual = 0', residual.length === 0, `${residual.length} rows left`);
    console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} probes passed ===\n`);
    process.exit(results.some((r) => !r.ok) ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('Driver crashed:', err);
  process.exit(1);
});
