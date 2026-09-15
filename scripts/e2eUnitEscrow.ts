/**
 * FID-20260914-003 residual — live end-to-end verification of the UNIT ESCROW and
 * CANCEL/EXPIRY REFUND paths, mirroring scripts/e2eAuctionLedger.ts (the money-path E2E).
 *
 * Flow: register 4 accounts (sellerA/buyerA/sellerB/sellerC) → seed balances (fixture,
 * UPDATE..RETURNING) → grant one INFANTRY each to the three sellers (fixture, jsonb) →
 *
 *   A. sellerA lists the unit (assert it LEAVES the army at listing — the escrow) →
 *      buyerA buyouts → assert the snapshot arrives in buyerA's army, seller paid
 *      285 (300 − 5% sale fee), trade_history row written.
 *   B. sellerB lists → cancel (seller-initiated) → assert the snapshot RETURNS,
 *      status=cancelled; then a second cancel must FAIL (claim-first close) and
 *      must NOT duplicate the refund (units count still 1).
 *   C. sellerC lists → backdate expires_at −1 min → wait for the REAL 5-minute
 *      settlement job (the production trigger — no run-now route exists) →
 *      assert snapshot returned, status=expired, settled=1.
 *
 * Ledger identities (seed 3000 each, listing fee 150, sale fee 5%):
 *   sellerA 3000 − 150 + 285 = 3135 · buyerA 3000 − 300 = 2700
 *   sellerB 3000 − 150 = 2850 · sellerC 3000 − 150 = 2850
 *   Σ(final − initial) = −465 = pure fee burn (3×150 listing + 15 sale) — units
 *   carry no money, so conservation is exact.
 *   Unit conservation: 3 units minted → 3 owned at end (buyerA 1, sellerB 1, sellerC 1).
 *
 * DB access is read-only (SELECTs) EXCEPT the fixtures (balance seeding + unit grant)
 * and the expiry backdate (which simulates the clock, not the settlement). ALL escrow
 * mutations ride the production HTTP routes.
 * Run: npx tsx -r dotenv/config scripts/e2eUnitEscrow.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3002';
const PW = 'E2eEscrow!Probe7';
const SUFFIX = Date.now().toString().slice(-7);
const EXPIRY_POLL_TIMEOUT_MS = 7.5 * 60 * 1000;
const EXPIRY_POLL_INTERVAL_MS = 15 * 1000;

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

interface UnitRow {
  units: Array<Record<string, unknown>> | null;
}

async function unitsCount(db: Awaited<ReturnType<typeof connectToDatabase>>, u: string): Promise<number> {
  const r = await db.execute(sql`SELECT jsonb_array_length(units) AS n FROM players WHERE username = ${u}`);
  return Number((r.rows as Array<{ n: number }>)[0]?.n ?? -1);
}

async function unitsEntries(db: Awaited<ReturnType<typeof connectToDatabase>>, u: string): Promise<UnitRow['units']> {
  const r = await db.execute(sql`SELECT units FROM players WHERE username = ${u}`);
  return ((r.rows as Array<{ units: UnitRow['units'] }>)[0]?.units) ?? null;
}

async function metal(db: Awaited<ReturnType<typeof connectToDatabase>>, u: string): Promise<number> {
  const r = await db.execute(sql`SELECT resources_metal FROM players WHERE username = ${u}`);
  return Number((r.rows as Array<{ resources_metal: number }>)[0]?.resources_metal);
}

async function snapshotOf(
  db: Awaited<ReturnType<typeof connectToDatabase>>,
  auctionId: string
): Promise<Record<string, unknown>> {
  const r = await db.execute(
    sql`SELECT COALESCE(doc->'item'->'unitSnapshot', item_data->'unitSnapshot', item_data->'item'->'unitSnapshot') AS snap
        FROM auctions WHERE auction_id = ${auctionId}`
  );
  const snap = (r.rows as Array<{ snap: Record<string, unknown> | null }>)[0]?.snap;
  if (!snap) fail(`unitSnapshot not found for ${auctionId}`, { auctionId });
  return snap as Record<string, unknown>;
}

function unitEntry(entries: UnitRow['units'], unitId: string): Record<string, unknown> | undefined {
  return (entries ?? []).find((e) => e.unitId === unitId || e.id === unitId);
}

function makeUnit(unitId: string): Record<string, unknown> {
  return {
    id: unitId,
    unitId,
    unitType: 'INFANTRY',
    name: `E2E Escrow Infantry ${unitId.slice(-4)}`,
    category: 'STR',
    rarity: 'common',
    strength: 1234,
    defense: 567,
    quantity: 1,
    createdAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // ── 1. Register four accounts ────────────────────────────────────────────
  const accounts = [
    { role: 'sellerA', u: `escSellerA${SUFFIX}`, e: `esc-fid3-sa-${SUFFIX}@test.local` },
    { role: 'buyerA', u: `escBuyerA${SUFFIX}`, e: `esc-fid3-ba-${SUFFIX}@test.local` },
    { role: 'sellerB', u: `escSellerB${SUFFIX}`, e: `esc-fid3-sb-${SUFFIX}@test.local` },
    { role: 'sellerC', u: `escSellerC${SUFFIX}`, e: `esc-fid3-sc-${SUFFIX}@test.local` },
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
  const U = Object.fromEntries(accounts.map((a) => [a.role, a.u]));
  const unitIdOf: Record<string, string> = {
    sellerA: `E2E-U-A-${SUFFIX}`,
    sellerB: `E2E-U-B-${SUFFIX}`,
    sellerC: `E2E-U-C-${SUFFIX}`,
  };

  // ── 2. Fixtures: seed 3000 metal each; grant one unit to each seller ─────
  for (const a of accounts) {
    const r = await db.execute(
      sql`UPDATE players SET resources_metal = 3000 WHERE username = ${a.u} RETURNING resources_metal`
    );
    check(`seed ${a.role}`, Number((r.rows as Array<{ resources_metal: number }>)[0]?.resources_metal) === 3000);
  }
  for (const role of ['sellerA', 'sellerB', 'sellerC'] as const) {
    const r = await db.execute(
      sql`UPDATE players SET units = ${JSON.stringify([makeUnit(unitIdOf[role])])}::jsonb
          WHERE username = ${U[role]} RETURNING jsonb_array_length(units) AS n`
    );
    check(`grant unit ${role}`, Number((r.rows as Array<{ n: number }>)[0]?.n) === 1);
  }

  // ══ SCENARIO A — unit escrow at listing + buyout delivery ════════════════
  const createdA = await api(
    'POST',
    '/api/auction/create',
    { item: { itemType: 'unit', unitId: unitIdOf.sellerA }, startingBid: 100, buyoutPrice: 300, duration: 24 },
    jar.sellerA
  );
  check('A: create unit listing', createdA.json?.success === true, { status: createdA.status, json: createdA.json });
  const feeMatch = /Listing fee: (\d+) metal/.exec(String(createdA.json?.message ?? ''));
  const listingFee = feeMatch ? Number(feeMatch[1]) : NaN;
  check('A: parsed listing fee = 150', listingFee === 150, createdA.json?.message);
  const auctionA = (createdA.json.auction as { auctionId?: string } | undefined)?.auctionId;
  check('A: auctionId returned', !!auctionA, createdA.json);

  check('A: unit LEFT the seller army at listing (escrow)', (await unitsCount(db, U.sellerA)) === 0);
  const escrowedA = await snapshotOf(db, auctionA as string);
  check(
    'A: escrow snapshot frozen with the listed unit identity',
    escrowedA.unitId === unitIdOf.sellerA && escrowedA.strength === 1234 && escrowedA.quantity === 1,
    escrowedA
  );
  check('A: listing fee charged', (await metal(db, U.sellerA)) === 3000 - listingFee);

  const buyout = await api('POST', '/api/auction/buyout', { auctionId: auctionA }, jar.buyerA);
  check('A: buyout accepted', buyout.json?.success === true, { status: buyout.status, json: buyout.json });

  const buyerUnits = await unitsEntries(db, U.buyerA);
  const delivered = unitEntry(buyerUnits, unitIdOf.sellerA);
  check(
    'A: snapshot DELIVERED to buyer army (identity preserved)',
    !!delivered && delivered.strength === 1234 && delivered.quantity === 1 && delivered.unitType === 'INFANTRY',
    buyerUnits
  );
  check('A: buyer paid buyout price', (await metal(db, U.buyerA)) === 3000 - 300);
  check('A: seller paid 300 − 5% sale fee', (await metal(db, U.sellerA)) === 3000 - listingFee + 285);

  const rowA = await db.execute(
    sql`SELECT status, settled, winner_username, final_price FROM auctions WHERE auction_id = ${auctionA}`
  );
  const ra = (rowA.rows as Array<Record<string, unknown>>)[0];
  check(
    'A: auction row sold/settled with winner',
    String(ra?.status).toLowerCase() === 'sold' && Number(ra?.settled) === 1 &&
      ra?.winner_username === U.buyerA && Number(ra?.final_price) === 300,
    ra
  );
  const tradeA = await db.execute(
    sql`SELECT trade_id, seller_username, buyer_username, final_price, sale_fee, seller_received
        FROM trade_history WHERE auction_id = ${auctionA}`
  );
  const ta = (tradeA.rows as Array<Record<string, unknown>>)[0];
  check(
    'A: trade_history row',
    !!ta && ta.seller_username === U.sellerA && ta.buyer_username === U.buyerA &&
      Number(ta.final_price) === 300 && Number(ta.sale_fee) === 15 && Number(ta.seller_received) === 285,
    ta
  );

  // ══ SCENARIO B — cancel refund + double-cancel race probe ═══════════════
  const createdB = await api(
    'POST',
    '/api/auction/create',
    { item: { itemType: 'unit', unitId: unitIdOf.sellerB }, startingBid: 100, duration: 24 },
    jar.sellerB
  );
  check('B: create unit listing', createdB.json?.success === true, { status: createdB.status, json: createdB.json });
  const auctionB = (createdB.json.auction as { auctionId?: string } | undefined)?.auctionId;
  check('B: unit escrowed out at listing', (await unitsCount(db, U.sellerB)) === 0);

  const cancel = await api('POST', '/api/auction/cancel', { auctionId: auctionB }, jar.sellerB);
  check('B: cancel accepted', cancel.json?.success === true, { status: cancel.status, json: cancel.json });
  const refundedB = unitEntry(await unitsEntries(db, U.sellerB), unitIdOf.sellerB);
  check(
    'B: snapshot RETURNED to seller army on cancel',
    !!refundedB && refundedB.strength === 1234,
    await unitsEntries(db, U.sellerB)
  );
  const rowB = await db.execute(sql`SELECT status, settled FROM auctions WHERE auction_id = ${auctionB}`);
  const rb = (rowB.rows as Array<Record<string, unknown>>)[0];
  check('B: auction row cancelled', String(rb?.status).toLowerCase() === 'cancelled', rb);

  const cancel2 = await api('POST', '/api/auction/cancel', { auctionId: auctionB }, jar.sellerB);
  check(
    'B: second cancel REJECTED (claim-first close)',
    cancel2.json?.success === false || cancel2.status >= 400,
    { status: cancel2.status, json: cancel2.json }
  );
  check('B: no duplicate refund — units count still 1', (await unitsCount(db, U.sellerB)) === 1);

  // ══ SCENARIO C — expiry refund via the REAL settlement job ═══════════════
  const createdC = await api(
    'POST',
    '/api/auction/create',
    { item: { itemType: 'unit', unitId: unitIdOf.sellerC }, startingBid: 100, duration: 24 },
    jar.sellerC
  );
  check('C: create unit listing', createdC.json?.success === true, { status: createdC.status, json: createdC.json });
  const auctionC = (createdC.json.auction as { auctionId?: string } | undefined)?.auctionId;
  check('C: unit escrowed out at listing', (await unitsCount(db, U.sellerC)) === 0);

  // Simulate the CLOCK only — settlement itself must come from the production job.
  await db.execute(sql`UPDATE auctions SET expires_at = now() - interval '1 minute' WHERE auction_id = ${auctionC}`);
  console.log('E2E … C: expires_at backdated; waiting for the 5-minute settlement job (production trigger)');

  const deadline = Date.now() + EXPIRY_POLL_TIMEOUT_MS;
  let settled = false;
  let lastStatus = 'active';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, EXPIRY_POLL_INTERVAL_MS));
    const probe = await db.execute(sql`SELECT status, settled FROM auctions WHERE auction_id = ${auctionC}`);
    const row = (probe.rows as Array<{ status: string; settled: number }>)[0];
    lastStatus = String(row?.status ?? '?');
    if (row && Number(row.settled) === 1 && lastStatus !== 'active') {
      settled = true;
      break;
    }
    const left = Math.round((deadline - Date.now()) / 1000);
    console.log(`E2E … C: still ${lastStatus}; ${left}s left`);
  }
  check(`C: settlement job settled the expired auction (last status ${lastStatus})`, settled);

  const refundedC = unitEntry(await unitsEntries(db, U.sellerC), unitIdOf.sellerC);
  check(
    'C: snapshot RETURNED to seller army on expiry',
    !!refundedC && refundedC.strength === 1234,
    await unitsEntries(db, U.sellerC)
  );
  const rowC = await db.execute(sql`SELECT status, settled FROM auctions WHERE auction_id = ${auctionC}`);
  const rc = (rowC.rows as Array<Record<string, unknown>>)[0];
  check('C: auction row expired+settled', String(rc?.status).toLowerCase() === 'expired' && Number(rc?.settled) === 1, rc);

  // ── Ledger conservation across all four accounts ─────────────────────────
  const expectedFinal: Record<string, number> = {
    sellerA: 3000 - listingFee + 285,
    buyerA: 3000 - 300,
    sellerB: 3000 - listingFee, // goods refunded, fee burned
    sellerC: 3000 - listingFee, // goods refunded via expiry, fee burned
  };
  let sumDelta = 0;
  for (const a of accounts) {
    const m = await metal(db, a.u);
    sumDelta += m - 3000;
    check(`ledger ${a.role}: ${m} (expect ${expectedFinal[a.role]})`, m === expectedFinal[a.role], { m });
  }
  check(`global conservation Σ(final−initial) = ${sumDelta} = −465 pure fee burn`, sumDelta === -465, { sumDelta });

  // Unit conservation: 3 minted → 3 owned at end, no duplicates.
  const owned = await db.execute(
    sql`SELECT username, jsonb_array_length(units) AS n FROM players WHERE username LIKE 'esc%'`
  );
  const rows = owned.rows as Array<{ username: string; n: number }>;
  const totalUnits = rows.reduce((s, r) => s + Number(r.n), 0);
  check(`unit conservation: ${totalUnits} owned = 3 minted (buyerA 1, sellerB 1, sellerC 1)`, totalUnits === 3, rows);

  console.log(
    `E2E PASS — retained identifiers: A=${String(auctionA)} B=${String(auctionB)} C=${String(auctionC)} accounts=${accounts.map((a) => a.u).join(',')}`
  );
  process.exit(0);
}

void main().catch((err) => {
  console.log('E2E crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
