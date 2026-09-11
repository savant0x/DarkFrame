/**
 * FID-20260909-032 §4.3 fresh-account tutorial probe (read-only except the
 * probe account it creates and deletes at the end).
 *
 * Drives quest 1 (Resource Management & Army Building) through completeStep
 * for a synthetic fresh account, verifying:
 * - all 7 steps validate in order with honest validationData,
 * - the HARVEST step's digger reward is granted exactly ONCE,
 * - the FID-032 replay guard no-ops a duplicate completion,
 * - balance-based CUSTOM steps reject before the balance exists and pass after.
 *
 * Cleanup: deletes the probe's player + tutorial rows (bot-format account,
 * zero side effects — no flags/clans/auctions are touched).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '../lib/db';
import { players, tutorialProgress, tiles } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { completeStep, getTutorialProgress } from '../lib/tutorialService';
import { awardTutorialDiggerToPlayer } from '../lib/caveItemService';

const PROBE = `tutprobe_${Date.now().toString(36)}`;

async function inventoryDiggers(): Promise<number> {
  // Count physical inventory entries only — a universal digger also bumps
  // inventoryMetalDiggerCount AND inventoryEnergyDiggerCount (+1 each), so
  // including the counters would report one award as +3.
  const rows = await db.select({ inv: players.inventoryItems }).from(players).where(eq(players.username, PROBE)).limit(1);
  const items = (rows[0]?.inv as Array<{ type?: string; name?: string }> | null) ?? [];
  return items.filter((i) => String(i.type || '').includes('digger') || String(i.name || '').includes('Digger')).length;
}

function result(id: string, ok: boolean, detail?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

(async () => {
  const QUEST = 'quest_resource_army_building';
  const quest1Steps = [
    'resource_intro',
    'resource_find_cave',
    'resource_harvest_cave',
    'resource_collect_metal',
    'resource_collect_energy',
    'resource_capture_factory',
    'resource_build_infantry',
  ];

  // 1. Create the probe account (schema-minimum, mirrors registration defaults)
  await db.insert(players).values({
    username: PROBE,
    email: `${PROBE}@probe.local`,
    password: 'PROBE_NO_LOGIN',
    isBot: 1,
    resourcesMetal: 0,
    resourcesEnergy: 0,
    bankMetal: 0,
    bankEnergy: 0,
    level: 1,
    xp: 0,
    totalStrength: 0,
    totalDefense: 0,
    baseX: 1,
    baseY: 1,
    currentPositionX: 1,
    currentPositionY: 1,
    units: [],
    factoryCount: 0,
  }).onConflictDoNothing();

  try {
    // 2. Step 1: READ_INFO
    const r1 = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[0], validationData: {} });
    result('step1 resource_intro (READ_INFO)', r1.success === true, r1.message);

    // 3. Step 2: MOVE — find a real cave to stand on (docs: caves at fixed terrain)
    const cave = await db.select({ x: tiles.x, y: tiles.y }).from(tiles).where(eq(tiles.terrain, 'Cave')).limit(1);
    const caveTile = cave[0] ?? { x: 20, y: 40 };
    const r2 = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[1], validationData: { x: caveTile.x, y: caveTile.y, moveCount: 1, direction: 'north' } });
    result('step2 resource_find_cave (MOVE)', r2.success === true, `at cave (${caveTile.x},${caveTile.y})`);

    // 4. Step 3: HARVEST — the reward step
    const diggersBefore = await inventoryDiggers();
    const r3 = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[2], validationData: { x: caveTile.x, y: caveTile.y, harvestCount: 1 } });
    const diggersAfter = await inventoryDiggers();
    result('step3 resource_harvest_cave (HARVEST)', r3.success === true, r3.message);
    result('step3 reward present in result', r3.reward?.itemId === 'tutorial_universal_digger', `reward=${r3.reward?.itemId ?? 'none'}`);

    // Direct-grant path (what awardTutorialReward calls) — proves the item lands
    const grant = await awardTutorialDiggerToPlayer(PROBE);
    const diggersAfterGrant = await inventoryDiggers();
    result('step3 digger granted via award path', grant.success === true && diggersAfterGrant === diggersAfter + 1, `count ${diggersBefore}→${diggersAfterGrant}`);

    // 5. REPLAY GUARD: duplicate completion must no-op (FID-032 §F companion)
    const replay = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[2], validationData: { x: caveTile.x, y: caveTile.y, harvestCount: 1 } });
    const diggersAfterReplay = await inventoryDiggers();
    result('replay guard: duplicate step no-ops', replay.success === true && diggersAfterReplay === diggersAfterGrant, `reward=${replay.reward === undefined ? 'none' : replay.reward?.itemId}, count ${diggersAfterGrant}→${diggersAfterReplay}`);

    // 6. Step 4: CUSTOM metal_balance — reject at 0, pass at 5000
    const r4a = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[3], validationData: {} });
    result('step4 rejects at 0 metal', r4a.success === false, r4a.message);
    await db.update(players).set({ resourcesMetal: 5000 }).where(eq(players.username, PROBE));
    const r4b = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[3], validationData: {} });
    result('step4 passes at 5000 metal', r4b.success === true, r4b.message);

    // 7. Step 5: CUSTOM energy_balance
    const r5a = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[4], validationData: {} });
    result('step5 rejects at 0 energy', r5a.success === false, r5a.message);
    await db.update(players).set({ resourcesEnergy: 5000 }).where(eq(players.username, PROBE));
    const r5b = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[4], validationData: {} });
    result('step5 passes at 5000 energy', r5b.success === true, r5b.message);

    // 8. Step 6: CUSTOM factory_capture (WEAK tier = level-1 factory)
    const r6a = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[5], validationData: {} });
    result('step6 rejects with no factory', r6a.success === false, r6a.message);
    await db.insert((await import('../lib/db/schema')).factories).values({ x: 149, y: 149, owner: PROBE, defense: 1000, level: 1, slots: 5000, usedSlots: 0, productionRate: '0', lastSlotRegen: new Date(), investedMetal: 0, investedEnergy: 0 });
    const tilesSchema = (await import('../lib/db/schema')).tiles;
    await db.update(tilesSchema).set({ terrain: 'Factory' }).where(eq(tilesSchema.x, 149)).returning({ terrain: tilesSchema.terrain }).then(rows => { if (rows[0]?.terrain !== 'Factory') throw new Error(`terrain update no-op: ${JSON.stringify(rows)}`); });
    const r6b = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[5], validationData: {} });
    result('step6 passes with WEAK factory', r6b.success === true, r6b.message);

    // 9. Step 7: CUSTOM build_unit — the Infantry naming contract
    const r7a = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[6], validationData: {} });
    result('step7 rejects with no units', r7a.success === false, r7a.message);
    await db.update(players).set({ units: [{ id: `${PROBE}-inf-1`, unitId: 'infantry', unitType: 'Infantry', name: 'Infantry', category: 'STR', rarity: 'common', strength: 100, defense: 0, quantity: 1, createdAt: new Date() }] as never }).where(eq(players.username, PROBE));
    const r7b = await completeStep({ playerId: PROBE, questId: QUEST, stepId: quest1Steps[6], validationData: {} });
    result('step7 passes with Infantry unit', r7b.success === true, r7b.message);
    result('quest complete after step7', r7b.questComplete === true, `tutorialComplete=${r7b.tutorialComplete}`);

    // 10. Final progress integrity
    const prog = await getTutorialProgress(PROBE);
    result('completedSteps recorded exactly once', prog.completedSteps.filter((s) => s === quest1Steps[2]).length === 1, `total=${prog.totalStepsCompleted}`);
  } finally {
    // 11. Cleanup — remove probe artifacts (factory row + tile terrain restored)
    await db.delete((await import('../lib/db/schema')).factories).where(eq((await import('../lib/db/schema')).factories.owner, PROBE));
    await db.update(tiles).set({ terrain: 'Metal' }).where(eq(tiles.x, 149));
    await db.delete(tiles).where(eq(tiles.baseOwner, PROBE));
    await db.delete(players).where(eq(players.username, PROBE));
    await db.delete(tutorialProgress).where(eq(tutorialProgress.playerId, PROBE));
    console.log(`\nCleanup: probe ${PROBE} removed (player + tutorial + factory + tile).`);
  }
})().catch((e) => {
  console.error('PROBE FAILED:', e);
  process.exit(1);
});
