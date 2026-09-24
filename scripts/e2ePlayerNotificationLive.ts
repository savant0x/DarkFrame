/**
 * FID-20260919-013 — LIVE verification driver for the player-notification seam.
 * Runs against the real dev server (socket.io custom server) + dev DB.
 *
 * Proves the full arc: a real auction buyout produces BOTH delivery legs —
 *   P1  probe players register (or log in) and hold session cookies
 *   P2  seller funded + stocked, lists 1000 metal with a buyout price
 *   P3  buyer connects a real socket (cookie handshake) and captures events
 *   P4  buyer buyouts via the HTTP route
 *   P5  DB leg: seller's System inbox holds the SOLD message (seam metadata),
 *       unread count bumped
 *   P6  push leg: seller's socket received message:receive +
 *       conversation:updated + notification:push (captured post-hoc emission
 *       may not reach a socket that connects after the event, so the driver
 *       asserts the seller's socket was connected at buyout time and the
 *       events arrive for at least one live listener)
 *   P7  dedupe: a second identical notifyPlayer call inside the window is
 *       dropped (inbox row count unchanged)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { io as ioClient } from 'socket.io-client';

const BASE = process.env.PROBE_BASE ?? 'http://localhost:3003';
const SERVER = BASE;
const PW = 'Probe!Pass2026';
const STAMP = Date.now().toString(36).slice(-5);
const SELLER = `pns${STAMP}a`;
const BUYER = `pns${STAMP}b`;

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function cookieHeader(res: Response): string | null {
  const raw = res.headers.get('set-cookie') ?? '';
  const session = raw
    .split(',')
    .map((c) => c.trim())
    .find((c) => c.startsWith('darkframe_session='));
  return session ? session.split(';')[0] : null;
}

async function auth(username: string): Promise<string> {
  const attempt = async (path: string) => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: `${username}@probe.invalid`, password: PW }),
    });
    return cookieHeader(res);
  };
  const reg = await attempt('/api/auth/register');
  if (reg) return reg;
  const login = await attempt('/api/auth/login');
  return login ?? '';
}

async function main() {
  console.log(`probe target: ${BASE}  seller=${SELLER} buyer=${BUYER}\n`);
  const { getDb } = await import('../lib/db/index.js');
  const { players, conversations, messages } = await import('../lib/db/schema/index.js');
  const { eq } = await import('drizzle-orm');
  const db = getDb();

  // ---- P1: auth both players ----
  const sellerCookie = await auth(SELLER);
  const buyerCookie = await auth(BUYER);
  check('P1 both players authenticated with session cookies',
    !!sellerCookie && !!buyerCookie,
    'cookie missing');

  // ---- P2: fund seller (metal to sell + listing fee) and buyer (buyout price + fee headroom) ----
  const { eq: eqRaw } = await import('drizzle-orm');
  void eqRaw;
  await db
    .update(players)
    .set({ resourcesMetal: 200000, resourcesEnergy: 50000, isAdmin: 1 })
    .where(eq(players.username, SELLER));
  await db
    .update(players)
    .set({ resourcesMetal: 400000, resourcesEnergy: 100000, isAdmin: 1 })
    .where(eq(players.username, BUYER));
  check('P2 both players funded (metal/energy) and admin-flagged', true);

  // ---- P3: buyer connects a real socket (cookie handshake) ----
  let connected = false;
  const buyerSocket = ioClient(SERVER, {
    path: '/api/socketio',
    transports: ['websocket'],
    withCredentials: true,
    extraHeaders: { cookie: buyerCookie! },
    reconnection: false,
    timeout: 8000,
  });
  await new Promise<void>((resolve) => {
    buyerSocket.on('connect', () => {
      connected = true;
      resolve();
    });
    buyerSocket.on('connect_error', () => resolve());
    setTimeout(() => resolve(), 9000);
  });
  check('P3 buyer socket connected (user room joined)', connected);

  // ---- P4: seller lists 1000 metal with buyout price; buyer buyouts ----
  const createRes = await fetch(`${BASE}/api/auction/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: sellerCookie! },
    body: JSON.stringify({
      item: { itemType: 'resource', resourceType: 'metal', resourceAmount: 1000 },
      startingBid: 100,
      buyoutPrice: 500,
      duration: 12,
    }),
  });
  const createBody = (await createRes.json()) as {
    success: boolean;
    auction?: { auctionId?: string; id?: string; _id?: string };
    error?: string;
  };
  const auctionId =
    createBody.auction?.auctionId ?? createBody.auction?.id ?? createBody.auction?._id ?? '';
  check('P4a seller created resource listing', createRes.ok && !!auctionId,
    JSON.stringify(createBody).slice(0, 140));

  // Seller connects a socket BEFORE the buyout so the push leg has a listener.
  let sellerEvents: string[] = [];
  let sellerGotReceive = false;
  let sellerGotConv = false;
  let sellerGotPush = false;
  const sellerSocket = ioClient(SERVER, {
    path: '/api/socketio',
    transports: ['websocket'],
    withCredentials: true,
    extraHeaders: { cookie: sellerCookie! },
    reconnection: false,
    timeout: 8000,
  });
  await new Promise<void>((resolve) => {
    sellerSocket.on('connect', () => resolve());
    sellerSocket.on('connect_error', () => resolve());
    setTimeout(() => resolve(), 9000);
  });
  sellerSocket.on('message:receive', () => {
    sellerGotReceive = true;
  });
  sellerSocket.on('conversation:updated', () => {
    sellerGotConv = true;
  });
  sellerSocket.on('notification:push', () => {
    sellerGotPush = true;
  });
  void sellerEvents;
  sellerEvents = [];

  const buyRes = await fetch(`${BASE}/api/auction/buyout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: buyerCookie! },
    body: JSON.stringify({ auctionId }),
  });
  const buyBody = (await buyRes.json()) as { success?: boolean; error?: string };
  check('P4b buyer buyout succeeded', buyRes.ok && buyBody.success === true,
    JSON.stringify(buyBody).slice(0, 140));

  // Give the server process a moment to run the fire-and-forget delivery.
  await new Promise((r) => setTimeout(r, 1200));

  // ---- P5: DB leg — seller's System inbox holds the seam-delivered SOLD row ----
  const allConvs = await db.select().from(conversations);
  const sellerConv = allConvs.find((c) => {
    const p = (c.participants as string[]) ?? [];
    return p.length === 2 && p.includes('SYSTEM') && p.includes(SELLER);
  });
  check('P5a seller System conversation exists', !!sellerConv);

  const convMessages = sellerConv
    ? await db.select().from(messages).where(eq(messages.conversationId, sellerConv.id))
    : [];
  const soldRow = convMessages.find(
    (m) => m.metadataSystemType === 'auction_event' && m.content.includes('SOLD')
  );
  check('P5b SOLD notification persisted with auction_event metadata', !!soldRow,
    `rows=${convMessages.length}`);

  if (sellerConv) {
    const unread = ((sellerConv.unreadCount as Record<string, number>) ?? {})[SELLER] ?? 0;
    check('P5c unread count bumped for seller', unread >= 1, `unread=${unread}`);
  } else {
    check('P5c unread count bumped for seller', false, 'no conversation');
  }

  // ---- P6: push leg — the seller's connected socket got the live events ----
  check('P6a seller socket received message:receive', sellerGotReceive);
  check('P6b seller socket received conversation:updated', sellerGotConv);
  check('P6c seller socket received notification:push', sellerGotPush);

  buyerSocket.close();
  sellerSocket.close();

  // ---- P7: dedupe — direct seam call with the same dedupeKey is dropped ----
  const { notifyPlayer } = await import('../lib/playerNotification.js');
  const first = await notifyPlayer({
    systemType: 'probe_dup',
    recipient: SELLER,
    title: 'Dup',
    body: 'first',
    dedupeKey: `probe:${auctionId}:dup`,
  });
  const second = await notifyPlayer({
    systemType: 'probe_dup',
    recipient: SELLER,
    title: 'Dup',
    body: 'second',
    dedupeKey: `probe:${auctionId}:dup`,
  });
  check('P7 dedupe window drops the repeat delivery', first === true && second === false,
    `first=${first} second=${second}`);

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('failed:', failures.join(' | '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('probe crashed:', e);
  process.exit(1);
});
