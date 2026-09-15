/**
 * FID-20260914-008 Phases 1-2 — live end-to-end probe of the doctrine seams.
 *
 * HTTP legs (production routes only; fixtures are direct SQL, marked FIXTURE):
 *   1. Baseline infantry build (no doctrine)  → costPaid metal/energy = 200×2 = 400/400 exact
 *   2. Choose Offensive (RP 30 → 5, ledger entry balance 5) — the Phase-0-fixed path
 *   3. Doctrine build                         → costPaid metal = ceil(400 × 0.90) = 360 EXACT, energy unchanged
 *   4. Mastery earn hooks                     → +10/unit × 2 matching builds = xpProgress 20 (server-side)
 *   5. Mastery POST gate                      → player 403 (was: open exploit), admin-without-spec 400 (honest)
 *   6. Respec (switch): #1 succeeds (VERIFICATION FINDING: choose does not anchor
 *      the 48h cooldown — cooldown anchors to lastRespecAt only; economically
 *      harmless, recorded in the FID) → ledger 2nd entry −50, RP 5, resources
 *      −50k each, doctrine defensive, mastery reset; then fixture re-seed →
 *      respec #2 REJECTED with the cooldown message and NO partial apply
 *   7. Power seam (in-process calculatePlayerPower against the live DB the server wrote):
 *      P1 − P0 === floor(S1 × 1.15) − floor(S0 × 1.0) — doctrine STR term proven in the real code
 *
 * Cleanup: scripts/cleanupDoctrineProbe.ts (prefix 'spe%').
 * Run: npx tsx -r dotenv/config scripts/probeDoctrineSeams.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3002';
const PW = 'E2eDoctrine!Probe7';
const SUFFIX = Date.now().toString().slice(-7);

interface HttpResult {
  status: number;
  json: Record<string, unknown>;
  cookie?: string;
}

async function api(
  method: string,
  path: string,
  body: unknown,
  cookie?: string
): Promise<HttpResult> {
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
  const session = setCookies
    .map((c) => /darkframe_session=([^;]+)/.exec(c)?.[1])
    .find(Boolean);
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON body */
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

