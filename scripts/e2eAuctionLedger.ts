/**
 * FID-20260914-003 live end-to-end verification against the real HTTP server.
 *
 * Flow: register 3 accounts (seller/bidder/buyer) → seed balances (UPDATE..RETURNING,
 * the same resources_metal column every escrow $inc touches) → tradeable-item canary
 * (FID finding 2 gate) → seller lists 1000 metal (24h, fee 150) → bidder bids 700
 * (escrow −700) → buyer buyouts 2000 → assert every ledger identity:
 *
 *   seller: 2000 − 1000 (goods escrowed AT LISTING) − 150 (listing fee)
 *           + 1900 (full payout at settle, 2000 − 5% sale fee)      = 2750
 *   bidder: 700 − 700 (escrow) + 700 (refund, leader≠buyer)      =  700
 *   buyer:  2000 − 2000 (buyout charge) + 1000 (delivered metal) = 1000
 *   Σ(final − initial) = −250 (pure fee burn — no mint: escrow-at-list
 *   means the goods transfer seller→buyer, fees are the only burn)
 *
 * DB access is read-only (SELECTs); ALL money mutations ride the production HTTP
 * routes except the initial balance seeding, which is the test fixture.
 * Run: E2E_COOKIES=0 npx tsx -r dotenv/config scripts/e2eAuctionLedger.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3002';
const PW = 'E2eFid3!Probe99';
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

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // ── 1. Register seller / bidder / buyer ──────────────────────────────────
  const accounts = [
    { role: 'seller', u: `e2eSeller${SUFFIX}`, e: `e2e-fid3-s-${SUFFIX}@test.local` },
    { role: 'bidder', u: `e2eBidder${SUFFIX}`, e: `e2e-fid3-b-${SUFFIX}@test.local` },
    { role: 'buyer', u: `e2eBuyer${SUFFIX}`, e: `e2e-fid3-x-${SUFFIX}@test.local` },
  ];
  const jar: Record<string, string> = {};
  for (const a of accounts) {
    const reg = await api('POST', '/api/auth/register', {
      username: a.u,
      email: a.e,
      password: PW,
    });
    if (reg.status !== 200 && reg.json?.success !== true) {
      fail(`register ${a.role}`, { status: reg.status, json: reg.json });
    }
    if (!reg.cookie) fail(`register ${a.role} set-cookie`, reg.json);
    jar[a.role] = reg.cookie as string;
    console.log(`E2E registered ${a.role}=${a.u}`);
  }

  // ── 2. Seed balances (fixture; RETURNING gives exact written truth) ─────
  const seeds: Record<string, number> = { seller: 2000, bidder: 700, buyer: 2000 };
  const initial: Record<string, number> = {};
  for (const a of accounts) {
    const want = seeds[a.role];
    const r = await db.execute(
      sql`UPDATE players SET resources_metal = ${want} WHERE username = ${a.u} RETURNING resources_metal`
    );
    const got = Number((r.rows as Array<{ resources_metal: number }>)[0]?.resources_metal);
    if (got !== want) fail(`seed ${a.role}`, { want, got });
    initial[a.role] = got;
  }
  console.log(`E2E seeded balances: ${JSON.stringify(initial)}`);

  // ── 3. Canary: tradeable_item listing must be rejected pre-fee (FID #2) ─
  const canary = await api(
    'POST',
    '/api/auction/create',
    {
      item: { itemType: 'tradeable_item', tradeableItemQuantity: 5 },
      startingBid: 100,
      duration: 24,
    },
    jar.seller
  );
  const canaryBlocked = canary.json?.success === false || canary.status >= 400;
  console.log(
    `E2E canary tradeable gate → blocked=${canaryBlocked} status=${canary.status} body=${JSON.stringify(canary.json).slice(0, 200)}`
  );
  if (!canaryBlocked) fail('tradeable gate did NOT block a tradeable_item listing', canary.json);

  // ── 4. Seller lists 1000 metal, 24h, buyout 2000 ─────────────────────────
  const created = await api(
    'POST',
    '/api/auction/create',
    {
      item: { itemType: 'resource', resourceType: 'metal', resourceAmount: 1000 },
      startingBid: 100,
      buyoutPrice: 2000,
      duration: 24,
    },
    jar.seller
  );
  if (created.json?.success !== true) fail('create listing', { status: created.status, json: created.json });
  const auction = created.json.auction as { auctionId?: string } | undefined;
  const auctionId = auction?.auctionId;
  if (!auctionId) fail('create listing returned no auctionId', created.json);
  console.log(`E2E listing created auctionId=${auctionId}`);

  // ── 5. Bidder bids 700 (escrow −700) ─────────────────────────────────────
  const bid = await api(
    'POST',
    '/api/auction/bid',
    { auctionId, bidAmount: 700 },
    jar.bidder
  );
  if (bid.json?.success !== true) fail('bid', { status: bid.status, json: bid.json });
  console.log(`E2E bid 700 accepted → ${JSON.stringify(bid.json).slice(0, 160)}`);

  // ── 6. Buyer buyouts 2000 ────────────────────────────────────────────────
  const buyout = await api('POST', '/api/auction/buyout', { auctionId }, jar.buyer);
  if (buyout.json?.success !== true)
    fail('buyout', { status: buyout.status, json: buyout.json });
  console.log(`E2E buyout accepted → ${JSON.stringify(buyout.json).slice(0, 160)}`);

  // ── 7. Ledger assertions (read-only) ─────────────────────────────────────
  const expectedFinal: Record<string, number> = {
    seller: 2000 - 1000 - 150 + 1900, // 2750 (escrow at listing → full payout at settle)
    bidder: 700 - 700 + 700, //        700
    buyer: 2000 - 2000 + 1000, //     1000
  };
  let sumDelta = 0;
  const actualFinal: Record<string, number> = {};
  for (const a of accounts) {
    const r = await db.execute(
      sql`SELECT resources_metal FROM players WHERE username = ${a.u}`
    );
    const metal = Number((r.rows as Array<{ resources_metal: number }>)[0]?.resources_metal);
    actualFinal[a.role] = metal;
    sumDelta += metal - initial[a.role];
    if (metal !== expectedFinal[a.role]) {
      fail(`balance ${a.role}`, { expected: expectedFinal[a.role], actual: metal });
    }
    console.log(`E2E balance ${a.role}: ${initial[a.role]} → ${metal} ✓`);
  }

  const auctionRow = await db.execute(
    sql`SELECT status, current_bid, current_bidder, highest_bidder, winner_username, final_price, settled FROM auctions WHERE auction_id = ${auctionId}`
  );
  const row = (auctionRow.rows as Array<Record<string, unknown>>)[0];
  if (!row) fail('auction row missing', { auctionId });
  const rowOk =
    String(row.status).toLowerCase() === 'sold' &&
    Number(row.final_price) === 2000 &&
    row.winner_username === accounts[2].u &&
    row.highest_bidder === accounts[1].u &&
    Number(row.settled) === 1;
  if (!rowOk) fail('auction row closed-state', row);
  console.log(`E2E auction row → ${JSON.stringify(row)}`);

  const tradeRow = await db.execute(
    sql`SELECT trade_id, seller_username, buyer_username, final_price, sale_fee, seller_received, trade_type FROM trade_history WHERE auction_id = ${auctionId}`
  );
  const trade = (tradeRow.rows as Array<Record<string, unknown>>)[0];
  if (!trade) fail('trade_history row missing', { auctionId });
  const tradeOk =
    trade.seller_username === accounts[0].u &&
    trade.buyer_username === accounts[2].u &&
    Number(trade.final_price) === 2000 &&
    Number(trade.sale_fee) === 100 &&
    Number(trade.seller_received) === 1900;
  if (!tradeOk) fail('trade_history row', trade);
  console.log(`E2E trade row → ${JSON.stringify(trade)}`);

  // Global conservation: every $inc that ran must net to fee burn + delivery mint.
  const expectedSumDelta = -250;
  if (sumDelta !== expectedSumDelta) {
    fail('global escrow conservation', { sumDelta, expectedSumDelta });
  }
  console.log(
    `E2E conservation: Σ(final−initial) = ${sumDelta} = pure fee burn (150 listing + 100 sale), zero mint ✓`
  );

  console.log(
    `E2E PASS — retained identifiers: auction=${auctionId} trade=${String(trade.trade_id)} accounts=${accounts.map((a) => a.u).join(',')}`
  );
  process.exit(0);
}

void main().catch((err) => {
  console.log('E2E crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
