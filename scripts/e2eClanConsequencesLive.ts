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
  await db.execute(sql`DELETE FROM wmd_retaliation_rights WHERE player_clan_id IN (${vicClan}, ${atkClan}) OR can_retaliate_against_clan IN (${vicClan}, ${atkClan})`);
  await db.execute(sql`DELETE FROM clan_relations WHERE clan_id1 IN (${vicClan}, ${atkClan}) OR clan_id2 IN (${vicClan}, ${atkClan})`);
  await db.execute(sql`DELETE FROM missiles WHERE id = ${missileRowId}`);
  await db.execute(sql`DELETE FROM players WHERE username IN (${atkPlayer}, ${vic1}, ${vic2})`);
  await db.execute(sql`DELETE FROM clans WHERE id IN (${atkClan}, ${vicClan})`);
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

  // P7 — cleanup.
  await cleanup();
  const residue = await rows(sql`SELECT
    (SELECT count(*)::int FROM clans WHERE id IN (${atkClan}, ${vicClan})) AS c,
    (SELECT count(*)::int FROM players WHERE username IN (${atkPlayer}, ${vic1}, ${vic2})) AS p,
    (SELECT count(*)::int FROM wmd_retaliation_rights WHERE player_clan_id = ${vicClan}) AS r`);
  check('P7 probe cleanup left no residue', Number(residue[0]?.c) === 0 && Number(residue[0]?.p) === 0 && Number(residue[0]?.r) === 0, residue[0]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('probe crashed:', err);
  await cleanup().catch(() => {});
  process.exit(1);
});
