/**
 * FID-20260916-004 — LIVE verification driver for the Option B forfeit seams.
 * Run against the local dev server (PORT=3002) with DATABASE_URL from .env.local.
 *
 * Probes (per the FID's verification plan):
 *   1. WMD launch by a protected account → launch succeeds + row's protectionUntil NULL (void fired)
 *   2. join a clan at ACTIVE war → member added + protectionUntil NULL (war by proxy voids)
 *   3. join a neutral clan → member added + protectionUntil UNTOUCHED (onboarding stays open)
 *   4. cleanup: guarded delete of fixtures (players, missiles, clans, wars, invitations) — 0 residual
 *
 * Fixture strategy (no auth-juggling needed): all state changes ride direct DB
 * writes + service-level calls; HTTP is used only where the wire contract
 * matters (none here — the seams are service-level, and FID-002 already
 * live-probed the routes). This keeps the driver honest about what it tests:
 * the seam, not Next's router.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { players, clans, clanWars } from '../lib/db/schema';

const TS = Date.now().toString(36);
const LAUNCHER = `svc_wmd_${TS}`; // protected → launches → voided
const JOINER_WAR = `svc_war_${TS}`; // protected → joins war clan → voided
const JOINER_NEUTRAL = `svc_neu_${TS}`; // protected → joins neutral clan → intact
const CLAN_WAR = `svc_clanwar_${TS}`;
const CLAN_NEUTRAL = `svc_clanneu_${TS}`;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function protectionOf(username: string): Promise<Date | null> {
  const [row] = await db
    .select({ protectionUntil: players.protectionUntil })
    .from(players)
    .where(eq(players.username, username))
    .limit(1);
  if (!row) throw new Error(`fixture missing: ${username}`);
  return row.protectionUntil;
}

async function insertPlayer(username: string): Promise<void> {
  await db.insert(players).values({
    username,
    email: `${username}@probe.invalid`,
    password: 'x',
    // FID-002 seam: the registration path normally stamps this; the driver
    // stamps the same value so every fixture starts inside a live window.
    protectionUntil: new Date(Date.now() + 72 * 3_600_000),
    level: 1,
    // NOT NULL positionals (fixtures never move; the probe reads protection only)
    baseX: 1,
    baseY: 1,
    currentPositionX: 1,
    currentPositionY: 1,
  });
}

async function insertClan(name: string, tag: string): Promise<string> {
  const [row] = await db
    .insert(clans)
    .values({
      id: name.toLowerCase().replace(/_/g, '').slice(0, 24),
      name,
      tag,
      description: 'FID-20260916-004 probe fixture',
      leaderId: 'svc_wmd_probe',
      members: [],
      createdAt: new Date(),
    })
    .returning({ id: clans.id });
  return row.id;
}

async function cleanup(state: { missileIds: string[]; clanIds: string[] }): Promise<void> {
  if (state.missileIds.length) {
    await db.execute(sql`DELETE FROM missiles WHERE missile_id IN ${state.missileIds}`);
  }
  if (state.clanIds.length) {
    await db.delete(clanWars).where(inArray(clanWars.attackerClanId, state.clanIds));
    await db.execute(sql`DELETE FROM clan_invitations WHERE clan_id IN ${state.clanIds}`);
    await db.delete(clans).where(inArray(clans.id, state.clanIds));
  }
  await db.delete(players).where(
    inArray(players.username, [LAUNCHER, JOINER_WAR, JOINER_NEUTRAL])
  );
}

async function main(): Promise<void> {
  console.log(`\n=== FID-20260916-004 live probes (fixtures ${TS}) ===\n`);
  const state = { missileIds: [] as string[], clanIds: [] as string[] };
  let probeError: unknown = null;
  try {
    await insertPlayer(LAUNCHER);
    await insertPlayer(JOINER_WAR);
    await insertPlayer(JOINER_NEUTRAL);
    const warClanId = await insertClan(CLAN_WAR, `W${TS.slice(-5)}`.toUpperCase());
    state.clanIds.push(warClanId); // incremental: a later failure must not leak earlier fixtures
    const neutralClanId = await insertClan(CLAN_NEUTRAL, `N${TS.slice(-5)}`.toUpperCase());
    state.clanIds.push(neutralClanId);

    // ACTIVE war row for the war clan (both-side constraint needs an opponent;
    // reuse the same clan id — declareWar's uniqueness is pair-scoped, and the
    // settle path is never exercised here).
    await db.insert(clanWars).values({
      warId: `probe_${TS}`,
      attackerClanId: warClanId,
      defenderClanId: warClanId,
      status: 'ACTIVE',
      declaredAt: new Date(),
    });

    // --- Probe 1: WMD launch voids ---
    await db.execute(sql`
      INSERT INTO missiles (id, missile_id, owner_id, warhead_type, status, created_at, updated_at)
      VALUES (${`m${TS}`.slice(0, 24)}, ${`probe_m_${TS}`}, ${LAUNCHER}, 'TACTICAL', 'READY', NOW(), NOW())
    `);
    state.missileIds = [`probe_m_${TS}`];
    const { launchMissile } = await import('../lib/wmd/missileService');
    // launchMissile resolves the missile by its PRIMARY KEY (missiles.id), not
    // the business missile_id column — pass the id exactly as inserted.
    const missilePk = `m${TS}`.slice(0, 24);
    const launched = await launchMissile(missilePk, 'svc_bot_dummy', LAUNCHER);
    const launcherProtection = await protectionOf(LAUNCHER);
    check(
      'WMD launch by protected account → success + void fired',
      launched.success === true && launcherProtection === null,
      `success=${launched.success}; protectionUntil=${String(launcherProtection)}`
    );

    // --- Probe 2: war-clan join voids ---
    // clan_invitations carries NOT NULL clan_name + inviter/invitee username
    // columns (raw-SQL table, no drizzle schema — probed live).
    await db.execute(sql`
      INSERT INTO clan_invitations (id, clan_id, clan_name, inviter_id, inviter_username, invitee_id, invitee_username, status, expires_at, created_at)
      VALUES (${`probe_i1_${TS}`}, ${warClanId}, ${CLAN_WAR}, ${LAUNCHER}, ${LAUNCHER}, ${JOINER_WAR}, ${JOINER_WAR}, 'pending', NOW() + INTERVAL '1 hour', NOW())
    `);
    const { joinClan } = await import('../lib/clanService');
    const warJoin = await joinClan(`probe_i1_${TS}`, JOINER_WAR);
    const joinerWarProtection = await protectionOf(JOINER_WAR);
    check(
      'join clan at ACTIVE war → success + void fired',
      warJoin.success === true && joinerWarProtection === null,
      `success=${warJoin.success}; protectionUntil=${String(joinerWarProtection)}`
    );

    // --- Probe 3: neutral-clan join keeps the shield ---
    await db.execute(sql`
      INSERT INTO clan_invitations (id, clan_id, clan_name, inviter_id, inviter_username, invitee_id, invitee_username, status, expires_at, created_at)
      VALUES (${`probe_i2_${TS}`}, ${neutralClanId}, ${CLAN_NEUTRAL}, ${LAUNCHER}, ${LAUNCHER}, ${JOINER_NEUTRAL}, ${JOINER_NEUTRAL}, 'pending', NOW() + INTERVAL '1 hour', NOW())
    `);
    const neutralJoin = await joinClan(`probe_i2_${TS}`, JOINER_NEUTRAL);
    const joinerNeutralProtection = await protectionOf(JOINER_NEUTRAL);
    check(
      'join neutral clan → success + window UNTOUCHED',
      neutralJoin.success === true && joinerNeutralProtection !== null,
      `success=${neutralJoin.success}; protectionUntil=${String(joinerNeutralProtection)}`
    );
  } catch (err) {
    // Preserve the failure — process.exit() inside finally would silently
    // discard an in-flight exception (observed live: probes silently "passed"
    // as 1/1 cleanup-only with exit 0).
    probeError = err;
  } finally {
    await cleanup(state);
    const residual = await db
      .select({ username: players.username })
      .from(players)
      .where(inArray(players.username, [LAUNCHER, JOINER_WAR, JOINER_NEUTRAL]));
    check('cleanup: fixture residual = 0', residual.length === 0, `${residual.length} rows left`);
    console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} probes passed ===\n`);
  }
  if (probeError) {
    console.error('Driver crashed:', probeError);
    process.exit(1);
  }
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main().catch((err) => {
  console.error('Driver crashed:', err);
  process.exit(1);
});
