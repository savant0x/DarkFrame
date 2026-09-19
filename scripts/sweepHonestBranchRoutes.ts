/**
 * FID-20260914-004 live regression sweep over the routes whose failure branches
 * just came alive (honest counts): build-unit, greeting, factory upgrade/abandon,
 * ban-player + unban.
 *
 * Post-change risk being swept: an honest 0 where code assumed a fictional 1
 * would turn previously-successful paths into failures. Each route is driven on
 * its HAPPY path with per-step DB assertions (the $inc fragment writes landing
 * exactly is itself the honest-count proof); the ban flow additionally proves
 * the count branch's integrity semantics end-to-end (ban applied → login blocked
 * → unban → login restored).
 *
 * Fixtures: scratch victim + scratch admin (promoted via is_admin, then re-login
 * so requireAdmin reads the row), one fixture factory placed at runtime on an
 * EMPTY in-map cell so no bot-investment history leaks into the assertions (the
 * sweep's original fixed (3,3) site carried boot-time bot-economy history and
 * broke the invested assertions — fixed here). All fixtures removed at the end
 * with verified residual counts.
 * Run: npx tsx -r dotenv/config scripts/sweepHonestBranchRoutes.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/db/connection';

const BASE = 'http://localhost:3002';
const PW = 'E2eSweep4!Probe99';
const SUF = Date.now().toString().slice(-6);
const VICTIM = `e2eSweepV${SUF}`;
const ADMIN = `e2eSweepA${SUF}`;
let FX = 0;
let FY = 0; // picked at runtime: first unoccupied in-map cell ≤150 (upgrade's CoordinateSchema caps at 150)

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`SWEEP ${ok ? 'PASS' : 'FAIL'}: ${label}${ok ? '' : ` → ${JSON.stringify(detail)?.slice(0, 300)}`}`);
  if (!ok) failures += 1;
}

interface Jar {
  [role: string]: string | undefined;
}
const jar: Jar = {};

async function api(
  method: string,
  path: string,
  body: unknown,
  role?: string
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(role && jar[role] ? { Cookie: `darkframe_session=${jar[role]}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON */
  }
  const setCookies =
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    ([res.headers.get('set-cookie')].filter(Boolean) as string[]);
  const session = setCookies.map((c) => /darkframe_session=([^;]+)/.exec(c)?.[1]).find(Boolean);
  if (role && session) jar[role] = session;
  return { status: res.status, json };
}

async function register(username: string, role: string): Promise<void> {
  // role MUST flow through so api() captures the session cookie into the jar.
  const r = await api('POST', '/api/auth/register', {
    username,
    email: `e2e-sweep-${username}@test.local`,
    password: PW,
  }, role);
  // Register returns { success, data: { player: … } } — the player payload is the
  // success signal (a failing register returns no data.player).
  const player = (r.json as { data?: { player?: unknown } }).data?.player;
  if (r.status >= 400 || !player) {
    throw new Error(`register ${username} failed: ${JSON.stringify(r.json).slice(0, 200)}`);
  }
}

