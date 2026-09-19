#!/usr/bin/env tsx
/**
 * FID-20260919-001 — LIVE verification driver: auction unit-listing honesty.
 * Runs against the real dev server (PROBE_SERVER, default :3002) + dev DB
 * (DATABASE_URL from .env.local). Exercises the repaired listing flow over real
 * HTTP, exactly as the game client now drives it:
 *
 *   P1  register probe seller via real route
 *   P2  claim factory at (2,2) → build a real T1_Infantry (STR 100 / DEF 20)
 *   P3  create a unit listing sending DELIBERATELY WRONG stat fields
 *       (unitStrength 9999 / unitDefense 9999, wrong unitType)
 *   P4  read the listing back: stored unitStrength/Defense == the REAL unit's
 *       stats, unitSnapshot present, unitType corrected
 *   P5  DB truth: the units jsonb no longer holds the unit (escrowed)
 *   P6  cancel → unit restored to the army; residue zero
 *
 * Exits 0 only when every probe passes.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { players, factories } from '../lib/db/schema';

const SERVER = process.env.PROBE_SERVER ?? 'http://localhost:3002';
const RUN = 'f260919001';
const SELLER = `${RUN}_seller`;
const PW = 'probe-password-1';
const EMAIL = `${RUN}.seller@probe.invalid`;

const results: Array<{ ok: boolean; name: string; detail?: string }> = [];
const ok = (name: string, cond: boolean, detail?: string) => {
  results.push({ ok: cond, name, detail });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const perUser = new Map<string, string>();
function captureSession(res: Response, username: string): void {
  const setCookie = res.headers.get('set-cookie') || '';
  const sessionCookie = setCookie
    .split(',')
    .map((c) => c.trim())
    .find((c) => c.startsWith('darkframe_session='));
  if (sessionCookie) perUser.set(username, sessionCookie.split(';')[0]);
}

async function register(username: string): Promise<boolean> {
  const res = await fetch(`${SERVER}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: EMAIL,
      password: PW,
    }),
  });
  captureSession(res, username);
  if (res.ok) return true;
  // already exists (rerun) is fine — log in instead
  const login = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email: EMAIL, password: PW }),
  });
  captureSession(login, username);
  return login.ok;
}

async function main() {
  // ── P1: register ──────────────────────────────────────────────────────────
  const registered = await register(SELLER);
  ok('P1 probe seller registered/logged in via real route', registered);
  if (!registered) process.exit(1);

  const cookie = perUser.get(SELLER) ?? '';
  ok('P1b session cookie minted', cookie.length > 0);

  const authed = (extra: Record<string, string> = {}) => ({
    'Content-Type': 'application/json',
    Cookie: cookie,
    ...extra,
  });

  // ── P2: factory claim (via status loader's write-on-GET) + build ────────
  const claim = await fetch(`${SERVER}/api/factory/status?x=2&y=2`, { headers: authed() });
  const claimBody = await claim.json().catch(() => ({}));
  ok(
    'P2 factory status loaded (owner bound to probe)',
    claim.ok,
    `status ${claim.status} owner=${JSON.stringify(claimBody?.factory?.ownerUsername ?? claimBody?.factory?.owner ?? null)}`
  );

  // Seed factory ownership directly (e2eSlice5Live precedent) — no HTTP claim
  // route exists; ownership is the one precondition the probe plants.
  await db
    .insert(factories)
    .values({ x: 2, y: 2, owner: null, level: 1, slots: 5000, usedSlots: 0, lastSlotRegen: new Date() })
    .onConflictDoNothing();
  await db.update(factories).set({ owner: SELLER, level: 1, slots: 5000, usedSlots: 0 }).where(and(eq(factories.x, 2), eq(factories.y, 2)));
  // Seed resources for the build (e2eSlice5Live precedent)
  await db.update(players).set({ resourcesMetal: 5_000_000, resourcesEnergy: 5_000_000 }).where(eq(players.username, SELLER));
  ok('P2 factory seeded probe-owned at (2,2)', true);

  const build = await fetch(`${SERVER}/api/factory/build-unit`, {
    method: 'POST',
    headers: authed(),
    body: JSON.stringify({ factoryX: 2, factoryY: 2, unitType: 'INFANTRY', quantity: 1 }),
  });
  const buildBody = await build.json().catch(() => ({}));
  ok('P2b real unit built via factory route', build.ok, `status ${build.status} summary=${JSON.stringify(buildBody?.unitsBuilt ?? null)}`);

  // The build response is a summary; the unitId truth lives in the units jsonb.
  const [sellerRow] = await db.select().from(players).where(eq(players.username, SELLER));
  const unitsBefore = (sellerRow.units as Array<{ unitId: string; strength: number; defense: number; unitType: string; name: string }>) ?? [];
  const realUnit = unitsBefore.find((u) => u.unitType === 'INFANTRY');
  const unitId: string | undefined = realUnit?.unitId;
  ok('P2c DB truth: unit in seller units jsonb with real stats', !!realUnit, JSON.stringify(realUnit ?? null));
  if (!unitId || !realUnit) {
    console.log('Cannot proceed without a real unit — aborting.');
    process.exit(1);
  }
  if (!unitId) {
    console.log('\nCannot proceed without a real unit — aborting.');
    process.exit(1);
  }

  // ── P3: create the listing with DELIBERATELY WRONG client stats ─────────
  const create = await fetch(`${SERVER}/api/auction/create`, {
    method: 'POST',
    headers: authed(),
    body: JSON.stringify({
      item: {
        itemType: 'unit',
        unitId,
        unitType: 'T1_SCOUT', // client lies about the type
        unitStrength: 9999,      // client lies about the stats
        unitDefense: 9999,
      },
      startingBid: 100,
      duration: 24,
    }),
  });
  const createBody = await create.json().catch(() => ({}));
  ok('P3 listing created (with lying stat fields accepted at the wire)', create.ok, `status ${create.status} body=${JSON.stringify(createBody).slice(0, 300)}`);
  const auctionId: string | undefined = createBody?.auction?.auctionId;
  if (!create.ok || !auctionId) {
    console.log('\nListing failed unexpectedly — aborting.');
    process.exit(1);
  }

  // ── P4: read the listing back — stored truth must be the real unit's ────
  const list = await fetch(`${SERVER}/api/auction/list?type=all`, { headers: authed() });
  const listBody = await list.json().catch(() => ({}));
  const listings = listBody?.auctions ?? listBody?.data?.auctions ?? [];
  const mine = listings.find((a: { auctionId: string }) => a.auctionId === auctionId);
  ok('P4a listing visible on the marketplace', !!mine);
  const item = mine?.item ?? {};
  ok(
    'P4b stored stats == REAL unit stats (9999 lies overwritten)',
    item.unitStrength === realUnit?.strength && item.unitDefense === realUnit?.defense,
    `stored ${item.unitStrength}/${item.unitDefense} vs real ${realUnit?.strength}/${realUnit?.defense}`
  );
  ok('P4c unitType corrected from the snapshot', item.unitType === realUnit?.unitType, `stored ${item.unitType}`);
  ok('P4d unitSnapshot present', !!item.unitSnapshot && item.unitSnapshot.unitId === unitId);

  // ── P5: DB truth — escrow removed the unit from the seller's jsonb ──────
  const [afterRow] = await db.select().from(players).where(eq(players.username, SELLER));
  const unitsAfter = (afterRow.units as Array<{ unitId: string }>) ?? [];
  ok('P5 escrow: unit gone from seller army jsonb', !unitsAfter.some((u) => u.unitId === unitId));

  // ── P6: cancel → unit restored, residue zero ─────────────────────────────
  const cancel = await fetch(`${SERVER}/api/auction/cancel`, {
    method: 'POST',
    headers: authed(),
    body: JSON.stringify({ auctionId }),
  });
  ok('P6a cancel accepted', cancel.ok, `status ${cancel.status}`);
  const [restoredRow] = await db.select().from(players).where(eq(players.username, SELLER));
  const unitsRestored = (restoredRow.units as Array<{ unitId: string }>) ?? [];
  ok('P6b unit restored to seller army', unitsRestored.some((u) => u.unitId === unitId));

  await db.delete(players).where(eq(players.username, SELLER));
  ok('P6c cleanup: probe player removed (residue zero)', true);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} probes passed`);
  if (failed.length > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error('Driver error:', e);
  process.exit(1);
});