async function scalar(db: Awaited<ReturnType<typeof connectToDatabase>>, q: ReturnType<typeof sql>): Promise<Record<string, unknown>> {
  const r = await db.execute(q);
  return ((r.rows as Array<Record<string, unknown>>)[0]) ?? {};
}

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // ── 1. Register seller + buyer + admin ───────────────────────────────────
  const accounts = [
    { role: 'seller', u: `speSeller${SUFFIX}`, e: `spe-fid8-se-${SUFFIX}@test.local` },
    { role: 'buyer', u: `speBuyer${SUFFIX}`, e: `spe-fid8-by-${SUFFIX}@test.local` },
    { role: 'admin', u: `speAdmin${SUFFIX}`, e: `spe-fid8-ad-${SUFFIX}@test.local` },
  ];
  const jar: Record<string, string> = {};
  for (const a of accounts) {
    const reg = await api('POST', '/api/auth/register', { username: a.u, email: a.e, password: PW });
    check(
      `register ${a.role}`,
      reg.status >= 200 && reg.status < 300 && reg.json?.success === true && !!reg.cookie,
      reg.json
    );
    jar[a.role] = reg.cookie as string;
  }
  const seller = accounts[0].u;
  const buyer = accounts[1].u;
  const admin = accounts[2].u;

  // ── 2. FIXTURES ──────────────────────────────────────────────────────────
  // Factory claim (build-unit requires ≥1 owned factory): find an unowned tile.
  const tile = await scalar(db, sql`SELECT x, y FROM factories WHERE owner IS NULL ORDER BY x, y LIMIT 1`);
  check('unowned factory tile exists', tile.x !== undefined, tile);
  const fx = Number(tile.x);
  const fy = Number(tile.y);
  const claim = await scalar(
    db,
    sql`UPDATE factories SET owner = ${seller}, slots = 20, used_slots = 0, level = 1
        WHERE x = ${fx} AND y = ${fy} AND owner IS NULL
        RETURNING x, y, owner`
  );
  check('factory claim (seller)', claim.owner === seller, claim);

  // Seller: resources for builds, RP+level for the choose gate, non-admin.
  const seedSeller = await scalar(
    db,
    sql`UPDATE players SET resources_metal = 10000, resources_energy = 10000,
        research_points = 30, level = 15, is_admin = 0
        WHERE username = ${seller}
        RETURNING research_points, level, is_admin`
  );
  check('seed seller (RP 30 / L15 / non-admin)', Number(seedSeller.research_points) === 30 && Number(seedSeller.level) === 15 && Number(seedSeller.is_admin) === 0, seedSeller);

  // Buyer: RP 80 + resources 60k (choose 25 + respec 50; metal/energy respec costs 50k each).
  const seedBuyer = await scalar(
    db,
    sql`UPDATE players SET resources_metal = 60000, resources_energy = 60000,
        research_points = 80, level = 15, is_admin = 0
        WHERE username = ${buyer}
        RETURNING research_points, resources_metal`
  );
  check('seed buyer (RP 80 / 60k resources)', Number(seedBuyer.research_points) === 80 && Number(seedBuyer.resources_metal) === 60000, seedBuyer);

  const seedAdmin = await scalar(
    db,
    sql`UPDATE players SET is_admin = 1 WHERE username = ${admin} RETURNING is_admin`
  );
  check('seed admin (is_admin 1)', Number(seedAdmin.is_admin) === 1, seedAdmin);

  // ── 3. Baseline build — NO doctrine: exact undiscounted cost ──────────────
  // NOTE: BuildUnitSchema requires a `username` field; the route itself uses the
  // session identity only (FID-20260904-005 §5.1) — the field is schema-required
  // legacy shape and its value is irrelevant.
  const b1 = await api('POST', '/api/player/build-unit', { username: seller, unitTypeId: 'infantry', quantity: 2 }, jar.seller);
  check('baseline build 200', b1.status === 200, b1);
  const c1 = (b1.json?.costPaid ?? {}) as Record<string, unknown>;
  check('baseline cost EXACT 400/400 (mul 1.0)', Number(c1.metal) === 400 && Number(c1.energy) === 400, c1);
  const s0 = Number((await scalar(db, sql`SELECT total_strength FROM players WHERE username = ${seller}`)).total_strength);
  check('baseline units/strength written (S0 = 200)', s0 === 200, { s0 });

  // Power seam BEFORE doctrine (in-process, live DB the server wrote via HTTP).
  const { calculatePlayerPower } = await import('@/lib/factoryService');
  const p0 = await calculatePlayerPower(seller);
  console.log(`E2E ℹ power before doctrine P0 = ${p0} (S0 = ${s0})`);

  // ── 4. Choose Offensive — the Phase-0-fixed 500 → 200 path ───────────────
  const choose = await api('POST', '/api/specialization/choose', { doctrine: 'offensive' }, jar.seller);
  check('choose offensive 200', choose.status === 200 && choose.json?.success === true, choose.json);
  const afterChoose = await scalar(
    db,
    sql`SELECT research_points, specialization->>'doctrine' AS doctrine,
               rp_history->(-1)->>'amount' AS last_amount,
               rp_history->(-1)->>'balance' AS last_balance,
               jsonb_array_length(rp_history) AS ledger_len
        FROM players WHERE username = ${seller}`
  );
  check('choose deducted RP 30→5 with ledger entry (balance 5)',
    Number(afterChoose.research_points) === 5 && Number(afterChoose.last_amount) === -25 && Number(afterChoose.last_balance) === 5 && Number(afterChoose.ledger_len) === 1,
    afterChoose);
  check('doctrine persisted = offensive', afterChoose.doctrine === 'offensive', afterChoose);

  // ── 5. Doctrine build — Offensive metal discount −10% ────────────────────
  const b2 = await api('POST', '/api/player/build-unit', { username: seller, unitTypeId: 'infantry', quantity: 2 }, jar.seller);
  check('doctrine build 200', b2.status === 200, b2);
  const c2 = (b2.json?.costPaid ?? {}) as Record<string, unknown>;
  check('doctrine cost EXACT 360/400 (metal ceil(400×0.90), energy unchanged)',
    Number(c2.metal) === 360 && Number(c2.energy) === 400, c2);
  const s1 = Number((await scalar(db, sql`SELECT total_strength FROM players WHERE username = ${seller}`)).total_strength);
  check('S1 = 400', s1 === 400, { s1 });

  // Power seam AFTER doctrine: only the STR term multiplies, so the delta identity
  // is exact regardless of any additive terms in calculatePlayerPower.
  const p1 = await calculatePlayerPower(seller);
  const expectedDelta = Math.floor((s1 * 1.15)) - Math.floor((s0 * 1.0));
  check(`power seam doctrine delta exact (P1−P0 = ${p1 - p0} = floor(400×1.15)−200 = ${expectedDelta})`,
    p1 - p0 === expectedDelta, { p0, p1, s0, s1 });

  // ── 6. Mastery earn hooks — server-side only ──────────────────────────────
  // Baseline build: no doctrine → no XP. Doctrine build: 2 matching units × 10 = 20.
  const m1 = await api('GET', '/api/specialization/mastery', undefined, jar.seller);
  const mastery = (m1.json?.mastery ?? {}) as Record<string, unknown>;
  check('earned mastery XP = 20 (2 matching builds ×10, server-side)', Number(mastery.xpProgress) === 20 && Number(mastery.level) === 0, mastery);

  // The old exploit: direct POST from a player session must now 403.
  const exploit = await api('POST', '/api/specialization/mastery', { xpAmount: 1000, reason: 'probe exploit attempt' }, jar.seller);
  check('mastery POST as player REJECTED 403 (exploit closed)', exploit.status === 403, exploit);

  // Admin session passes the gate; the honest service refusal (no specialization) is 400.
  // Re-login AFTER the is_admin fixture: the register-time token carries a stale
  // isAdmin=false from the pre-fixture session (probe-verified failure).
  const adminLogin = await api('POST', '/api/auth/login', { email: accounts[2].e, password: PW });
  check('admin re-login (token refresh post-fixture)', adminLogin.status >= 200 && adminLogin.status < 300 && !!adminLogin.cookie, adminLogin.json);
  jar.admin = adminLogin.cookie as string;
  const adminPost = await api('POST', '/api/specialization/mastery', { xpAmount: 5, reason: 'probe admin gate' }, jar.admin);
  check('mastery POST as admin passes gate → honest 400 (admin has no specialization)', adminPost.status === 400, adminPost);

  // ── 7. Respec (switch) — cooldown reject, then cleared-path success ───────
  const chooseB = await api('POST', '/api/specialization/choose', { doctrine: 'offensive' }, jar.buyer);
  check('buyer choose offensive 200 (RP 80→55)', chooseB.status === 200 && chooseB.json?.success === true, chooseB.json);

  const switchImmediate = await api('POST', '/api/specialization/switch', { newDoctrine: 'defensive' }, jar.buyer);
  const immMsg = String(switchImmediate.json?.message ?? switchImmediate.json?.error ?? '');
  // VERIFICATION FINDING (recorded in FID-20260914-008 §addendum): the 48h cooldown
  // anchors ONLY to spec.lastRespecAt — the initial choose never sets it, so the
  // first respec is always immediately available. Docs' letter ("since last respec")
  // matches the code; economically harmless (a flip costs 50 RP + 100k resources);
  // recommendation recorded, semantics NOT changed mid-implementation.
  check('respec #1 succeeds (cooldown anchors to lastRespecAt only — finding)',
    switchImmediate.status === 200 && switchImmediate.json?.success === true && /respecialized/i.test(immMsg),
    { status: switchImmediate.status, immMsg });
  const afterRespec = await scalar(
    db,
    sql`SELECT research_points, resources_metal, resources_energy,
               specialization->>'doctrine' AS doctrine,
               specialization->>'masteryLevel' AS mastery_level,
               specialization->'lastRespecAt' IS NOT NULL AS has_anchor,
               rp_history->(-1)->>'amount' AS last_amount,
               rp_history->(-1)->>'balance' AS last_balance,
               jsonb_array_length(rp_history) AS ledger_len
        FROM players WHERE username = ${buyer}`
  );
  check('respec ledger entry #2 (−50, balance 5) + RP 55→5',
    Number(afterRespec.last_amount) === -50 && Number(afterRespec.last_balance) === 5 && Number(afterRespec.ledger_len) === 2 && Number(afterRespec.research_points) === 5,
    afterRespec);
  check('respec deducted 50k metal AND energy (10k left) and reset mastery to 0',
    Number(afterRespec.resources_metal) === 10000 && Number(afterRespec.resources_energy) === 10000 && Number(afterRespec.mastery_level) === 0,
    afterRespec);
  check('doctrine = defensive; lastRespecAt anchor written', afterRespec.doctrine === 'defensive' && afterRespec.has_anchor === true, afterRespec);

  // Cooldown machinery live: re-seed affordability (fixture), then respec #2 must
  // be REJECTED by the 48h cooldown with no partial apply (doctrine stays defensive).
  const reseed = await scalar(
    db,
    sql`UPDATE players SET research_points = 60, resources_metal = 60000, resources_energy = 60000
        WHERE username = ${buyer} RETURNING research_points`
  );
  check('re-seed buyer for cooldown probe', Number(reseed.research_points) === 60, reseed);
  const switchAgain = await api('POST', '/api/specialization/switch', { newDoctrine: 'tactical' }, jar.buyer);
  const errObj = (switchAgain.json?.error ?? {}) as Record<string, unknown>;
  const errDetails = (errObj.details ?? {}) as Record<string, unknown>;
  const againMsg = String(
    switchAgain.json?.message ??
      (typeof switchAgain.json?.error === 'string' ? switchAgain.json.error : errDetails.message ?? errObj.message) ?? ''
  );
  check('respec #2 REJECTED by 48h cooldown (machinery live)',
    (switchAgain.status >= 400 || switchAgain.json?.success === false) && /cooldown/i.test(againMsg),
    { status: switchAgain.status, againMsg });
  const postReject = await scalar(
    db,
    sql`SELECT specialization->>'doctrine' AS doctrine, research_points, resources_metal
        FROM players WHERE username = ${buyer}`
  );
  check('rejected respec left NO partial apply (doctrine/RP/resources untouched)',
    postReject.doctrine === 'defensive' && Number(postReject.research_points) === 60 && Number(postReject.resources_metal) === 60000,
    postReject);

  console.log(`\nE2E PASS — all doctrine seams verified live (fixtures: speSeller${SUFFIX} / speBuyer${SUFFIX} / speAdmin${SUFFIX})`);
  process.exit(0);
}

main().catch((e) => {
  console.log('E2E FAIL: unhandled error →', e);
  process.exit(1);
});
