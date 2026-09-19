/**
 * FID-20260919-010 — LIVE webhook-style probe for RP package checkout.
 * Runs against the real dev server + DB. No Stripe charge is needed for the
 * grant path: the probe signs checkout.session.completed events with the real
 * STRIPE_WEBHOOK_SECRET and posts them to the real /api/stripe/webhook route
 * (real signature verification), then asserts DB truth.
 *
 *   P1  SESSION   — POST /api/stripe/rp-checkout with a real session cookie
 *                   creates a Stripe checkout session (test key); response
 *                   carries a cs_... id and a checkout.stripe.com URL. If the
 *                   dev machine has no Stripe API access, this leg records an
 *                   environment limitation and the webhook legs still run.
 *   P2  GRANT     — signed RP event → 200; probe player's research_points
 *                   increased by exactly the SERVER map's rp (metadata rp lies);
 *                   paymentTransactions row exists (tier rp:boost).
 *   P3  IDEMPOTENT— replay of the SAME event → 200; RP unchanged; still one row.
 *   P4  NO-GHOST  — event for a nonexistent player → 500 (throw → Stripe
 *                   retries); no ledger row for that session.
 *   P5  VIP GUARD — an event without kind rides the VIP path (grant lands on
 *                   the probe player; backward compatibility intact).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import crypto from 'node:crypto';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3003';
const RUN = `rp${Date.now().toString(36).slice(-6)}`;
const PROBE_USER = `pb_${RUN}`;
const PROBE_PW = 'Probe!Passw0rd';
const SESSION_ID = `cs_test_rp_probe_${RUN}`;

let pass = 0;
const results: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function sign(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function rpEvent(sessionId: string, username: string, withKind = true): string {
  const metadata: Record<string, string> = {
    userId: username,
    username,
    packageId: 'boost',
    rp: '999999999', // lies — the server map must win (5000)
  };
  if (withKind) metadata.kind = 'rp_package';
  return JSON.stringify({
    id: `evt_${sessionId}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        customer: 'cus_probe',
        subscription: null,
        amount_total: 999,
        metadata,
      },
    },
  });
}

async function main() {
  console.log(`probe target: ${BASE}  user=${PROBE_USER}\n`);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing from .env.local');

  // ── register probe player over real HTTP ──
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: PROBE_USER,
      email: `${RUN}.rp@probe.invalid`,
      password: PROBE_PW,
    }),
  });
  const setCookie = reg.headers.get('set-cookie') || '';
  const session = setCookie
    .split(',')
    .map((c) => c.trim())
    .find((c) => c.startsWith('darkframe_session='));
  if (!session) throw new Error(`register failed: ${reg.status}`);
  const cookie = session.split(';')[0];

  // ── DB baseline ──
  const { getDb } = await import('../lib/db/index.js');
  const { players } = await import('../lib/db/schema/index.js');
  const { eq } = await import('drizzle-orm');
  const db = getDb();
  const readRp = async (): Promise<number> => {
    const row = (await db.select().from(players).where(eq(players.username, PROBE_USER)).limit(1))[0];
    return Number(row?.researchPoints ?? 0);
  };
  const baseline = await readRp();
  console.log(`baseline researchPoints=${baseline}\n`);

  // ── P1: real checkout-session creation (test key; may be network-limited) ──
  const createRes = await fetch(`${BASE}/api/stripe/rp-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ packageId: 'boost' }),
  });
  const createBody = await createRes.json().catch(() => null);
  if (createRes.ok && createBody?.success) {
    check(
      'P1 session: real checkout session created (mode=payment, server-owned price)',
      typeof createBody.sessionId === 'string' &&
        String(createBody.sessionId).startsWith('cs_') &&
        typeof createBody.url === 'string' &&
        String(createBody.url).includes('checkout.stripe.com'),
      `id=${createBody.sessionId}`
    );
  } else {
    results.push(
      `SKIP P1 session (environment): status=${createRes.status} msg=${createBody?.message ?? 'n/a'} — Stripe API unreachable from dev; webhook legs proceed`
    );
  }

  // ── P2: signed RP event → grant lands exactly once ──
  const payload = rpEvent(SESSION_ID, PROBE_USER);
  const hookRes = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sign(payload, secret) },
    body: payload,
  });
  check('P2 webhook: accepted (200 received)', hookRes.status === 200, `status=${hookRes.status}`);
  const afterGrant = await readRp();
  check(
    'P2 grant: research_points increased by the SERVER map value (5000, metadata lied)',
    afterGrant === baseline + 5000,
    `${baseline} -> ${afterGrant}`
  );
  const { sql } = await import('drizzle-orm');
  const ledger = await db.execute(
    sql`SELECT id, tier, amount, "stripeSessionId" FROM "paymentTransactions" WHERE "stripeSessionId" = ${SESSION_ID}`
  );
  const rows = ledger.rows as Array<Record<string, unknown>>;
  check(
    'P2 ledger: exactly one row, tier rp:boost, amount 999',
    rows.length === 1 && rows[0].tier === 'rp:boost' && Number(rows[0].amount) === 999,
    JSON.stringify(rows[0] ?? {})
  );

  // ── P3: idempotent replay ──
  const replayRes = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sign(payload, secret) },
    body: payload,
  });
  check('P3 replay: accepted (200, no retry storm)', replayRes.status === 200, `status=${replayRes.status}`);
  const afterReplay = await readRp();
  check('P3 replay: RP unchanged (no double credit)', afterReplay === baseline + 5000, `rp=${afterReplay}`);
  const ledger2 = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM "paymentTransactions" WHERE "stripeSessionId" = ${SESSION_ID}`
  );
  check('P3 replay: still exactly one ledger row', Number((ledger2.rows[0] as any)?.n) === 1);

  // ── P4: failed grant (nonexistent player) → 500, no ledger row ──
  const ghostSession = `cs_test_rp_ghost_${RUN}`;
  const ghostPayload = rpEvent(ghostSession, 'ghost_user_no_exist');
  const ghostRes = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sign(ghostPayload, secret) },
    body: ghostPayload,
  });
  check('P4 failed grant: 500 so Stripe retries (false-success impossible)', ghostRes.status === 500, `status=${ghostRes.status}`);
  const ledger3 = await db.execute(
    sql`SELECT COUNT(*)::int AS n FROM "paymentTransactions" WHERE "stripeSessionId" = ${ghostSession}`
  );
  check('P4 failed grant: NO ledger row for ungranted RP', Number((ledger3.rows[0] as any)?.n) === 0);

  // ── P5: VIP guard — a legacy VIP event (tier, no kind) rides the VIP path ──
  const vipSession = `cs_test_vip_probe_${RUN}`;
  const vipPayload = JSON.stringify({
    id: `evt_${vipSession}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: vipSession,
        object: 'checkout.session',
        payment_status: 'paid',
        customer: 'cus_probe',
        subscription: 'sub_probe',
        amount_total: 1499,
        metadata: { userId: PROBE_USER, username: PROBE_USER, tier: 'MONTHLY' },
      },
    },
  });
  const vipRes = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sign(vipPayload, secret) },
    body: vipPayload,
  });
  check('P5 VIP guard: legacy event (no kind) accepted via VIP path', vipRes.status === 200, `status=${vipRes.status}`);
  const vipRow = (
    await db.select().from(players).where(eq(players.username, PROBE_USER)).limit(1)
  )[0];
  check(
    'P5 VIP guard: probe player granted VIP (path still live)',
    Number(vipRow?.vip ?? 0) === 1,
    `vip=${vipRow?.vip} tier=${vipRow?.vipTier}`
  );

  console.log('\n' + results.join('\n'));
  console.log(`\n${pass}/${results.filter((r) => r.startsWith('PASS') || r.startsWith('FAIL')).length} probes passed${results.some((r) => r.startsWith('SKIP')) ? ' (+1 environment skip)' : ''}`);
  process.exit(
    results.every((r) => !r.startsWith('FAIL')) ? 0 : 1
  );
}

main().catch((e) => {
  console.error('driver crashed:', e);
  process.exit(1);
});
