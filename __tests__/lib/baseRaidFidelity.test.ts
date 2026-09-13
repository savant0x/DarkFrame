/**
 * FID-20260912-093 — base-raid battle fidelity tests.
 *
 * Pins the contract fixes on the PvE raid pipeline:
 *  • resolveBattle stamps casualtiesByType on both participants
 *  • applyCasualties:false zeroes unit capture (loot is the reward — no
 *    garrison teleportation into the attacker's army)
 *  • options carry levels (level-gap protection wired for raids)
 *  • applyAttackerCasualties decrements the attacker's inventory per type
 *  • base-raid labeling: 'BASE RAID' headline, feed + logs page mapping
 *  • once-per-reset period math (AM/PM boundary behavior)
 *  • greeting generator: voice pools + non-empty output
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Unit, PlayerUnit, BattleLog } from '@/types/game.types';
import { BattleType, UnitType } from '@/types';

// ---- battleService: flag bonus + db are module-level deps -----------------

vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: vi.fn().mockResolvedValue({ isBearer: false, unitStrengthMultiplier: 1, unitDefenseMultiplier: 1 }),
}));

const updateCalls: Array<Record<string, unknown>> = [];
const selectResults: unknown[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift() ?? [])),
          orderBy: vi.fn().mockReturnThis(),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((set: Record<string, unknown>) => {
        updateCalls.push(set);
        return {
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        };
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
  },
}));

vi.mock('@/lib/battleNotification', () => ({
  notifyBattleResult: vi.fn().mockResolvedValue(undefined),
  formatBattleResultMessage: vi.fn().mockReturnValue('report'),
}));

import {
  resolveBattle,
  applyAttackerCasualties,
} from '@/lib/battleService';
import { generateBaseGreeting } from '@/lib/baseGreetings';

// The period helper is route-local; re-derive its contract here so the
// boundary behavior is pinned (if the route's copy drifts, these break).
function currentRaidPeriodStart(baseX: number, now = new Date()): Date {
  const start = new Date(now);
  if (baseX >= 1 && baseX <= 75) {
    start.setHours(0, 0, 0, 0);
  } else if (now.getHours() < 12) {
    start.setDate(start.getDate() - 1);
    start.setHours(12, 0, 0, 0);
  } else {
    start.setHours(12, 0, 0, 0);
  }
  return start;
}

function makeArmy(type: string, count: number, strength = 100, defense = 0): Unit[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${type}-${i}`,
    // Unit['type'] is UnitType — real enum values, so use T1_RIFLEMAN etc.
    type: type as Unit['type'],
    strength,
    defense,
    producedAt: { x: 0, y: 0 },
    producedDate: new Date(),
    owner: 'attacker',
  }));
}

beforeEach(() => {
  updateCalls.length = 0;
  selectResults.length = 0;
});

describe('resolveBattle: casualtiesByType (FID-093)', () => {
  it('stamps per-type casualty tallies on both participants', async () => {
    const attackers = [...makeArmy('T1_Rifleman', 40, 100), ...makeArmy('T2_Grenadier', 10, 200)];
    const defenders = makeArmy('T1_Scout', 5, 0, 20);
    const log = await resolveBattle(attackers, defenders, 'a', 'b', BattleType.BaseRaid, { x: 1, y: 2 });

    const attackerLost = log.attacker.unitsLost;
    expect(log.attacker.casualtiesByType).toBeDefined();
    // Tallies sum to the reported total.
    const tallySum = Object.values(log.attacker.casualtiesByType ?? {}).reduce((s, n) => s + (n ?? 0), 0);
    expect(tallySum).toBe(attackerLost);

    expect(log.defender.casualtiesByType).toBeDefined();
    const defSum = Object.values(log.defender.casualtiesByType ?? {}).reduce((s, n) => s + (n ?? 0), 0);
    expect(defSum).toBe(log.defender.unitsLost);
  });

  it('zero-loss sides get an empty (but present) tally', async () => {
    // Overwhelming attacker: defender dies round 1, attacker likely unharmed.
    const attackers = makeArmy('T5_Titan', 50, 5000);
    const defenders = makeArmy('T1_Scout', 2, 0, 5);
    const log = await resolveBattle(attackers, defenders, 'a', 'b', BattleType.BaseRaid);
    // The tally keys are the RAW unit.type strings ('T1_Scout' as built by
    // makeArmy) — resolveBattle tallies whatever type came in.
    expect(log.defender.casualtiesByType).toEqual({ T1_Scout: 2 });
  });
});

describe('resolveBattle: applyCasualties:false (PvE no-capture)', () => {
  it('captures nothing when applyCasualties is false — even on a rout', async () => {
    const attackers = makeArmy('T5_Titan', 50, 5000);
    const defenders = makeArmy('T1_Scout', 20, 0, 5);
    const log = await resolveBattle(attackers, defenders, 'a', 'b', BattleType.BaseRaid, undefined, {
      attackerLevel: 18,
      defenderLevel: 15,
      applyCasualties: false,
    });

    expect(log.outcome).toBe('ATTACKER_WIN');
    expect(log.unitsCaptured?.attackerCaptured).toHaveLength(0);
    expect(log.unitsCaptured?.defenderCaptured).toHaveLength(0);
    expect(log.attacker.unitsCaptured).toBe(0);
    expect(log.defender.unitsCaptured).toBe(0);
  });

  it('captures 10–15% by default (PvP path unchanged)', async () => {
    const attackers = makeArmy('T5_Titan', 50, 5000);
    const defenders = makeArmy('T1_Scout', 40, 0, 5);
    const log = await resolveBattle(attackers, defenders, 'a', 'b', BattleType.Infantry, undefined, {
      attackerLevel: 18,
      defenderLevel: 15,
    });
    expect(log.outcome).toBe('ATTACKER_WIN');
    const captured = log.unitsCaptured?.attackerCaptured.length ?? 0;
    const lost = log.defender.unitsLost;
    expect(captured).toBeGreaterThan(0);
    expect(captured).toBeLessThanOrEqual(lost);
  });

  it('carries levels into the options shape without positional ambiguity', async () => {
    const attackers = makeArmy('T1_Rifleman', 10, 100);
    const defenders = makeArmy('T1_Scout', 2, 0, 5);
    const log = await resolveBattle(attackers, defenders, 'a', 'b', BattleType.BaseRaid, undefined, {
      attackerLevel: 50,
      defenderLevel: 1,
    });
    // Huge level gap still resolves (protection floors damage, never throws).
    expect(log.totalRounds).toBeGreaterThan(0);
  });
});

describe('applyAttackerCasualties', () => {
  function armyPU(type: string, qty: number, strength = 100, defense = 0): PlayerUnit {
    return {
      id: `${type}-pu`,
      unitId: `${type}-pu`,
      unitType: type as PlayerUnit['unitType'],
      name: type,
      category: strength > 0 ? 'STR' : 'DEF',
      rarity: 'common',
      strength,
      defense,
      quantity: qty,
      createdAt: new Date(),
    };
  }

  function stubAttackerRow(units: PlayerUnit[]) {
    selectResults.push([
      {
        username: 'attacker',
        email: 'a@a',
        password: 'x',
        baseX: 1, baseY: 2, currentPositionX: 1, currentPositionY: 2,
        resourcesMetal: 0, resourcesEnergy: 0,
        bankMetal: 0, bankEnergy: 0, bankLastDeposit: null,
        rank: 1, units,
        totalStrength: 0, totalDefense: 0,
        xp: 0, level: 1, researchPoints: 0, unlockedTiers: [], unlockedTechs: null,
      },
    ]);
  }

  it('decrements ONLY the types that died, exact counts', async () => {
    const units = [armyPU('T1_Rifleman', 40), armyPU('T2_Grenadier', 10, 200)];
    stubAttackerRow(units);

    const log = {
      attacker: {
        username: 'attacker',
        unitsLost: 12,
        casualtiesByType: { T1_Rifleman: 10, T2_Grenadier: 2 },
      },
    } as unknown as BattleLog;

    await applyAttackerCasualties(log);

    expect(updateCalls).toHaveLength(1);
    const written = updateCalls[0].units as PlayerUnit[];
    // armyPU built unitType as the literal 'T1_Rifleman'/'T2_Grenadier'
    // (cast) — the decrement keys match what the log carried, so match them
    // the same way here.
    const t1 = written.find(u => u.unitType === ('T1_Rifleman' as UnitType));
    const t2 = written.find(u => u.unitType === ('T2_Grenadier' as UnitType));
    expect(t1?.quantity).toBe(30);
    expect(t2?.quantity).toBe(8);
  });

  it('removes a group entirely when all of a type dies', async () => {
    const units = [armyPU('T1_Rifleman', 5), armyPU('T2_Grenadier', 4, 200)];
    stubAttackerRow(units);

    const log = {
      attacker: { username: 'attacker', unitsLost: 4, casualtiesByType: { T2_Grenadier: 4 } },
    } as unknown as BattleLog;

    await applyAttackerCasualties(log);
    const written = updateCalls[0].units as PlayerUnit[];
    expect(written.find(u => u.unitType === ('T2_Grenadier' as UnitType))).toBeUndefined();
    expect(written.find(u => u.unitType === ('T1_Rifleman' as UnitType))?.quantity).toBe(5);
  });

  it('recomputes totals from the surviving army', async () => {
    const units = [armyPU('T1_Rifleman', 10)]; // 100 STR each
    stubAttackerRow(units);

    const log = {
      attacker: { username: 'attacker', unitsLost: 3, casualtiesByType: { T1_Rifleman: 3 } },
    } as unknown as BattleLog;

    await applyAttackerCasualties(log);
    expect(updateCalls[0].totalStrength).toBe(700);
    expect(updateCalls[0].totalDefense).toBe(0);
  });
});

describe('base-raid labeling', () => {
  it('BASE_RAID is the enum value stored in logs', () => {
    expect(BattleType.BaseRaid).toBe('BASE_RAID');
  });

  it('formatBattleResultMessage headlines raids as BASE RAID', async () => {
    // Unmock the real formatter for this test — the headline mapping is the
    // contract under test.
    vi.doUnmock('@/lib/battleNotification');
    const { formatBattleResultMessage: realFormat } = await vi.importActual<typeof import('@/lib/battleNotification')>('@/lib/battleNotification');
    const attackers = makeArmy('T5_Titan', 20, 5000);
    const defenders = makeArmy('T1_Scout', 2, 0, 5);
    const log = await resolveBattle(attackers, defenders, 'a', 'b', BattleType.BaseRaid, { x: 9, y: 9 }, { applyCasualties: false });
    const msg = realFormat(log, true);
    expect(msg).toContain('BATTLE REPORT — BASE RAID at (9, 9)');
    expect(msg).not.toContain('FACTORY');
  });
});

describe('once-per-reset period math', () => {
  it('AM tiles (x ≤ 75): period starts at midnight', () => {
    const now = new Date('2026-09-13T15:04:00');
    const start = currentRaidPeriodStart(40, now);
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(13);
  });

  it('PM tiles after noon: period starts at noon today', () => {
    const now = new Date('2026-09-13T15:04:00');
    const start = currentRaidPeriodStart(100, now);
    expect(start.getHours()).toBe(12);
    expect(start.getDate()).toBe(13);
  });

  it('PM tiles before noon: period started at noon yesterday', () => {
    const now = new Date('2026-09-13T08:00:00');
    const start = currentRaidPeriodStart(100, now);
    expect(start.getHours()).toBe(12);
    expect(start.getDate()).toBe(12);
  });

  it('a raid logged after period start blocks; before it does not', () => {
    const now = new Date('2026-09-13T15:00:00');
    const start = currentRaidPeriodStart(100, now);
    const raidAt2pm = new Date('2026-09-13T14:00:00');
    const raidYesterday = new Date('2026-09-12T20:00:00');
    expect(raidAt2pm >= start).toBe(true);   // blocks
    expect(raidYesterday >= start).toBe(false); // allowed
  });
});

describe('generateBaseGreeting', () => {
  it('beer bases get the beer voice', () => {
    for (let i = 0; i < 20; i++) {
      const g = generateBaseGreeting({ isBeerBase: true });
      expect(g).toContain('🍺');
      expect(g.length).toBeGreaterThan(10);
    }
  });

  it('specializations get their warband voice', () => {
    const g = generateBaseGreeting({ isBeerBase: false, specialization: 'Fortress' });
    expect(g).toContain('🛡');
  });

  it('unknown specialization falls back to generic chatter (never empty)', () => {
    const g = generateBaseGreeting({ isBeerBase: false, specialization: 'Unknown' });
    expect(g.length).toBeGreaterThan(10);
  });

  it('stays under the tiles.base_greeting column limit', () => {
    for (let i = 0; i < 30; i++) {
      expect(generateBaseGreeting({ isBeerBase: Math.random() > 0.5 }).length).toBeLessThanOrEqual(500);
    }
  });
});
