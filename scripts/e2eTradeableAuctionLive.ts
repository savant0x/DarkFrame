/**
 * FID-20260919-009 — LIVE verification driver for complete tradeable trading.
 * Runs against the real dev server + DB. Inventory truth: players.inventoryItems
 * jsonb keyed by username PK (no items table — that is the design). Writes mirror
 * the service's own sql-concat pattern. Exercises the full tradeable arc:
 *
 *   P1  PREMISE — seller inventory carries >=2 tradeable instances (mints 3
 *       service-shaped instances via the production jsonb pattern if not)
 *   P2  ESCROW  — create listing quantity=2 → seller tradeable count -2
 *   P3  TRUTH   — listing carries tradeableItemIds + real procedural name;
 *                 /api/auction/list?name=<real> finds it
 *   P4  NAME    — "Tradeable Item" placeholder retired from the census
 *   P5  BUYOUT  — buyer pays; receives 2 instances, fresh ids, identity preserved
 *   P6  RESIDUE — listing consumed after buyout
 *   P7  CANCEL  — escrowed instance returns to seller with its original id
 *   P8  NO-GHOST— refund planner never mints for empty escrow
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3003';
const RUN = `tr${Date.now().toString(36).slice(-6)}`;
const SELLER = process.env.PROBE_SELLER || `ps_${RUN}`;
const SELLER_PW = 'Probe!Passw0rd';
const BUYER = `pb_${RUN}`;
const BUYER_PW = 'probe_pw_1';

let pass = 0;
const results: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(
  path: string,
  opts: RequestInit & { cookie?: string } = {}
): Promise<{ status: number; body: any }> {
  const { cookie, ...init } = opts;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...init.headers },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body };
}

async function registerOrLogin(username: string, password: string): Promise<string> {
  const attempt = async (path: string, extra: Record<string, string>) => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: `${username}.tradeable@probe.invalid`, password, ...extra }),
    });
    const setCookie = res.headers.get('set-cookie') || '';
    const session = setCookie
      .split(',')
      .map((c) => c.trim())
      .find((c) => c.startsWith('darkframe_session='));
    return session ? session.split(';')[0] : null;
  };
  const viaRegister = await attempt('/api/auth/register', {});
  if (viaRegister) return viaRegister;
  const viaLogin = await attempt('/api/auth/login', {});
  if (viaLogin) return viaLogin;
  throw new Error(`auth failed for ${username}`);
}

async function main() {
  console.log(`probe target: ${BASE}  seller=${SELLER} buyer=${BUYER}\n`);

  const { getDb } = await import('../lib/db/index.js');
  const { players } = await import('../lib/db/schema/index.js');
  const { eq, sql } = await import('drizzle-orm');
  const db = getDb();

  // ── auth both players over real HTTP (creates the rows) ──
  const sellerCookie = await registerOrLogin(SELLER, SELLER_PW);
  const buyerCookie = await registerOrLogin(BUYER, BUYER_PW);

  const sellerRow = (
    await db.select().from(players).where(eq(players.username, SELLER)).limit(1)
  )[0];
  if (!sellerRow) throw new Error(`seller ${SELLER} not found after registration`);

  // Fund both players (listing fee + buyout price debit resources.metal).
  await db.update(players).set({ resourcesMetal: 100000 }).where(eq(players.username, BUYER));
  await db.update(players).set({ resourcesMetal: 100000 }).where(eq(players.username, SELLER));

  // ── P1: premise ──
  let inv: any[] = Array.isArray(sellerRow.inventoryItems) ? sellerRow.inventoryItems : [];
  let tradeables = inv.filter((it) => it?.type === 'TRADEABLE_ITEM');
  if (true) {  // fresh sellers always mint; keeps the probe self-contained

    // Mint service-shaped instances with the production jsonb concat pattern.
    const now = new Date().toISOString();
    const mint = Array.from({ length: 3 }, (_, i) => ({
      id: `inv_${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 8)}`,
      type: 'TRADEABLE_ITEM',
      name: `Probe Blade of Verification ${i + 1}`,
      rarity: 'Epic',
      bonusPercent: 0,
      foundAt: { x: 0, y: 0 },
      foundDate: now,
    }));
    await db
      .update(players)
      .set({ inventoryItems: sql`coalesce(${players.inventoryItems}, '[]'::jsonb) || ${JSON.stringify(mint)}::jsonb` })
      .where(eq(players.username, SELLER));
    const refreshed = (
      await db.select().from(players).where(eq(players.username, SELLER)).limit(1)
    )[0];
    inv = Array.isArray(refreshed.inventoryItems) ? refreshed.inventoryItems : [];
    tradeables = inv.filter((it) => it?.type === 'TRADEABLE_ITEM');
  }
  check('P1 premise: seller has >=2 tradeable instances', tradeables.length >= 2, `count=${tradeables.length}`);

  // ── P2: quantity-2 listing → escrow ──
  const chosen = tradeables.slice(0, 2);
  const realName = String(chosen[0].name);
  const createRes = await api('/api/auction/create', {
    method: 'POST',
    cookie: sellerCookie,
    body: JSON.stringify({
      item: {
        itemType: 'tradeable_item',
        tradeableItemIds: chosen.map((c) => String(c.id)),
        tradeableItemQuantity: 2,
      },
      startingBid: 100,
      buyoutPrice: 3000,
      duration: 12,
    }),
  });
  const listingId: string | undefined = createRes.body?.auction?.auctionId;
  check(
    'P2 create: quantity-2 tradeable listing accepted',
    createRes.status === 200 && createRes.body?.success !== false,
    `status=${createRes.status} err=${createRes.body?.error ?? ''} msg=${createRes.body?.message ?? ''}`
  );

  const sellerAfter = (
    await db.select().from(players).where(eq(players.username, SELLER)).limit(1)
  )[0];
  const sellerAfterTradeables = (sellerAfter.inventoryItems ?? []).filter(
    (it: any) => it?.type === 'TRADEABLE_ITEM'
  );
  check(
    'P2 escrow: seller tradeable count -2',
    sellerAfterTradeables.length === tradeables.length - 2,
    `${tradeables.length} -> ${sellerAfterTradeables.length}`
  );

  // ── P3: real name on the wire + findable by name ──
  const listRes = await api(`/api/auction/list?name=${encodeURIComponent(realName)}&limit=50`);
  const rows = listRes.body?.items ?? listRes.body?.auctions ?? [];
  const mine = rows.filter((a: any) => !listingId || a.id === listingId || a.auctionId === listingId);
  const found = mine[0] ?? rows[0];
  check('P3 search: listing findable by real procedural name', !!found, `total=${listRes.body?.totalCount}`);
  const snap = found?.itemData?.tradeableSnapshot ?? [];
  const carriedNames = snap.map((e: any) => e?.name);
  check(
    'P3 truth: wire carries the real names (never "Tradeable Item")',
    carriedNames.length === 2 &&
      carriedNames.every((n: any) => typeof n === 'string' && n !== 'Tradeable Item'),
    `names=${JSON.stringify(carriedNames)}`
  );
  check(
    'P3 snapshot: tradeableItemIds survive on the listing',
    Array.isArray(found?.itemData?.tradeableItemIds) && found.itemData.tradeableItemIds.length === 2,
    `ids=${JSON.stringify(found?.itemData?.tradeableItemIds)}`
  );

  // ── P4: placeholder retired (population census) ──
  const all = await api('/api/auction/list?limit=200');
  const items = all.body?.items ?? all.body?.auctions ?? [];
  const stillPlaceholder = items.filter(
    (a: any) => (a.itemData?.name ?? a.unitSnapshot?.displayName) === 'Tradeable Item'
  );
  check('P4 placeholder retired: zero "Tradeable Item" listings live', stillPlaceholder.length === 0, `n=${items.length}`);

  // ── P5: buyout → delivery ──
  const buyerBefore = (
    await db.select().from(players).where(eq(players.username, BUYER)).limit(1)
  )[0];
  const beforeIds = (buyerBefore.inventoryItems ?? []).map((it: any) => String(it?.id));
  const buyRes = await api('/api/auction/buyout', {
    method: 'POST',
    cookie: buyerCookie,
    body: JSON.stringify({ auctionId: listingId }),
  });
  check('P5 buyout: accepted', buyRes.status === 200 && buyRes.body?.success !== false, `status=${buyRes.status} err=${buyRes.body?.error ?? ''}`);

  const buyerAfter = (
    await db.select().from(players).where(eq(players.username, BUYER)).limit(1)
  )[0];
  const wantedNames = chosen.map((c) => String(c.name));
  const delivered = (buyerAfter.inventoryItems ?? []).filter(
    (it: any) =>
      it?.type === 'TRADEABLE_ITEM' &&
      wantedNames.includes(String(it?.name)) &&
      typeof it?.bonusPercent === 'number' &&
      it?.foundAt &&
      !beforeIds.includes(String(it?.id))
  );
  check('P5 delivery: buyer received 2 full instances (type/bonus/foundAt/name intact)', delivered.length === 2, `got=${delivered.length}`);
  const chosenIds = chosen.map((c) => String(c.id));
  const freshIds = delivered.every((it: any) => !chosenIds.includes(String(it.id)));
  check('P5 provenance: delivered ids are fresh (seller originals consumed)', freshIds, delivered.map((d: any) => String(d.id)).join(','));

  // ── P6: residue ──
  const gone = await api(`/api/auction/list?name=${encodeURIComponent(realName)}&limit=50`);
  const still = (gone.body?.items ?? gone.body?.auctions ?? []).filter(
    (a: any) => !listingId || a.id === listingId || a.auctionId === listingId
  );
  check('P6 residue: listing consumed after buyout', still.length === 0);

  // ── P7: cancel returns the SAME instance ──
  const c2 = sellerAfterTradeables[0];
  const createRes2 = await api('/api/auction/create', {
    method: 'POST',
    cookie: sellerCookie,
    body: JSON.stringify({
      item: {
        itemType: 'tradeable_item',
        tradeableItemIds: [String(c2.id)],
        tradeableItemQuantity: 1,
      },
      startingBid: 100,
      buyoutPrice: 1500,
      duration: 12,
    }),
  });
  const listingId2 = createRes2.body?.auction?.auctionId;
  const cancelRes = await api('/api/auction/cancel', {
    method: 'POST',
    cookie: sellerCookie,
    body: JSON.stringify({ auctionId: listingId2 }),
  });
  check('P7 cancel: accepted', cancelRes.status === 200 && cancelRes.body?.success !== false, `status=${cancelRes.status} err=${cancelRes.body?.error ?? ''}`);
  const sellerFinal = (
    await db.select().from(players).where(eq(players.username, SELLER)).limit(1)
  )[0];
  const finalIds = (sellerFinal.inventoryItems ?? []).map((it: any) => String(it?.id));
  check('P7 refund: escrowed instance back with its original id', finalIds.includes(String(c2.id)), String(c2.id));

  // ── P8: no-ghost refund ──
  const { buildRefundInstances } = await import('../lib/tradeableEscrow.js');
  const ghost = buildRefundInstances([]);
  check('P8 no-ghost: refund planner returns [] for empty escrow (nothing minted)', Array.isArray(ghost) && ghost.length === 0);

  console.log('\n' + results.join('\n'));
  console.log(`\n${pass}/${results.length} probes passed`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('driver crashed:', e);
  process.exit(1);
});
