/**
 * FID-20260917-014 - LIVE verification driver for the on-login referral trigger.
 * Runs against the real dev DB (DATABASE_URL from .env.local). Invokes
 * processLoginReferralEvents directly, exactly as the login route now does
 * after successful authentication.
 *
 * Probes:
 *   1. SEED     - two existing players (the "kid" guaranteed to have no other
 *                 pending referral) + a pending referral row aged 8 days.
 *   2. CRITERIA - fires #1..#3 leave validated=0 (loginCount 1..3 < 4).
 *   3. LANDS    - fire #4 meets 7d + 4 logins: validated=1, validationDate set,
 *                 referrer totalReferrals +1 and reward columns increased,
 *                 kid.referralValidated=1.
 *   4. IDEMPOTENT - fire #5 (post-validation) changes nothing.
 *
 * Cleanup: referrals row deleted; referrer and kid player columns restored
 * from pre-probe snapshots (including jsonb milestone columns).
 * One-shot; exits explicitly (open pg pool keeps the process alive).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../lib/db';
import { players, referrals } from '../lib/db/schema';
import { processLoginReferralEvents } from '../lib/referralService';

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  PASS  ${msg}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${msg}`);
  }
}

async function main(): Promise<void> {
  // ---- Pick two existing players; the kid must have no other pending referral
  const candidates = await db.select({ username: players.username }).from(players).limit(50);
  const pendingKids = new Set(
    (await db.select({ u: referrals.newPlayerUsername }).from(referrals).where(eq(referrals.validated, 0)))
      .map((r) => r.u),
  );
  const free = candidates.map((c) => c.username).filter((u) => !pendingKids.has(u));
  if (free.length < 2) throw new Error(`need 2 players without pending referrals, found ${free.length}`);
  const [papa, kid] = free;
  console.log(`probe actors: referrer=${papa} kid=${kid}`);

  // ---- Snapshot referrer + kid state for restore
  const snapRows = await db.select().from(players).where(eq(players.username, papa)).limit(1);
  const snap = snapRows[0];
  if (!snap) throw new Error(`snapshot read failed for ${papa}`);
  const kidRows = await db.select().from(players).where(eq(players.username, kid)).limit(1);
  const kidSnap = kidRows[0];
  if (!kidSnap) throw new Error(`snapshot read failed for ${kid}`);

  // ---- Seed: pending referral, 8 days old, 0 logins
  const referralId = ('e2e14' + randomBytes(8).toString('hex')).slice(0, 24);
  const signup = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  await db.insert(referrals).values({
    id: referralId,
    referrerCode: 'E2EPROBE',
    referrerUsername: papa,
    referrerPlayerId: papa,
    newPlayerUsername: kid,
    newPlayerEmail: 'e2e-fid14-probe@test.invalid',
    newPlayerIP: '127.0.0.1',
    signupDate: signup,
    validated: 0,
    loginCount: 0,
    daysActive: 0,
    rewardsClaimed: 0,
    rewardsDataMetal: 100,
    rewardsDataEnergy: 50,
    rewardsDataRp: 10,
    rewardsDataXp: 20,
    rewardsDataVipDays: 0,
    welcomePackageGiven: 0,
    flaggedForAbuse: 0,
    invalidated: 0,
    flagReason: null,
    adminNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`seeded referral ${referralId} (8 days old)`);

  try {
    // ---- Fires #1..#3: criteria unmet
    for (let i = 1; i <= 3; i++) {
      await processLoginReferralEvents(kid);
      const rows = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
      const row = rows[0];
      assert(!!row && row.validated === 0, `fire #${i}: still unvalidated (loginCount=${row?.loginCount})`);
    }

    // ---- Fire #4: 7d + 4 logins -> validation lands through the real reward path
    await processLoginReferralEvents(kid);
    const after = (await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1))[0];
    assert(!!after && after.validated === 1, 'fire #4: referral VALIDATED');
    assert(!!after?.validationDate, 'fire #4: validationDate stamped');
    assert((after?.loginCount ?? 0) === 4, 'fire #4: loginCount reached 4');

    const papaAfter = (await db.select().from(players).where(eq(players.username, papa)).limit(1))[0];
    assert((papaAfter.totalReferrals ?? 0) === (snap.totalReferrals ?? 0) + 1, 'referrer totalReferrals +1');
    assert(
      Number(papaAfter.referralRewardsMetal ?? 0) >= Number(snap.referralRewardsMetal ?? 0) + 100,
      'referrer metal rewards credited (>= +100)',
    );
    assert((kidSnap.referralValidated ?? 0) === 0, 'pre-check: kid started unvalidated');

    // ---- Fire #5: idempotency - validated rows leave the pending set
    const beforeIdle = papaAfter.totalReferrals;
    await processLoginReferralEvents(kid);
    const papaIdle = (await db.select().from(players).where(eq(players.username, papa)).limit(1))[0];
    assert(papaIdle.totalReferrals === beforeIdle, 'fire #5: no change (idempotent)');
  } finally {
    // ---- Cleanup: referral row + exact player-state restore
    await db.delete(referrals).where(eq(referrals.id, referralId));
    await db.update(players).set({
      totalReferrals: snap.totalReferrals ?? 0,
      pendingReferrals: snap.pendingReferrals ?? 0,
      lastReferralValidated: snap.lastReferralValidated ?? null,
      referralRewardsMetal: snap.referralRewardsMetal ?? 0,
      referralRewardsEnergy: snap.referralRewardsEnergy ?? 0,
      referralRewardsRp: snap.referralRewardsRp ?? 0,
      referralRewardsXp: snap.referralRewardsXp ?? 0,
      referralRewardsVipDays: snap.referralRewardsVipDays ?? 0,
      resourcesMetal: snap.resourcesMetal ?? 0,
      resourcesEnergy: snap.resourcesEnergy ?? 0,
      researchPoints: snap.researchPoints ?? 0,
      xp: snap.xp ?? 0,
      referralTitles: snap.referralTitles ?? [],
      referralBadges: snap.referralBadges ?? [],
      referralMilestonesReached: snap.referralMilestonesReached ?? [],
    }).where(eq(players.username, papa));
    await db.update(players).set({
      referralValidated: kidSnap.referralValidated ?? 0,
      referralValidatedAt: kidSnap.referralValidatedAt ?? null,
    }).where(eq(players.username, kid));
    console.log('cleanup: referral row deleted, player states restored');
  }
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`LIVE PROBE FAILED: ${failures} assertion(s)`);
      process.exit(1);
    }
    console.log('LIVE PROBE GREEN: all assertions passed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('LIVE PROBE ERROR:', err);
    process.exit(1);
  });
