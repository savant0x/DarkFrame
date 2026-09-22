/**
 * FID-20260919-018 — LIVE verification driver for the clan WMD consequence system.
 * Runs against the real dev DB. Creates two throwaway clans + member players,
 * runs the real consequence flow, then exercises the real launch gate.
 *
 * Probes:
 *   P1  applyClanWMDConsequences writes a real ~24h cooldown + research penalty
 *   P2  relations set to ENEMY with a canonical (sorted) pair
 *   P3  one retaliation right per victim member, PKs ≤ 24 chars
 *   P4  isClanOnWMDCooldown reports the truth (active, then expired)
 *   P5  the launch gate REFUSES a cooldown-clan launch (real launchMissile)
 *   P6  a retaliation right lets the victim retaliate through the gate
 *   P7  cleanup leaves no residue
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { generateId } from '../lib/utils';
import {
  applyClanWMDConsequences,
  isClanOnWMDCooldown,
  hasRetaliationRights,
  consumeRetaliationRight,
} from '../lib/wmd/clanConsequencesService';
import { launchMissile } from '../lib/wmd/missileService';
import { processDueMissiles } from '../lib/wmd/jobs/missileTracker';

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> =>
  ((await db.execute(q)) as unknown as { rows: Row[] }).rows;

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail ?? ''); }
}

const TS = Date.now();
const atkClan = generateId();
const vicClan = generateId();
const atkPlayer = `zcatk${TS}`.slice(0, 20);
const vic1 = `zcvic1${TS}`.slice(0, 20);
const vic2 = `zcvic2${TS}`.slice(0, 20);
const missileRowId = generateId();
const missilePubId = `zcm${TS}`.slice(0, 50);

// P8 — the INTEGRATED leg: a real detonation through processDueMissiles() must
// fire the consequence hook. Every probe id above carries TS, which is how the
// cleanup finds its own rows in the user-keyed tables.
const atkClan2 = generateId();
const vicClan2 = generateId();
const atk2 = `zcatk2${TS}`.slice(0, 20);
const vicB1 = `zcvicb1${TS}`.slice(0, 20);
const vicB2 = `zcvicb2${TS}`.slice(0, 20);
const detMissileId = generateId();
const detMissilePubId = `zcd${TS}`.slice(0, 50);

async function insertPlayer(username: string, clanId: string, level = 19) {
  await db.execute(sql`INSERT INTO players
    (username, email, password, base_x, base_y, current_position_x, current_position_y, clan_id, level, protection_until)
    VALUES (${username}, ${username + '@probe.local'}, 'x', 0, 0, 0, 0, ${clanId}, ${level}, NULL)`);
}

async function insertClan(id: string, name: string, tag: string, leaderId: string) {
  await db.execute(sql`INSERT INTO clans (id, name, tag, description, leader_id, created_at)
    VALUES (${id}, ${name}, ${tag}, 'probe', ${leaderId}, now())`);
}

async function cleanup() {
  await db.execute(sql`DELETE FROM wmd_retaliation_rights WHERE player_clan_id IN (${vicClan}, ${atkClan}, ${vicClan2}, ${atkClan2}) OR can_retaliate_against_clan IN (${vicClan}, ${atkClan}, ${vicClan2}, ${atkClan2})`);
  await db.execute(sql`DELETE FROM clan_relations WHERE clan_id1 IN (${vicClan}, ${atkClan}, ${vicClan2}, ${atkClan2}) OR clan_id2 IN (${vicClan}, ${atkClan}, ${vicClan2}, ${atkClan2})`);
  await db.execute(sql`DELETE FROM missiles WHERE id IN (${missileRowId}, ${detMissileId})`);
  // Residue the P8 detonation leg creates downstream of the hook: the FID-013
  // notification seam (messages + the System conversation) and the two alert
  // tables the tracker writes.
  await db.execute(sql`DELETE FROM messages WHERE recipient_id LIKE ${'%' + TS + '%'} OR sender_id LIKE ${'%' + TS + '%'}`);
  await db.execute(sql`DELETE FROM conversations WHERE participants::text LIKE ${'%' + TS + '%'}`);
  await db.execute(sql`DELETE FROM wmd_alerts WHERE clan_id IN (${atkClan}, ${vicClan}, ${atkClan2}, ${vicClan2}) OR target_clan_id IN (${atkClan}, ${vicClan}, ${atkClan2}, ${vicClan2}) OR player_id LIKE ${'%' + TS + '%'}`);
  await db.execute(sql`DELETE FROM wmd_notifications WHERE source_id LIKE ${'%' + TS + '%'} OR target_id LIKE ${'%' + TS + '%'}`);
  await db.execute(sql`DELETE FROM players WHERE username IN (${atkPlayer}, ${vic1}, ${vic2}, ${atk2}, ${vicB1}, ${vicB2})`);
  await db.execute(sql`DELETE FROM clans WHERE id IN (${atkClan}, ${vicClan}, ${atkClan2}, ${vicClan2})`);
}

async function main(): Promise<void> {
  console.log('FID-20260919-018 clan-consequences live probe\n');
  await cleanup();

  await insertClan(atkClan, `ZAtk${TS}`, 'ZKA', atkPlayer);
  await insertClan(vicClan, `ZVic${TS}`, 'ZKV', vic1);
  await insertPlayer(atkPlayer, atkClan);
  await insertPlayer(vic1, vicClan);
  await insertPlayer(vic2, vicClan);
  // Give the attacker clan a research pool so the penalty is observable.
  await db.execute(sql`UPDATE clans SET research_research_points = 5000 WHERE id = ${atkClan}`);

  // P1–P3 — the real consequence flow.
  const res = await applyClanWMDConsequences(atkClan, 'ZAtk', vicClan, 'ZVic', 'TACTICAL');
  check('P1a consequence flow reports success', res.success === true, res);

  const atk = (await rows(sql`SELECT wmd_cooldown_until, research_research_points FROM clans WHERE id = ${atkClan}`))[0];
  const hoursOut = atk?.wmd_cooldown_until
    ? (new Date(atk.wmd_cooldown_until as string).getTime() - Date.now()) / 3_600_000
    : -1;
  check('P1b cooldown column set to ~24h (the old writer wrote nothing)', hoursOut > 23.5 && hoursOut < 24.5, { hoursOut });
  check('P1c clan research pool reduced by 2000 (5000 -> 3000)', Number(atk?.research_research_points) === 3000, atk);

  const rel = (await rows(sql`SELECT clan_id1, clan_id2, relation FROM clan_relations WHERE (clan_id1=${atkClan} AND clan_id2=${vicClan}) OR (clan_id1=${vicClan} AND clan_id2=${atkClan})`))[0];
  const sorted = [atkClan, vicClan].sort();
  check('P2 relations row exists with ENEMY', rel?.relation === 'ENEMY', rel);
  check('P2b the pair is canonical (sorted)', rel?.clan_id1 === sorted[0] && rel?.clan_id2 === sorted[1], { rel, sorted });

  const rights = await rows(sql`SELECT id, player_id, can_retaliate_against_clan FROM wmd_retaliation_rights WHERE player_clan_id = ${vicClan}`);
  check('P3a one retaliation right per victim member', rights.length === 2, rights.length);
  check('P3b all retaliation PKs fit the varchar(50) column', rights.every((r) => String(r.id).length <= 50), rights.map((r) => String(r.id).length));
  check('P3c rights target the aggressor clan', rights.every((r) => r.can_retaliate_against_clan === atkClan));

  // P4 — cooldown reader.
  check('P4a isClanOnWMDCooldown reports active', (await isClanOnWMDCooldown(atkClan)).onCooldown === true);
  await db.execute(sql`UPDATE clans SET wmd_cooldown_until = now() - interval '1 hour' WHERE id = ${atkClan}`);
  check('P4b an expired cooldown reports inactive', (await isClanOnWMDCooldown(atkClan)).onCooldown === false);

  // P5 — the launch gate REFUSES a cooldown-clan launch (real launchMissile).
  await db.execute(sql`UPDATE clans SET wmd_cooldown_until = now() + interval '12 hours' WHERE id = ${atkClan}`);
  await db.execute(sql`INSERT INTO missiles (id, missile_id, owner_id, owner_clan_id, warhead_type, status, created_at, updated_at)
    VALUES (${missileRowId}, ${missilePubId}, ${atkPlayer}, ${atkClan}, 'TACTICAL', 'READY', now(), now())`);
  const refused = await launchMissile(missileRowId, vic1, atkPlayer);
  check('P5 launch refused while the clan is on cooldown', refused.success === false && /cooldown/i.test(refused.message), refused);
  const stillReady = (await rows(sql`SELECT status FROM missiles WHERE id = ${missileRowId}`))[0];
  check('P5b the refused missile stays READY (no committed launch)', stillReady?.status === 'READY', stillReady);

  // P6 — a retaliation right lets the victim clan retaliate through the gate.
  // The victim holds rights against the ATTACKER's clan, so a victim launch at
  // the attacker must be allowed even though the victim... has no cooldown. To
  // exercise the bypass we give the VICTIM a cooldown too and launch at the
  // attacker: the right must override it.
  check('P6a the victim holds a right against the aggressor', (await hasRetaliationRights(vic1, atkClan)).hasRights === true);
  await db.execute(sql`UPDATE clans SET wmd_cooldown_until = now() + interval '12 hours' WHERE id = ${vicClan}`);
  const vicMissile = generateId();
  const vicPub = `zcmv${TS}`.slice(0, 50);
  await db.execute(sql`INSERT INTO missiles (id, missile_id, owner_id, owner_clan_id, warhead_type, status, created_at, updated_at)
    VALUES (${vicMissile}, ${vicPub}, ${vic1}, ${vicClan}, 'TACTICAL', 'READY', now(), now())`);
  const allowed = await launchMissile(vicMissile, atkPlayer, vic1);
  check('P6b a retaliation right lets the launch through the cooldown gate', allowed.success === true, allowed);
  check('P6c the retaliation right was consumed', (await hasRetaliationRights(vic1, atkClan)).hasRights === false);
  await db.execute(sql`DELETE FROM missiles WHERE id = ${vicMissile}`);
  await consumeRetaliationRight(vic1, atkClan); // idempotent no-op cleanup

  // P8 — INTEGRATED: a real detonation through the tracker's own sweep. This is
  // the FID's actual deliverable — the service working in isolation (P1–P6)
  // does not prove the hook fires in the live impact path.
  await insertClan(atkClan2, `ZAtk2${TS}`, 'ZKB', atk2);
  await insertClan(vicClan2, `ZVic2${TS}`, 'ZKW', vicB1);
  await insertPlayer(atk2, atkClan2);
  await insertPlayer(vicB1, vicClan2);
  await insertPlayer(vicB2, vicClan2);
  await db.execute(sql`UPDATE clans SET research_research_points = 5000 WHERE id = ${atkClan2}`);
  // vicClan2 gets NO defense batteries, so interception is deterministically
  // false and the missile reaches the consequence hook.
  await db.execute(sql`INSERT INTO missiles
    (id, missile_id, owner_id, owner_clan_id, warhead_type, status, target_id, launched_by,
     launched_at, impact_at, flight_time, created_at, updated_at)
    VALUES (${detMissileId}, ${detMissilePubId}, ${atk2}, ${atkClan2}, 'TACTICAL', 'LAUNCHED',
            ${vicB1}, ${atk2}, now() - interval '10 minutes', now() - interval '5 minutes', 5,
            now(), now())`);

  const processed = await processDueMissiles();
  check('P8a the tracker sweep picked up the due missile', processed === 1, processed);

  const det = (await rows(sql`SELECT status FROM missiles WHERE id = ${detMissileId}`))[0];
  check('P8b the missile detonated (not intercepted, not skipped)', det?.status === 'DETONATED', det);

  const atk2Row = (await rows(sql`SELECT wmd_cooldown_until, research_research_points FROM clans WHERE id = ${atkClan2}`))[0];
  const hours2 = atk2Row?.wmd_cooldown_until
    ? (new Date(atk2Row.wmd_cooldown_until as string).getTime() - Date.now()) / 3_600_000
    : -1;
  check('P8c the DETONATION applied the ~24h cooldown (the hook fires in the real path)', hours2 > 23.5 && hours2 < 24.5, { hours2 });
  check('P8d the detonation charged the clan research pool (5000 -> 3000)', Number(atk2Row?.research_research_points) === 3000, atk2Row);

  const rel2 = (await rows(sql`SELECT relation FROM clan_relations WHERE (clan_id1=${atkClan2} AND clan_id2=${vicClan2}) OR (clan_id1=${vicClan2} AND clan_id2=${atkClan2})`))[0];
  check('P8e the detonation set the relation to ENEMY', rel2?.relation === 'ENEMY', rel2);

  const rights2 = await rows(sql`SELECT id FROM wmd_retaliation_rights WHERE player_clan_id = ${vicClan2}`);
  check('P8f the detonation granted retaliation rights to the victim clan', rights2.length === 2, rights2.length);

  const notice = await rows(sql`SELECT id FROM messages WHERE recipient_id = ${atk2} AND metadata_system_type = 'wmd_consequences'`);
  check('P8g the launcher was told through the FID-013 notification seam', notice.length >= 1, notice.length);

  // P7 — cleanup.
  await cleanup();
  const residue = await rows(sql`SELECT
    (SELECT count(*)::int FROM clans WHERE id IN (${atkClan}, ${vicClan}, ${atkClan2}, ${vicClan2})) AS c,
    (SELECT count(*)::int FROM players WHERE username LIKE ${'%' + TS + '%'}) AS p,
    (SELECT count(*)::int FROM wmd_retaliation_rights WHERE player_clan_id IN (${vicClan}, ${vicClan2})) AS r,
    (SELECT count(*)::int FROM messages WHERE recipient_id LIKE ${'%' + TS + '%'}) AS m,
    (SELECT count(*)::int FROM wmd_alerts WHERE clan_id IN (${atkClan}, ${vicClan}, ${atkClan2}, ${vicClan2})) AS a`);
  check(
    'P7 probe cleanup left no residue (clans, players, rights, notifications, alerts)',
    Number(residue[0]?.c) === 0 && Number(residue[0]?.p) === 0 && Number(residue[0]?.r) === 0 &&
      Number(residue[0]?.m) === 0 && Number(residue[0]?.a) === 0,
    residue[0]
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('probe crashed:', err);
  await cleanup().catch(() => {});
  process.exit(1);
});