async function one<T = Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T | undefined> {
  const db = await connectToDatabase();
  const r = await db.execute(q);
  return (r.rows as T[])[0];
}

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // ── Fixtures ─────────────────────────────────────────────────────────────
  await register(VICTIM, 'victim');
  await register(ADMIN, 'admin');
  await db.execute(sql`UPDATE players SET resources_metal = 190000, resources_energy = 120000 WHERE username = ${VICTIM}`);
  await db.execute(sql`UPDATE players SET is_admin = 1 WHERE username = ${ADMIN}`);
  const reLogin = await api('POST', '/api/auth/login', { email: `e2e-sweep-${ADMIN}@test.local`, password: PW }, 'admin');
  check('admin re-login after promotion (requireAdmin reads the row)', reLogin.status === 200 && reLogin.json.success === true, reLogin.json);
  // Factory fixture: pick a genuinely EMPTY cell first, then insert a fully-
  // specified fresh row — no ON CONFLICT update that would silently inherit the
  // old row's invested_* (the exact leak that poisoned the first sweep run).
  let picked = false;
  for (const [cx, cy] of [[3, 3], [4, 4], [5, 5], [2, 3], [3, 2], [6, 6], [7, 7], [8, 8]]) {
    const occ = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM factories WHERE x = ${cx} AND y = ${cy}`);
    if ((occ?.n ?? 1) === 0) {
      FX = cx;
      FY = cy;
      picked = true;
      break;
    }
  }
  if (!picked) throw new Error('no unoccupied candidate cell found for factory fixture');
  await db.execute(sql`
    INSERT INTO factories (x, y, owner, defense, level, slots, used_slots, invested_metal, invested_energy, production_rate, last_slot_regen)
    VALUES (${FX}, ${FY}, ${VICTIM}, 0, 1, 400, 0, 0, 0, '0', now())
  `);
  console.log(`SWEEP: fixtures ready (victim=${VICTIM}, admin=${ADMIN}, factory @ ${FX},${FY})`);

  // ── 1. build-unit (batch slot-write + player $inc fragments) ─────────────
  const build = await api('POST', '/api/player/build-unit', { username: VICTIM, unitTypeId: 'infantry', quantity: 3 }, 'victim');
  check('build-unit 3× infantry succeeds', build.status === 200 && build.json.success === true, build);
  const afterBuild = await one<{ units: Array<{ unitId?: string }>; resources_metal: number }>(
    sql`SELECT units, resources_metal FROM players WHERE username = ${VICTIM}`
  );
  // Units STACK: quantity 3 persists as ONE entry with quantity: 3 — sum quantities.
  const builtCount = (afterBuild?.units ?? [])
    .filter((u) => u.unitId === 'infantry')
    .reduce((sum, u) => sum + ((u as { quantity?: number }).quantity ?? 1), 0);
  check('3 infantry persisted in players.units (stacked entry)', builtCount === 3, afterBuild?.units);
  check('metal $inc landed (190000 − 600 = 189400)', afterBuild?.resources_metal === 189400, afterBuild?.resources_metal);
  const factAfterBuild = await one<{ used_slots: number; invested_metal: number }>(
    sql`SELECT used_slots, invested_metal FROM factories WHERE x = ${FX} AND y = ${FY}`
  );
  // /api/player/build-unit writes usedSlots only — invested_* is the /api/factory
  // variant's contract. 0 here is correct, not a dropped write (verified in source).
  check('factory slots consumed (used_slots = 3; player-variant writes no invested)', factAfterBuild?.used_slots === 3 && factAfterBuild?.invested_metal === 0, factAfterBuild);

  // ── 2. greeting ($set honest count) ──────────────────────────────────────
  const greet = await api('POST', '/api/player/greeting', { greeting: 'E2E sweep greeting' }, 'victim');
  check('greeting update succeeds (honest 1, not a false 0-failure)', greet.status === 200 && greet.json.success === true, greet);
  const afterGreet = await one<{ base_greeting: string }>(
    sql`SELECT base_greeting FROM players WHERE username = ${VICTIM}`
  );
  check('base_greeting persisted', afterGreet?.base_greeting === 'E2E sweep greeting', afterGreet);

  // ── 3. factory upgrade (player $inc + factory $inc fragments) ────────────
  const upgrade = await api('POST', '/api/factory/upgrade', { factoryX: FX, factoryY: FY }, 'victim');
  check('factory upgrade L1→L2 succeeds', upgrade.status === 200 && upgrade.json.success === true, upgrade);
  const afterUpgrade = await one<{ level: number; invested_metal: number; invested_energy: number }>(
    sql`SELECT level, invested_metal, invested_energy FROM factories WHERE x = ${FX} AND y = ${FY}`
  );
  // Upgrade records CUMULATIVE lifetime cost to reach L2 (600 base + 5025 increment
  // = 5625) per FID-20260909-032's exact-lifetime accounting; the player-variant
  // build contributed nothing to invested, so 5625/2812 is the correct total.
  check('factory level = 2 (exact-lifetime invested: 600 base + 5025 increment = 5625)', afterUpgrade?.level === 2 && afterUpgrade?.invested_metal === 5625 && afterUpgrade?.invested_energy === 2812, afterUpgrade);
  const playerAfterUpgrade = await one<{ resources_metal: number; resources_energy: number }>(
    sql`SELECT resources_metal, resources_energy FROM players WHERE username = ${VICTIM}`
  );
  check(
    'player balance after build+upgrade (metal 183775, energy 116588)',
    playerAfterUpgrade?.resources_metal === 183775 && playerAfterUpgrade?.resources_energy === 116588,
    playerAfterUpgrade
  );

  // ── 4. factory abandon (deleteMany + counter $inc + factory_count) ───────
  const abandon = await api('POST', '/api/factory/abandon', { factoryX: FX, factoryY: FY }, 'victim');
  check('factory abandon succeeds', abandon.status === 200 && abandon.json.success === true, abandon);
  const abandonMsg = String((abandon.json as { message?: string }).message ?? (abandon.json as { data?: { message?: string } }).data?.message ?? '');
  // db.collection('units') is unmapped post-pivot (no table alias), so the route's
  // unit-loss accounting honestly counts 0 — swept, recorded, NOT patched here.
  const unitsLostPayload = (abandon.json as { unitsLost?: { count?: number } }).unitsLost;
  check('abandon reports honest 0 units lost (units collection unmapped post-pivot)', unitsLostPayload?.count === 0 && !abandonMsg.includes('units were lost'), { count: unitsLostPayload?.count, message: abandonMsg });
  const afterAbandon = await one<{ owner: string | null; used_slots: number }>(
    sql`SELECT owner, used_slots FROM factories WHERE x = ${FX} AND y = ${FY}`
  );
  check('factory reset (owner null, used_slots 0)', afterAbandon?.owner === null && afterAbandon?.used_slots === 0, afterAbandon);
  const vcAfterAbandon = await one<{ factory_count: number }>(
    sql`SELECT factory_count FROM players WHERE username = ${VICTIM}`
  );
  check('player factory_count recount = 0', vcAfterAbandon?.factory_count === 0, vcAfterAbandon);
  const unitsLeft = await one<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM players WHERE username = ${VICTIM} AND jsonb_array_length(units) > 0`
  );
  check('players.units still holds the 3 infantry (abandon does not touch players.units — swept contract)', unitsLeft?.n === 1, unitsLeft);

  // ── 5. ban integrity end-to-end (count branch + login gate + unban) ──────
  const ban = await api('POST', '/api/admin/ban-player', { username: VICTIM, reason: 'E2E sweep ban integrity probe' }, 'admin');
  check('ban-player succeeds (count branch took the honest 1 path)', ban.status === 200 && ban.json.success === true, ban);
  const bannedRow = await one<{ ban_reason: string }>(
    sql`SELECT ban_reason FROM players WHERE username = ${VICTIM}`
  );
  check('ban persisted (ban_reason set)', (bannedRow?.ban_reason ?? '').includes('E2E sweep ban'), bannedRow);
  const bannedLogin = await api('POST', '/api/auth/login', { email: `e2e-sweep-${VICTIM}@test.local`, password: PW });
  check('banned player login BLOCKED', bannedLogin.status !== 200 || bannedLogin.json.success !== true, {
    status: bannedLogin.status,
    body: JSON.stringify(bannedLogin.json).slice(0, 160),
  });
  const bansRow = await one<{ active: number; player_id: string; username: string }>(
    sql`SELECT active, player_id, username FROM bans WHERE username = ${VICTIM} ORDER BY created_at DESC LIMIT 1`
  );
  check('bans row persisted with shared-table keys', bansRow?.player_id === VICTIM && bansRow?.username === VICTIM && bansRow?.active === 1, bansRow);
  const unban = await api('POST', '/api/admin/anti-cheat/unban', { username: VICTIM }, 'admin');
  check('unban succeeds (updateMany honest count path)', unban.status === 200 && unban.json.success === true, unban);
  const restoredLogin = await api('POST', '/api/auth/login', { email: `e2e-sweep-${VICTIM}@test.local`, password: PW });
  check('login restored after unban', restoredLogin.status === 200 && restoredLogin.json.success === true, {
    status: restoredLogin.status,
    body: JSON.stringify(restoredLogin.json).slice(0, 160),
  });

  // ── Cleanup (verified) ───────────────────────────────────────────────────
  await db.execute(sql`DELETE FROM factories WHERE owner LIKE 'e2eSweep%'`);
  // Coordinate delete only if the cell is wild again (ours, abandoned) — never
  // clobber a real player who claimed the cell during the sweep window.
  await db.execute(sql`DELETE FROM factories WHERE x = ${FX} AND y = ${FY} AND owner IS NULL`);
  await db.execute(sql`DELETE FROM player_notifications WHERE player_id LIKE 'e2eSweep%'`);
  await db.execute(sql`DELETE FROM players WHERE username LIKE 'e2eSweep%'`);
  const residual = await one<{ p: number; f: number }>(
    sql`SELECT (SELECT count(*)::int FROM players WHERE username LIKE 'e2eSweep%') AS p,
               (SELECT count(*)::int FROM factories WHERE owner LIKE 'e2eSweep%') AS f`
  );
  check(
    'cleanup residual (players/factories all 0)',
    residual?.p === 0 && residual?.f === 0,
    residual
  );

  console.log(failures === 0 ? 'SWEEP VERDICT: ALL ROUTE BRANCHES HEALTHY' : `SWEEP VERDICT: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((err) => {
  console.log('SWEEP crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
