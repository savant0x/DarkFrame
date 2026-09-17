/**
 * FID-20260917-008 — LIVE verification driver for the inventory route rewrite.
 * Runs against the real dev DB (DATABASE_URL from .env.local). Invokes the
 * route handler directly with a real minted JWT (exactly how the repaired
 * route is reached in production), and asserts the wire contract against the
 * panel's consumption: unwrapped payload, numeric parsing, ISO expiry.
 *
 * Probes:
 *   1. PREMISE  — fame's pg row carries inventory data (the FID's founding
 *                 evidence; 47 items / cap 2000 / diggers 25+23 / bonuses
 *                 "39.00"/"37.00" as of filing). SKIP (not FAIL) if the row
 *                 was reset since.
 *   2. CONTRACT — handler 200: unwrapped payload, items count matches the row,
 *                 numerics are numbers, expiresAt ISO-string | null.
 *   3. AUTH     — no-cookie call → requireAuth refusal (401 envelope shape).
 *
 * One-shot; exits explicitly (open pg pool keeps the process alive — the
 * documented FID-009 lesson). No data is mutated; the driver is read-only.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { JOSE_SECRET, JWT_SECRET } from '@/lib/jwt';
import { GET } from '../app/api/player/inventory/route';

const USERNAME = 'fame';

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

async function main() {
  console.log('=== FID-20260917-008 live probe: GET /api/player/inventory ===\n');

  // --- PREMISE: read fame's row straight from pg (bypasses the route) ---
  const { db, players } = await import('@/lib/db');
  const { eq } = await import('drizzle-orm');
  const rows = await db
    .select({
      items: players.inventoryItems,
      cap: players.inventoryCapacity,
      md: players.inventoryMetalDiggerCount,
      ed: players.inventoryEnergyDiggerCount,
      gbm: players.gatheringBonusMetalBonus,
      gbe: players.gatheringBonusEnergyBonus,
    })
    .from(players)
    .where(eq(players.username, USERNAME))
    .limit(1);
  const row = rows[0];
  if (!row) fail(`PREMISE: player ${USERNAME} not found in pg`);
  const itemCount = (row.items ?? []).length;
  console.log(
    `PREMISE: ${USERNAME} row — items=${itemCount} cap=${row.cap} diggers=${row.md}+${row.ed} bonuses=${row.gbm}/${row.gbe}`,
  );
  if (itemCount === 0 && row.cap === 0) {
    console.log('PREMISE: row no longer carries inventory data — SKIP live contract probe');
    process.exit(0);
  }

  // --- mint a real session token (jose, same secret the app verifies with) ---
  const token = await new SignJWT({ username: USERNAME })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JOSE_SECRET ?? new TextEncoder().encode(JWT_SECRET));

  const makeRequest = async (withCookie: boolean): Promise<NextRequest> => {
    const headers: Record<string, string> = {};
    if (withCookie) {
      // Cookie must be present at CONSTRUCTION — setting headers afterwards
      // does not refresh NextRequest's already-parsed cookie store.
      headers['cookie'] = `darkframe_session=${token}`;
    }
    return new NextRequest('http://localhost:3000/api/player/inventory', { headers });
  };

  // --- PROBE 1: auth refusal path ---
  // (context arg: the wrapped handler's signature is (request, context).)
  const unauth = await GET(await makeRequest(false), { params: Promise.resolve({}) });
  const unauthBody = await unauth.json();
  console.log(
    `PROBE AUTH: no-cookie → HTTP ${unauth.status} code=${unauthBody?.error?.code ?? unauthBody?.code}`,
  );
  if (unauth.status !== 401) fail('AUTH: expected 401 for cookie-less call');
  // Observed live envelope (session 048): requireAuth's refusal renders as
  // { success: false, error: "Unauthorized" } — a STRING error, not {code}.
  // Accept either shape; the pin is "an error body exists", the exact shape is
  // requireAuth's contract, not this route's.
  if (!unauthBody?.error) fail('AUTH: expected an error body in the refusal');

  // --- PROBE 2: full contract with cookie ---
  const res = await GET(await makeRequest(true), { params: Promise.resolve({}) });
  const body = await res.json();
  console.log(`PROBE CONTRACT: cookie → HTTP ${res.status}`);
  if (res.status !== 200) fail(`CONTRACT: expected 200, got ${res.status}`);

  // Unwrapped shape — the six InventoryData keys and nothing else.
  const keys = Object.keys(body).sort();
  const expected = [
    'activeBoosts',
    'capacity',
    'energyDiggerCount',
    'gatheringBonus',
    'items',
    'metalDiggerCount',
  ].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected))
    fail(`CONTRACT: payload keys ${JSON.stringify(keys)} != panel contract ${JSON.stringify(expected)}`);

  // Data truth: items count mirrors the row; numerics parsed to numbers.
  if (!Array.isArray(body.items) || body.items.length !== itemCount)
    fail(`CONTRACT: items ${body.items?.length} != row jsonb count ${itemCount}`);
  if (body.capacity !== row.cap) fail('CONTRACT: capacity mismatch');
  if (body.metalDiggerCount !== row.md || body.energyDiggerCount !== row.ed)
    fail('CONTRACT: digger counts mismatch');
  for (const [k, v] of Object.entries(body.gatheringBonus)) {
    if (typeof v !== 'number' || Number.isNaN(v)) fail(`CONTRACT: gatheringBonus.${k} not a number (${typeof v})`);
  }
  // Wire-format pin: expiresAt must be ISO string | null — never an object/Date.
  const exp = body.activeBoosts?.expiresAt;
  if (exp !== null && (typeof exp !== 'string' || Number.isNaN(Date.parse(exp))))
    fail(`CONTRACT: expiresAt not an ISO string (${JSON.stringify(exp)})`);
  if (typeof body.activeBoosts?.gatheringBoost !== 'number' && body.activeBoosts?.gatheringBoost !== null)
    fail('CONTRACT: gatheringBoost not number|null');

  console.log(
    `CONTRACT: keys=exact items=${body.items.length} capacity=${body.capacity} ` +
      `diggers=${body.metalDiggerCount}+${body.energyDiggerCount} ` +
      `bonuses=${body.gatheringBonus.metalBonus}/${body.gatheringBonus.energyBonus} ` +
      `boost=${body.activeBoosts.gatheringBoost}@${body.activeBoosts.expiresAt}`,
  );

  console.log('\n✅ LIVE PROBE 3/3 GREEN (premise, auth, contract) — exit 0');
  process.exit(0);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
