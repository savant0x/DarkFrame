/**
 * FID-20260916-012 — LIVE round-trip probe for the clan research panel seams.
 * Runs against the real dev DB (DATABASE_URL from .env.local). Exercises the
 * exact chain the panel drives, in order:
 *
 *   1. STATE       — getResearchTree(clanId): 4 MILITARY nodes + fund balance.
 *   2. CONTRIBUTE  — contributeRP(clanId, member, 500): member's personal RP
 *                    drops by 500, clan fund rises by 500.
 *   3. UNLOCK      — unlockResearch(clanId, leader, 'mil_combat_1'): fund pays
 *                    the node cost, tech recorded in researchUnlockedTechs.
 *   4. ROLE GATE   — unlockResearch as MEMBER refuses 'Insufficient permissions'.
 *
 * Identities are varchar(20)-safe base36 (the -011 lesson). Cleanup removes
 * every probe row. One-shot; explicit exit (pg keeps the loop alive).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { closeConnection } from '@/lib/db/connection';
import { players } from '@/lib/db/schema/players';
import { clans } from '@/lib/db/schema/clans';
import { getResearchTree, contributeRP, unlockResearch } from '@/lib/clanResearchService';
import { ClanRole } from '@/types/clan.types';

const STAMP = Date.now().toString(36);
const LEADER = `f012${STAMP}L`.slice(0, 20);
const MEMBER = `f012${STAMP}M`.slice(0, 20);
const CLAN_ID = `f012c${STAMP}`.slice(0, 24);
const CLAN_NAME = `ProbeClan${STAMP}`.slice(0, 30);

function member(playerId: string, role: ClanRole) {
  return { playerId, username: playerId, role, joinedAt: new Date(), lastActive: new Date() };
}

async function fundOf(): Promise<number> {
  const [clan] = await db.select({ researchResearchPoints: clans.researchResearchPoints })
    .from(clans).where(eq(clans.id, CLAN_ID));
  return clan.researchResearchPoints;
}

async function rpOf(username: string): Promise<number> {
  const [row] = await db.select({ researchPoints: players.researchPoints })
    .from(players).where(eq(players.username, username));
  return row.researchPoints;
}

async function seed(): Promise<void> {
  await db.insert(players).values([
    { username: LEADER, email: `${LEADER}@probe.invalid`, password: 'x', researchPoints: 10000,
      level: 1, baseX: 1, baseY: 1, currentPositionX: 1, currentPositionY: 1 },
    { username: MEMBER, email: `${MEMBER}@probe.invalid`, password: 'x', researchPoints: 800,
      level: 1, baseX: 1, baseY: 1, currentPositionX: 1, currentPositionY: 1 },
  ]).onConflictDoNothing();

  await db.insert(clans).values({
    id: CLAN_ID,
    name: CLAN_NAME,
    tag: 'P12',
    description: 'FID-20260916-012 probe clan',
    leaderId: LEADER,
    members: [member(LEADER, ClanRole.LEADER), member(MEMBER, ClanRole.MEMBER)],
    levelCurrentLevel: 5,
    researchResearchPoints: 0,
    researchUnlockedTechs: [],
    createdAt: new Date(),
  }).onConflictDoNothing();
}

async function main(): Promise<void> {
  console.log('=== FID-20260916-012 live probe: clan research round-trip ===');
  await seed();

  // -- 1. STATE -------------------------------------------------------------
  console.log('\n--- 1. STATE (getResearchTree) ---');
  const tree = await getResearchTree(CLAN_ID);
  console.log(`nodes: MILITARY=${tree.MILITARY.length} INDUSTRIAL=${tree.INDUSTRIAL.length} ECONOMIC=${tree.ECONOMIC.length} SOCIAL=${tree.SOCIAL.length}`);
  console.log(`clanLevel=${tree.clanLevel} fund=${tree.researchPoints}`);
  if (tree.MILITARY.length !== 4) throw new Error(`expected 4 MILITARY nodes, got ${tree.MILITARY.length}`);
  if (tree.INDUSTRIAL.length || tree.ECONOMIC.length || tree.SOCIAL.length) {
    throw new Error('C1 cut violated: non-military branches must be empty');
  }
  if (tree.researchPoints !== 0) throw new Error('fund must start at 0');

  // -- 2. CONTRIBUTE ---------------------------------------------------------
  console.log('\n--- 2. CONTRIBUTE (member contributes 500 RP) ---');
  const beforeMember = await rpOf(MEMBER);
  const beforeFund = await fundOf();
  const contrib = await contributeRP(CLAN_ID, MEMBER, 500);
  const afterMember = await rpOf(MEMBER);
  const afterFund = await fundOf();
  console.log(`member RP: ${beforeMember} -> ${afterMember}; fund: ${beforeFund} -> ${afterFund}`);
  if (beforeMember - afterMember !== 500) throw new Error('personal RP must drop by exactly 500');
  if (afterFund - beforeFund !== 500) throw new Error('fund must rise by exactly 500');
  if (contrib.newTotal !== afterFund) throw new Error('service newTotal must match the fund');
  const nodeCost = tree.MILITARY.find((n) => n.id === 'mil_combat_1')?.cost;
  if (nodeCost === undefined) throw new Error('mil_combat_1 missing from tree');

  // -- 2b. LEADER contribution tops the fund up to the node cost -------------
  const fundBeforeLeader = await fundOf();
  await contributeRP(CLAN_ID, LEADER, nodeCost - fundBeforeLeader);
  console.log(`leader topped the fund to ${nodeCost} (node cost)`);

  // -- 3. UNLOCK ---------------------------------------------------------------
  console.log('\n--- 3. UNLOCK (leader unlocks mil_combat_1, cost 5000) ---');
  const fundBeforeUnlock = await fundOf();
  const node = tree.MILITARY.find((n) => n.id === 'mil_combat_1');
  if (!node) throw new Error('mil_combat_1 missing from tree');
  console.log(`node cost=${node.cost}; fund=${fundBeforeUnlock}`);
  const unlocked = await unlockResearch(CLAN_ID, LEADER, 'mil_combat_1');
  console.log(`unlocked: ${unlocked.research.name}`); // note: unlock's return carries research + totalBonuses, not a newTotal (cosmetic log fixed at typecheck)
  const [clanAfter] = await db.select({ techs: clans.researchUnlockedTechs, researchResearchPoints: clans.researchResearchPoints })
    .from(clans).where(eq(clans.id, CLAN_ID));
  console.log(`techs now: ${JSON.stringify(clanAfter.techs)}; fund now: ${clanAfter.researchResearchPoints}`);
  if (!clanAfter.techs.includes('mil_combat_1')) throw new Error('unlocked tech must be recorded');
  if (clanAfter.researchResearchPoints !== fundBeforeUnlock - node.cost) {
    throw new Error('fund must drop by exactly the node cost');
  }

  // -- 4. ROLE GATE ----------------------------------------------------------
  console.log('\n--- 4. ROLE GATE (member unlock attempt must refuse) ---');
  try {
    await unlockResearch(CLAN_ID, MEMBER, 'mil_tactics_1');
    throw new Error('member unlock must have been refused');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`refusal message: "${msg}"`);
    if (!msg.includes('Insufficient permissions')) throw new Error(`unexpected refusal: ${msg}`);
  }

  console.log('\n=== PROBE PASSED: state -> contribute -> unlock -> role gate verified live ===');
}

async function cleanup(): Promise<void> {
  await db.delete(clans).where(eq(clans.id, CLAN_ID));
  await db.delete(players).where(eq(players.username, LEADER));
  await db.delete(players).where(eq(players.username, MEMBER));
  console.log('probe rows removed');
}

async function run(): Promise<number> {
  try {
    await main();
    return 0;
  } catch (err) {
    console.error('\n=== PROBE FAILED ===');
    console.error(err instanceof Error ? err.message : err);
    const cause = (err as { cause?: unknown })?.cause;
    if (cause) console.error('cause:', cause instanceof Error ? cause.message : cause);
    return 1;
  }
}

run()
  .catch(() => 1)
  .then((code) => {
    void Promise.resolve(cleanup().catch(() => undefined))
      .then(() => closeConnection())
      .finally(() => process.exit(code));
  });
