/**
 * FID-20260917-002 — live end-to-end verification of shrine presence enforcement
 * and trade/XP parity, mirroring scripts/e2eUnitEscrow.ts (the house E2E idiom).
 *
 * Flow: register one probe account → seed tradeables + position (fixtures, marked) →
 *   A. OFF-shrine activate → 400 with the verbatim presence message and ZERO
 *      mutation (inventory intact, no boost, no trade counted) — the FID's
 *      headline enforcement: the API no longer trusts the client's gate.
 *   B. ON-shrine (fixture moves the probe to 1,1) activate → 200, xpAwarded 40,
 *      stats.shrineTradeCount = 1, spade boost written, items pruned.
 *   C. boost-all → 200, xpAwarded 40 EXACTLY ONCE (operator ruling 2026-09-17:
 *      four suits are one transaction), shrineTradeCount = 2, all four tiers active.
 *
 * DB access is read-only (SELECTs) EXCEPT the marked fixtures (tradeable seeding,
 * position moves) and the guarded `shre2e%` sweep. ALL shrine mutations ride the
 * production HTTP routes.
 * Run: npx tsx -r dotenv/config scripts/e2eShrine.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

const BASE = process.env.E2E_BASE ?? 'http://localhost:3002';
const PW = 'E2eShrine!Probe7';
const SUFFIX = Date.now().toString().slice(-7);
const PREFIX = 'shre2e'; // guarded sweep prefix — this driver's fixtures only

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

interface ProbeRow {
  inventory_items: Array<Record<string, unknown>> | null;
  shrine_boosts: Array<Record<string, unknown>> | null;
  stats: { shrineTradeCount?: number } | null;
}

async function probeRow(
  db: Awaited<ReturnType<typeof connectToDatabase>>,
  u: string
): Promise<ProbeRow> {
  const r = await db.execute(
    sql`SELECT inventory_items, shrine_boosts, stats FROM players WHERE username = ${u}`
  );
  return (r.rows as unknown as Array<ProbeRow>)[0];
}

function tradeCount(row: ProbeRow): number {
  return Number(row.stats?.shrineTradeCount ?? 0);
}

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // ── 0. Guarded sweep of any prior shrine-E2E residue (this prefix only) ──
  await db.execute(sql`DELETE FROM players WHERE username LIKE ${PREFIX + '%'}`);
  const residual = await db.execute(
    sql`SELECT count(*)::int AS n FROM players WHERE username LIKE ${PREFIX + '%'}`
  );
  check('cleanup: zero shre2e% residual', Number((residual.rows as Array<{ n: number }>)[0]?.n) === 0);

  // ── 1. Register the probe account ─────────────────────────────────────────
  const username = `${PREFIX}P${SUFFIX}`; // ≤ 20 chars (username varchar limit)
  const email = `${PREFIX}-${SUFFIX}@test.local`;
  const reg = await api('POST', '/api/auth/register', { username, email, password: PW });
  check(
    'register probe account',
    reg.status >= 200 && reg.status < 300 && reg.json?.success === true && !!reg.cookie,
    reg.json
  );

  // ── 2. Fixtures (MARKED): 6 tradeable COMMON items; position off-shrine ──
  // Item shape mirrors what caveItemService writes (type/rarity enum values).
  const items = [0, 1, 2, 3, 4, 5].map((i) => ({
    id: `${PREFIX}-item-${SUFFIX}-${i}`,
    type: 'TRADEABLE_ITEM',
    name: `Probe Tradeable ${i}`,
    rarity: 'COMMON',
    bonusPercent: 0,
    foundAt: { x: 73, y: 70 },
    foundDate: new Date().toISOString(),
  }));
  const seeded = await db.execute(
    sql`UPDATE players SET inventory_items = ${JSON.stringify(items)}::jsonb
        WHERE username = ${username} RETURNING jsonb_array_length(inventory_items) AS n`
  );
  check('fixture: seed 6 tradeables', Number((seeded.rows as Array<{ n: number }>)[0]?.n) === 6);
  // Off-shrine tile: (73,70), generic terrain — nowhere near the Shrine at (1,1).
  await db.execute(
    sql`UPDATE players SET current_position_x = 73, current_position_y = 70 WHERE username = ${username}`
  );
  check('fixture: probe positioned OFF-shrine (73,70)', true);

  // ══ SCENARIO A — off-shrine activate refused with zero mutation ══════════
  const off = await api('POST', '/api/shrine/activate', { tier: 'spade', itemCount: 1 }, reg.cookie);
  check('A: off-shrine activate refused (400)', off.status === 400, { status: off.status, json: off.json });
  // SCOPE #59 driver lesson: createErrorResponse nests the human-readable
  // refusal under error.details.message — the top-level message is the generic
  // code text ('Invalid request data').
  const errEnvelope = off.json?.error as { details?: { message?: string } } | undefined;
  const refusalText = String(off.json?.message ?? errEnvelope?.details?.message ?? '');
  check(
    'A: verbatim presence message (error.details.message)',
    refusalText.includes('must be at the Shrine'),
    off.json
  );
  const rowOff = await probeRow(db, username);
  check('A: inventory untouched (6 items)', (rowOff.inventory_items ?? []).length === 6, rowOff.inventory_items);
  check('A: no boost written', (rowOff.shrine_boosts ?? []).length === 0, rowOff.shrine_boosts);
  check('A: no trade counted', tradeCount(rowOff) === 0, rowOff.stats);

  // ── Fixture (MARKED): move the probe onto the Shrine (1,1) ────────────────
  await db.execute(
    sql`UPDATE players SET current_position_x = 1, current_position_y = 1 WHERE username = ${username}`
  );
  check('fixture: probe positioned ON-shrine (1,1)', true);

  // ══ SCENARIO B — on-shrine activate: parity wired end-to-end ═════════════
  const on = await api('POST', '/api/shrine/activate', { tier: 'spade', itemCount: 1 }, reg.cookie);
  check('B: on-shrine activate accepted (200)', on.status === 200 && on.json?.success === true, {
    status: on.status,
    json: on.json,
  });
  check('B: xpAwarded = 40 (parity award surfaced)', on.json?.xpAwarded === 40, on.json);
  const rowB = await probeRow(db, username);
  check('B: one item consumed (5 left)', (rowB.inventory_items ?? []).length === 5, rowB.inventory_items);
  check(
    'B: spade boost written',
    (rowB.shrine_boosts ?? []).some((b) => b.tier === 'spade'),
    rowB.shrine_boosts
  );
  check('B: shrineTradeCount = 1 (legacy economy parity)', tradeCount(rowB) === 1, rowB.stats);

  // ══ SCENARIO C — boost-all: ONE trade + ONE award for four suits ═════════
  const all = await api('POST', '/api/shrine/boost-all', { itemCount: 1 }, reg.cookie);
  check('C: boost-all accepted (200)', all.status === 200 && all.json?.success === true, {
    status: all.status,
    json: all.json,
  });
  check(
    'C: xpAwarded = 40 EXACTLY ONCE (operator ruling: one transaction)',
    all.json?.xpAwarded === 40,
    all.json
  );
  const rowC = await probeRow(db, username);
  check('C: all four tiers active', (rowC.shrine_boosts ?? []).length === 4, rowC.shrine_boosts);
  check('C: four suits consumed (1 left)', (rowC.inventory_items ?? []).length === 1, rowC.inventory_items);
  check('C: shrineTradeCount = 2 (ONE more trade, not four)', tradeCount(rowC) === 2, rowC.stats);

  console.log(
    `E2E PASS — retained identifiers: account=${username} (cleaned by the guarded ${PREFIX}% sweep on next run)`
  );
  process.exit(0);
}

void main().catch((err) => {
  console.log('E2E crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
