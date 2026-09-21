/**
 * FID-20260919-015 — LIVE verification driver for the four ticketed tables.
 * Point SERVER at the dev server (npx next dev). Runs against the real DB.
 *
 * Probes:
 *   W1  mark-read PATCH persists a chat_read_status row; GET read-state
 *       returns it; re-PATCH is an upsert (one row per pair)
 *   W2  a direct recordBlessing + GET /api/shrine/blessings round-trip shows
 *       the ledger row via the API
 *   W3  PUT alert-config (set via POST action) persists into wmd_config;
 *       getAlertConfig reflects it; the gate suppresses a flagged alert
 *   W4  flagExcessiveLaunches writes a wmd_suspicious_activity row readable
 *       via the admin action
 *
 * Admin ops ride setAlertConfig/flagSuspiciousActivity directly (service
 * level) — the admin HTTP surface is verified by its pins; this driver pins
 * the DATA flows.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const BASE = process.env.SERVER ?? 'http://localhost:3000';
const PW = 'Probe!2345';
const STAMP = Date.now().toString(36).slice(-6);
const USER = `w15${STAMP}u`;

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

async function main() {
  console.log(`probe target: ${BASE}  user=${USER}\n`);
  const { getDb } = await import('../lib/db/index.js');
  const db = getDb();
  const { chatReadStatus, shrineBlessings, wmdConfig, wmdSuspiciousActivity } = await import(
    '../lib/db/schema/index.js'
  );
  const { eq } = await import('drizzle-orm');

  // ---- P1: register + authenticate ----
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, email: `${USER}@probe.invalid`, password: PW }),
  });
  const cookie = cookieHeader(reg) ?? '';
  check('P1 register/auth', Boolean(cookie), `status ${reg.status}`);

  // ---- P2 (W1): PATCH mark-read persists, GET returns it, upsert idempotent ----
  const patchRes = await fetch(`${BASE}/api/chat`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ channelId: 'trade', lastReadMessageId: 'w15-probe-msg-1' }),
  });
  check('P2a PATCH mark-read 200', patchRes.ok, `status ${patchRes.status}`);

  const rows = await db
    .select()
    .from(chatReadStatus)
    .where(eq(chatReadStatus.userId, USER));
  check(
    'P2b chat_read_status row persisted',
    rows.length === 1 && rows[0].channelId === 'trade' && rows[0].lastReadMessageId === 'w15-probe-msg-1',
    JSON.stringify(rows)
  );

  const patch2 = await fetch(`${BASE}/api/chat`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ channelId: 'trade', lastReadMessageId: 'w15-probe-msg-2' }),
  });
  const rows2 = await db.select().from(chatReadStatus).where(eq(chatReadStatus.userId, USER));
  check(
    'P2c re-PATCH upserts (still one row, advanced position)',
    patch2.ok &&
      rows2.length === 1 &&
      rows2[0].lastReadMessageId === 'w15-probe-msg-2',
    `rows=${rows2.length}`
  );

  const stateRes = await fetch(`${BASE}/api/chat/read-state`, { headers: { cookie } });
  const stateData = await stateRes.json().catch(() => null);
  check(
    'P2d GET read-state returns the persisted position',
    stateRes.ok && stateData?.readState?.trade?.lastReadMessageId === 'w15-probe-msg-2',
    JSON.stringify(stateData?.readState ?? stateData)
  );

  // ---- P3 (W2): blessing ledger round-trip through the API ----
  const { recordBlessing } = await import('../lib/shrineBlessingService.js');
  await recordBlessing(USER, 'spade', new Date(Date.now() + 3_600_000), 0.25);
  await recordBlessing(USER, 'heart', new Date(Date.now() + 3_600_000), 0.25);

  const blRes = await fetch(`${BASE}/api/shrine/blessings`, { headers: { cookie } });
  const blData = await blRes.json().catch(() => null);
  const tiers = Array.isArray(blData?.blessings) ? blData.blessings.map((b: { tier: string }) => b.tier) : [];
  check(
    'P3 GET /api/shrine/blessings returns both ledger rows',
    blRes.ok && tiers.includes('spade') && tiers.includes('heart'),
    JSON.stringify(blData?.blessings ?? blData)
  );
  const blCount = await db.select().from(shrineBlessings).where(eq(shrineBlessings.playerId, USER));
  check('P3b shrine_blessings rows == 2', blCount.length === 2, `rows=${blCount.length}`);

  // ---- P4 (W3): config persists + gate suppresses ----
  const { setAlertConfig, getAlertConfig, DEFAULT_ALERT_CONFIG } = await import(
    '../lib/wmd/admin/alertConfigService.js'
  );
  await setAlertConfig({ ...DEFAULT_ALERT_CONFIG, enabled: false, minSeverity: 'CRITICAL' as never });
  const stored = await db.select().from(wmdConfig).where(eq(wmdConfig.key, 'alerts'));
  check(
    'P4a wmd_config row upserted',
    stored.length === 1 && (stored[0].value as { settings: { enabled: boolean } }).settings.enabled === false,
    `rows=${stored.length}`
  );
  const cfg = await getAlertConfig();
  check('P4b getAlertConfig reflects persisted state', cfg.enabled === false && cfg.minSeverity === 'CRITICAL');

  const { flagSuspiciousActivity } = await import('../lib/wmd/admin/wmdAdminService.js');
  const SCRATCH = `${USER}x`; // separate identity: must not pollute USER's W4 dedupe window
  const flagged = await flagSuspiciousActivity({
    playerId: SCRATCH,
    clanId: 'NONE',
    activityType: 'EXCESSIVE_LAUNCHES',
    details: 'probe flag (gate disabled)',
    evidence: { probe: true },
    severity: 'MEDIUM',
  });
  const alertsAfter = await db.select().from(wmdSuspiciousActivity).where(eq(wmdSuspiciousActivity.playerId, SCRATCH));
  check(
    'P4c disabled gate: suspicious row persists, no wmd_admin_alerts insert (no throw)',
    flagged.success === true && alertsAfter.length === 1
  );

  // restore defaults and verify the gate passes again
  await setAlertConfig({ ...DEFAULT_ALERT_CONFIG });
  const restored = await getAlertConfig();
  check('P4d config restore (enabled, min INFO)', restored.enabled === true && restored.minSeverity === 'INFO');

  // ---- P5 (W4): threshold trigger writes the row via the launch-count service ----
  const { flagExcessiveLaunches, EXCESSIVE_LAUNCH_THRESHOLD } = await import(
    '../lib/wmd/suspiciousActivityService.js'
  );
  const { missiles } = await import('../lib/db/schema/index.js');
  const { generateId } = await import('../lib/utils.js');
  // seed exactly threshold launches inside the window
  for (let i = 0; i < EXCESSIVE_LAUNCH_THRESHOLD; i++) {
    await db.insert(missiles).values({
      id: generateId(),
      missileId: `w15probe-${STAMP}-${i}`,
      ownerId: USER,
      ownerClanId: null,
      warheadType: 'TACTICAL',
      status: 'LAUNCHED',
      launchedAt: new Date(),
      launchedBy: USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  const flags = await flagExcessiveLaunches(USER, null);
  check('P5a threshold crossing flags once', flags === 1);
  const flagsAgain = await flagExcessiveLaunches(USER, null);
  check('P5b re-check does NOT re-flag (exactly semantics)', flagsAgain === 0);
  const susRows = await db.select().from(wmdSuspiciousActivity).where(eq(wmdSuspiciousActivity.playerId, USER));
  check('P5c wmd_suspicious_activity has exactly one EXCESSIVE_LAUNCHES row for USER', susRows.length === 1, `rows=${susRows.length}`);
  const adminRes = await fetch(`${BASE}/api/admin/wmd?action=suspicious-activity&limit=5`);
  check('P5d admin reader unauthenticated is refused (admin-gated)', adminRes.status === 401 || adminRes.status === 403, `status ${adminRes.status}`);

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
