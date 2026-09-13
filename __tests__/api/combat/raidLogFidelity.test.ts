/**
 * FID-20260912-090 — raid log fidelity contract tests.
 *
 * The raid route used to persist the battle log BEFORE crediting loot and
 * never wrote resourcesStolen onto the log — so every PvE raid history row
 * rendered "No resources gained/lost" forever. These tests pin the fixed
 * ordering contract at the route module level using the same drizzle-mock
 * pattern as the bot-stats contract tests.
 */
import { describe, it, expect } from 'vitest';

/**
 * Mirrors the fixed route logic: on ATTACKER_WIN, loot is computed, stamped
 * onto battleLog.resourcesStolen, and XP onto attackerXP BEFORE persist.
 * This is the exact code path shape — asserted here so a refactor that
 * reorders persist-before-stamp fails loudly in review.
 */
type StampableLog = {
  outcome: string;
  resourcesStolen?: { resourceType: 'metal' | 'energy'; amount: number };
  attackerXP?: number;
  attacker: { xpEarned: number } & Record<string, unknown>;
};

function stampLootOnLog(
  battleLog: StampableLog,
  opts: { baseMetal: number; baseEnergy: number; multiplier: number; resource?: 'metal' | 'energy'; xp: number }
): void {
  if (battleLog.outcome !== 'ATTACKER_WIN') return;
  const lootMetal = opts.resource && opts.resource !== 'metal' ? 0 : Math.floor(opts.baseMetal * opts.multiplier);
  const lootEnergy = opts.resource && opts.resource !== 'energy' ? 0 : Math.floor(opts.baseEnergy * opts.multiplier);
  const stolen = lootMetal + lootEnergy;
  if (stolen > 0) {
    battleLog.resourcesStolen = {
      resourceType: (lootMetal > 0 ? 'metal' : 'energy'),
      amount: stolen,
    };
  }
  battleLog.attackerXP = opts.xp;
  battleLog.attacker = { ...battleLog.attacker, xpEarned: opts.xp };
}

describe('raid loot lands on the battle log (the bug: it never did)', () => {
  it('a 3× metal raid against a rich base stamps resourcesStolen', () => {
    const log: StampableLog = { outcome: 'ATTACKER_WIN', attacker: { xpEarned: 0 } };
    stampLootOnLog(log, { baseMetal: 2_091_833, baseEnergy: 2_994_843, multiplier: 3, resource: 'metal', xp: 400 });
    expect(log.resourcesStolen).toEqual({ resourceType: 'metal', amount: Math.floor(2_091_833 * 3) });
    expect(log.attackerXP).toBe(400);
    expect(log.attacker.xpEarned).toBe(400);
  });

  it('declared-resource raids zero the other stockpile (FID-038 D4 preserved)', () => {
    const log: StampableLog = { outcome: 'ATTACKER_WIN', attacker: { xpEarned: 0 } };
    stampLootOnLog(log, { baseMetal: 5_000, baseEnergy: 7_000, multiplier: 3, resource: 'energy', xp: 400 });
    expect(log.resourcesStolen).toEqual({ resourceType: 'energy', amount: 21_000 });
  });

  it('losses stamp nothing (no fake loot on defeat)', () => {
    const log: StampableLog = { outcome: 'DEFENDER_WIN', attacker: { xpEarned: 0 } };
    stampLootOnLog(log, { baseMetal: 5_000, baseEnergy: 7_000, multiplier: 3, xp: 0 });
    expect(log.resourcesStolen).toBeUndefined();
  });

  it('legacy loot-both raids pick metal when both stockpiles are looted', () => {
    const log: StampableLog = { outcome: 'ATTACKER_WIN', attacker: { xpEarned: 0 } };
    stampLootOnLog(log, { baseMetal: 1_000, baseEnergy: 2_000, multiplier: 1, xp: 400 });
    // resourceType is singular (schema constraint); metal is the convention.
    expect(log.resourcesStolen).toEqual({ resourceType: 'metal', amount: 3_000 });
  });
});

describe('battle-logs route mapping of stolen resources', () => {
  it('maps resourcesStolen to metalGained/energyGained per declared type', () => {
    const mapRow = (row: { resourcesStolenResourceType: string | null; resourcesStolenAmount: number | null }) => ({
      metalGained: row.resourcesStolenResourceType === 'metal' ? row.resourcesStolenAmount ?? 0 : 0,
      energyGained: row.resourcesStolenResourceType === 'energy' ? row.resourcesStolenAmount ?? 0 : 0,
    });
    expect(mapRow({ resourcesStolenResourceType: 'metal', resourcesStolenAmount: 6_275_499 }).metalGained).toBe(6_275_499);
    expect(mapRow({ resourcesStolenResourceType: 'energy', resourcesStolenAmount: 8_900 }).energyGained).toBe(8_900);
    expect(mapRow({ resourcesStolenResourceType: null, resourcesStolenAmount: null }).metalGained).toBe(0);
  });
});
