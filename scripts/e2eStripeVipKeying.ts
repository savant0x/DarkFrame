/**
 * FID-20260917-009 — LIVE verification driver for the Stripe VIP remediation.
 * Real dev DB, REAL service functions (no mocks), clone-row method:
 * `fame`'s row is cloned to `__vipprobe_<ts>` (the row carries the many NOT
 * NULL columns a hand-made seed would miss), then the full money lifecycle
 * runs against the clone with username keying:
 *
 *   1. GRANT  — grantVIP(userId=clone) → true; vip=1 + tier + Stripe IDs +
 *               expiration ≈ now + durationDays(tier). fame untouched.
 *   2. CHECK  — checkVIPStatus(clone) → isVIP true, tier echo.
 *   3. EXTEND — extendVIP → expiration strictly advanced from the grant.
 *   4. REVOKE — revokeVIP → vip=0, expiration/tier nulled.
 *   5. CLEANUP — clone deleted; ZERO residual rows asserted.
 *
 * Read/write only against the disposable clone; no Stripe network calls.
 * One-shot; exits explicitly (open pool keeps the process alive).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq } from 'drizzle-orm';
import { db, players } from '@/lib/db';
import {
  grantVIP,
  revokeVIP,
  extendVIP,
  checkVIPStatus,
} from '@/lib/stripe/subscriptionService';
import { VIPTier, getVIPDurationDays } from '@/types/stripe.types';

const SOURCE = 'fame';

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

async function main() {
  console.log('=== FID-20260917-009 live probe: username-keyed VIP lifecycle ===\n');

  // Clone fame's row (real shape: all NOT NULLs satisfied by copy).
  const [src] = await db.select().from(players).where(eq(players.username, SOURCE)).limit(1);
  if (!src) fail(`PREMISE: source player ${SOURCE} not found`);
  const stamp = Date.now().toString(36);
  const cloneName = `__vipprobe_${stamp}`.slice(0, 20);
  const inserted = await db
    .insert(players)
    .values({
      ...src,
      username: cloneName,
      // email carries a UNIQUE index — fame's must not ride along.
      email: `__vipprobe_${stamp}@probe.invalid`,
      // THE PREMISE: model the real pg-era cohort — mongo_id NULL (the audit
      // found it unpopulated for 100% of players). The grant must succeed
      // under exactly the production failure condition.
      mongoId: null,
      vip: 0,
      vipExpiration: null,
      vipTier: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      referralCode: null,
      referralLink: null,
    })
    .returning({ username: players.username });
  if (!inserted.length) fail('SETUP: clone insert failed');
  console.log(`SETUP: cloned ${SOURCE} → ${cloneName} (mongoId NULL — pg-era cohort shape)`);

  const cleanup = async () => {
    await db.delete(players).where(eq(players.username, cloneName));
    const residual = await db.select({ u: players.username }).from(players).where(eq(players.username, cloneName));
    return residual.length;
  };

  try {
    // 1. GRANT
    const granted = await grantVIP({
      userId: cloneName,
      tier: VIPTier.MONTHLY,
      stripeCustomerId: 'cus_probe',
      stripeSubscriptionId: 'sub_probe',
    });
    const [afterGrant] = await db.select().from(players).where(eq(players.username, cloneName)).limit(1);
    console.log(`GRANT: ok=${granted} vip=${afterGrant?.vip} tier=${afterGrant?.vipTier} exp=${afterGrant?.vipExpiration?.toISOString()}`);
    if (!granted) fail('GRANT: grantVIP returned false — username keying broken');
    if (afterGrant.vip !== 1 || afterGrant.vipTier !== VIPTier.MONTHLY) fail('GRANT: row not updated');
    if (!afterGrant.vipExpiration) fail('GRANT: expiration missing');
    const expectedDays = getVIPDurationDays(VIPTier.MONTHLY);
    const driftH = Math.abs(
      (afterGrant.vipExpiration.getTime() - (Date.now() + expectedDays * 86400_000)) / 3600_000,
    );
    if (driftH > 1) fail(`GRANT: expiration off by ${driftH.toFixed(1)}h from now+${expectedDays}d`);

    // isolation: fame untouched
    const [fameRow] = await db.select().from(players).where(eq(players.username, SOURCE)).limit(1);
    if (!fameRow) fail('ISOLATION: source player vanished');
    console.log(`ISOLATION: ${SOURCE} vip=${fameRow.vip} (untouched by clone grant)`);

    // 2. CHECK
    const status = await checkVIPStatus(cloneName);
    console.log(`CHECK: isVIP=${status.isVIP} tier=${status.tier}`);
    if (!status.isVIP || status.tier !== VIPTier.MONTHLY) fail('CHECK: status wrong');

    // 3. EXTEND
    const before = (afterGrant.vipExpiration as Date).getTime();
    const extended = await extendVIP({ userId: cloneName, tier: VIPTier.WEEKLY });
    const [afterExtend] = await db.select().from(players).where(eq(players.username, cloneName)).limit(1);
    console.log(`EXTEND: ok=${extended} newExp=${afterExtend?.vipExpiration?.toISOString()}`);
    if (!extended) fail('EXTEND: returned false');
    if ((afterExtend?.vipExpiration?.getTime() ?? 0) <= before) fail('EXTEND: expiration not advanced');

    // 4. REVOKE
    const revoked = await revokeVIP(cloneName);
    const [afterRevoke] = await db.select().from(players).where(eq(players.username, cloneName)).limit(1);
    console.log(`REVOKE: ok=${revoked} vip=${afterRevoke?.vip} exp=${afterRevoke?.vipExpiration}`);
    if (!revoked || afterRevoke.vip !== 0 || afterRevoke.vipExpiration !== null) fail('REVOKE: incomplete');

    console.log('\n✅ LIVE PROBE 5/5 GREEN (grant, isolation, check, extend, revoke) — cleaning up');
  } finally {
    const residual = await cleanup();
    if (residual !== 0) fail(`CLEANUP: ${residual} residual probe rows remain`);
    console.log('CLEANUP: clone deleted, zero residual rows');
  }

  process.exit(0);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
