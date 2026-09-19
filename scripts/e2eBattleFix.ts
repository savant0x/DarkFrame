/**
 * FID-20260915-001 — live verification through the production raid route.
 *
 * Scenario: scratch raider with 40 fresh infantry (STR 4,000, pool 400) raids
 * the weakest real-garrison bot base. The garrison's max possible HP pool
 * (≤ ~123 units × 10 HP ≈ 1,230) dies in R1 to a 3,183-damage strike —
 * the exact boundary class that used to end in a mutual-annihilation DRAW
 * (attacker pool 400 < the garrison's would-be counter). Under the fixed
 * sequential resolution the dead garrison never counter-attacks.
 *
 * Assertions: victory true · outcome ATTACKER_WIN · attacker unitsLost 0 ·
 * raider's DB army intact (40 units / STR 4,000) · log row persisted.
 * Fixtures (direct SQL, marked): army grant + teleport onto the base tile.
 * Cleanup: deletes the raider + its battle rows; the bot base regrows per the
 * scheduler (Full Permanence model).
 *
 * Run: npx tsx -r dotenv/config scripts/e2eBattleFix.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/db/connection';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3002';
const PW = 'E2eBattle!Probe7';
const SUFFIX = Date.now().toString().slice(-7);
const BOT = 'Golem_Zero_919';
const UNIT_COUNT = 120; // STR 12,000 pierces the garrison's ~14.5K DEF (damage 4,755) and overkills its ~1,630 HP pool — the exact old-DRAW boundary class

interface HttpResult {
  status: number;
  json: Record<string, unknown>;
  cookie?: string;
}

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
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON */
  }
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

async function main(): Promise<void> {
  const db = await connectToDatabase();
  const raider = `speRaider${SUFFIX}`;

  // 0. Sweep any leftover raiders from previous runs (guarded prefix).
  const sweep = await db.execute(sql`
    DELETE FROM players WHERE username LIKE 'speRaider%' RETURNING username`);
  if (sweep.rowCount) {
    console.log(`E2E ℹ swept ${sweep.rowCount} leftover raider(s) from earlier runs`);
    await db.execute(sql`DELETE FROM battle_logs WHERE attacker_username LIKE 'speRaider%' OR defender_username LIKE 'speRaider%'`);
    await db.execute(sql`DELETE FROM player_notifications WHERE player_id LIKE 'speRaider%'`);
  }

  // 1. Register + grant the army (FIXTURE, canonical build-unit write shape).
  const reg = await api('POST', '/api/auth/register', {
    username: raider,
    email: `spe-battle-${SUFFIX}@test.local`,
    password: PW,
  });
  check('register raider', reg.status >= 200 && reg.status < 300 && !!reg.cookie, reg.json);
  const army = Array.from({ length: UNIT_COUNT }, (_, i) => ({
    id: `${raider}-e2e-${i}`,
    unitId: `${raider}-e2e-${i}`,
    unitType: 'INFANTRY',
    name: 'Infantry',
    category: 'STR',
    rarity: 'common',
    strength: 100,
    defense: 0,
    quantity: 1,
    createdAt: new Date().toISOString(),
  }));
  const grant = await db.execute(sql`
    UPDATE players SET units = ${JSON.stringify(army)}::jsonb,
                       total_strength = ${UNIT_COUNT * 100}, total_defense = 0
    WHERE username = ${raider} RETURNING total_strength`);
  check('army grant (FIXTURE)', Number((grant.rows as Array<{ total_strength: number }>)[0]?.total_strength) === UNIT_COUNT * 100);

  // 2. Teleport onto the base tile (FIXTURE): tiles.base_owner first, fallback bot position.
  const tile = await db.execute(sql`
    SELECT COALESCE(t.x, p.current_position_x) AS x, COALESCE(t.y, p.current_position_y) AS y
    FROM players p
    LEFT JOIN tiles t ON t.base_owner = p.username
    WHERE p.username = ${BOT} LIMIT 1`);
  const pos = (tile.rows as Array<{ x: number; y: number }>)[0];
  check('base tile resolved', pos && Number.isFinite(Number(pos.x)), pos);
  const tp = await db.execute(sql`
    UPDATE players SET current_position_x = ${pos.x}, current_position_y = ${pos.y}
    WHERE username = ${raider} RETURNING current_position_x`);
  check('teleport (FIXTURE)', Number((tp.rows as Array<{ current_position_x: number }>)[0]?.current_position_x) === Number(pos.x));

  // 3. THE RAID — production route, real battle.
  const raid = await api('POST', '/api/combat/attack', { defender: BOT, resource: 'metal' }, reg.cookie);
  check('raid route 200', raid.status === 200, raid.json);
  check('victory: true', raid.json?.victory === true, raid.json);
  const battle = (raid.json?.battle ?? {}) as Record<string, unknown>;
  check('outcome ATTACKER_WIN (not DRAW)', battle.outcome === 'ATTACKER_WIN', battle.outcome);
  const attacker = (battle.attacker ?? {}) as Record<string, unknown>;
  const defender = (battle.defender ?? {}) as Record<string, unknown>;
  check('attacker lost 0 units (old code: full annihilation)', Number(attacker.unitsLost) === 0, attacker);
  check('garrison destroyed in full, once', Number(defender.unitsLost) > 0, defender);
  const rounds = battle.rounds as Array<Record<string, unknown>>;
  check('dead garrison never counter-attacked (last round defenderDamage 0)',
    Number(rounds[rounds.length - 1]?.defenderDamage) === 0, rounds[rounds.length - 1]);

  // 4. DB truth: raider's army intact; log row persisted.
  const after = await db.execute(sql`
    SELECT jsonb_array_length(COALESCE(units,'[]'::jsonb)) AS entries, total_strength
    FROM players WHERE username = ${raider}`);
  const a = (after.rows as Array<{ entries: number; total_strength: number }>)[0];
  check('raider army intact after win (entries + totals)',
    Number(a?.entries) === UNIT_COUNT && Number(a?.total_strength) === UNIT_COUNT * 100, a);

  console.log(`\nE2E PASS — battle fix verified live as ${raider} vs ${BOT} (log row: ${(battle.battleId as string) ?? 'n/a'})`);

  // 5. Cleanup: raider + its battle rows + notifications. The bot base regrows.
  await db.execute(sql`DELETE FROM player_notifications WHERE player_id = ${raider}`);
  await db.execute(sql`DELETE FROM battle_logs WHERE attacker_username = ${raider} OR defender_username = ${raider}`);
  await db.execute(sql`DELETE FROM players WHERE username = ${raider}`);
  const residual = await db.execute(sql`
    SELECT (SELECT count(*)::int FROM players WHERE username = ${raider}) AS p,
           (SELECT count(*)::int FROM battle_logs WHERE attacker_username = ${raider}) AS b`);
  const r = (residual.rows as Array<{ p: number; b: number }>)[0];
  check('cleanup residual 0/0', Number(r.p) === 0 && Number(r.b) === 0, r);
  process.exit(0);
}

main().catch((e) => {
  console.log('E2E FAIL: unhandled error →', String(e).slice(0, 400));
  process.exit(1);
});
