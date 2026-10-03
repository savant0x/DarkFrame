// @vitest-environment node
/**
 * @file __tests__/lib/combatEffectsPairing.test.ts
 * @overview FID-20261002-012 §5 acceptance — the REAL resolveBattle and
 *           calculateCombatPower over paired fixtures that isolate clan
 *           research, combat discoveries, personal technologies and combined
 *           stacks: zero-stat axes stay zero, each bonus applies EXACTLY
 *           ONCE (§5.6), the display's effective stat breakdown equals the
 *           resolver's preparation for the same participant, and neutral
 *           inputs preserve the pre-FID baseline.
 *
 * EXACT ARITHMETIC (from production code, not assumptions):
 *   Fixture: attacker 1×T5_Titan (STR 1000/DEF 500) vs 5×T1_Scout (STR 0,
 *   DEF 100 each → totalDEF 500). calculateCombatStats sums per unit.
 *   Army balance is computed from the RAW stats: (1000,500) and (0,500) are
 *   BOTH CRITICAL (ratio 0.5 < 0.7) → dealt ×0.8, taken ×1.3.
 *   Attacker strike = floor(STR − DEF/2) [divisor 2] × 0.8 × 1.3:
 *     neutral → floor(1000 − 250)=750 → 750×0.8×1.3 = 780.
 *   Counter (Infantry divisor 3): floor(500 − 1000/3)=166 → 172 (not pinned).
 *   Effect multipliers join AFTER the balance chain, once (§5.6):
 *     strike_final = max(5, floor(strike × dealtEffects × targetTakenEffects)).
 *
 * The db mock serves the combat seam's batch side-row read; the effect
 * producers (clan/discovery/doctrine) are pinned per fixture through their
 * own module mocks. drizzle-orm's inArray is overridden to a harmless token
 * so the seam's read succeeds against the mock (the real operator would
 * demand drizzle Column objects the mock cannot provide).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Unit } from '@/types/game.types';
import { BattleType } from '@/types';

// ---- Hoisted mock state (factories are hoisted above module consts) --------

const sideRows = vi.hoisted(
  () => [] as Array<{ username: string; clanId: string | null; unlockedTechs: string[] | null }>,
);
const parityPlayerRow = vi.hoisted(() => ({
  username: 'attacker',
  totalStrength: 1000,
  totalDefense: 500,
  clanId: 'clanA' as string | null,
  clanName: 'ClanA' as string | null,
  unlockedTechs: [] as string[] | null,
}));

// ---- Module-mockable effect producers (batch reads) ------------------------

const clanBonusesByClan: Record<string, Record<string, number>> = {};
const discoveryBonusesByUser: Record<string, Record<string, number>> = {};
const doctrineByUser: Record<string, { strMul: number; defMul: number }> = {};

vi.mock('@/lib/clanResearchService', () => ({
  getClanBonusesForClans: vi.fn(async (clanIds: Array<string | null | undefined>) => {
    const out: Record<string, Record<string, number>> = {};
    for (const id of clanIds) {
      if (id && clanBonusesByClan[id]) out[id] = { ...clanBonusesByClan[id] };
    }
    return out;
  }),
  getClanBonuses: vi.fn(async (clanId: string) => clanBonusesByClan[clanId] ?? { attack: 0, defense: 0 }),
}));

vi.mock('@/lib/discoveryService', () => ({
  getDiscoveryBonusesForUsernames: vi.fn(async (usernames: string[]) => {
    const out: Record<string, Record<string, number>> = {};
    for (const u of usernames) {
      if (discoveryBonusesByUser[u]) out[u] = { ...discoveryBonusesByUser[u] };
    }
    return out;
  }),
  getDiscoveryBonuses: vi.fn(async (username: string) => discoveryBonusesByUser[username] ?? ({
    metalYield: 0, energyYield: 0, unitCostReduction: 0, factorySlots: 0, slotRegenSpeed: 0,
    unitDefense: 0, unitStrength: 0, damageDealt: 0, damageTakenReduction: 0, unitHp: 0,
    bankCapacity: 0, shrineBoostDuration: 0, fastTravel: false, xpMultiplier: 0, caveLootQuality: 0,
  })),
}));

vi.mock('@/lib/flagBonusService', () => ({
  getBonusStack: vi.fn().mockResolvedValue({ isBearer: false, unitStrengthMultiplier: 1, unitDefenseMultiplier: 1 }),
}));

// Doctrine: batch reader over the pinned map (mastery-amplified values are the
// caller's fixture responsibility — getDoctrineBonusesForUsernames is the seam).
vi.mock('@/lib/specializationService', () => ({
  getDoctrineBonusesForUsernames: vi.fn(async (usernames: string[]) => {
    const out: Record<string, { strMul: number; defMul: number }> = {};
    for (const u of usernames) {
      if (doctrineByUser[u]) out[u] = { ...doctrineByUser[u] };
    }
    return out;
  }),
  getPlayerDoctrineBonuses: vi.fn(async (username: string) => doctrineByUser[username] ?? { strMul: 1, defMul: 1 }),
}));

// ---- db mocks ---------------------------------------------------------------

// resolveBattle's effect seam: db.select().from(players).where(inArray(...))
// resolves to the hoisted sideRows (a real Promise — the seam awaits it).
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(sideRows)),
      })),
    })),
  },
}));

// calculateCombatPower reads through './db/connection': the parity player row.
vi.mock('@/lib/db/connection', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [parityPlayerRow]),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  players: { username: 'username', clanId: 'clan_id', unlockedTechs: 'unlocked_techs' },
  battleLogs: {},
  clans: {},
}));

// The seam's inArray runs against MOCK column stand-ins — swap it for a token
// so the read never throws before the mock db answers (fail-soft would mask
// every effect under test).
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    inArray: vi.fn((column: unknown, values: unknown[]) => ({ __mockOp: 'inArray', column, values })),
  };
});

vi.mock('@/lib/battleNotification', () => ({
  notifyBattleResult: vi.fn().mockResolvedValue(undefined),
  formatBattleResultMessage: vi.fn().mockReturnValue('report'),
}));

import { resolveBattle } from '@/lib/battleService';

function army(type: 'T1_Rifleman' | 'T5_Titan' | 'T1_Scout', count: number, str = 100, def = 0): Unit[] {
  return Array.from({ length: count }, () => ({
    id: `${type}-${Math.random().toString(36).slice(2)}`,
    type,
    strength: str,
    defense: def,
    quantity: 1,
    createdAt: new Date(),
  })) as unknown as Unit[];
}

beforeEach(() => {
  sideRows.length = 0;
  sideRows.push(
    { username: 'attacker', clanId: null, unlockedTechs: null },
    { username: 'defender', clanId: null, unlockedTechs: null },
  );
  parityPlayerRow.clanId = 'clanA';
  parityPlayerRow.clanName = 'ClanA';
  parityPlayerRow.unlockedTechs = [];
  for (const k of Object.keys(clanBonusesByClan)) delete clanBonusesByClan[k];
  for (const k of Object.keys(discoveryBonusesByUser)) delete discoveryBonusesByUser[k];
  for (const k of Object.keys(doctrineByUser)) delete doctrineByUser[k];
});

function firstStrikeDamage(log: { rounds: Array<{ attackerDamage: number }> }): number {
  return log.rounds[0].attackerDamage;
}

describe('FID-20261002-012 — resolver effect pairing (each bonus applies once)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('neutral fixture: no clan/discovery/tech → damage identical to the pre-FID baseline', async () => {
    const log = await resolveBattle(
      army('T5_Titan', 1, 1000, 500),
      army('T1_Scout', 5, 0, 100),
      'attacker', 'defender',
      BattleType.Infantry, undefined,
      { attackerLevel: 1, defenderLevel: 1 },
    );
    // RAW balance (1000,500) → CRITICAL: dealt 0.8, taken (defender's) 1.3.
    // floor(1000 − 500/2) = 750 → 750 × 0.8 × 1.3 = 780. No effect multiplier.
    expect(firstStrikeDamage(log)).toBe(780);
  });

  it('tactical-warfare attacker: +20% STR lands on the strike exactly once', async () => {
    // 0.99 ≥ 0.05 → the +5pp crit never fires (a roll IS consumed once the
    // tech is owned — pinned, not assumed).
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const neutral = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );

    sideRows[0].unlockedTechs = ['tactical-warfare'];
    const tech = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );

    // Balance stays computed from RAW stats (CRITICAL 0.8/1.3); effective STR
    // floor(1000×1.2)=1200 → floor(1200 − 250)=950 → ×0.8×1.3 = 988.
    expect(firstStrikeDamage(tech)).toBe(988);
    expect(firstStrikeDamage(tech)).toBeGreaterThan(firstStrikeDamage(neutral));
  });

  it('fortification defender in a BASE RAID: DEF ×1.15 and damage-taken ×0.85 apply ONCE', async () => {
    const neutral = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.BaseRaid, { x: 1, y: 2 },
      { attackerLevel: 1, defenderLevel: 1 },
    );

    sideRows[1].unlockedTechs = ['fortification'];
    const raid = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.BaseRaid, { x: 1, y: 2 },
      { attackerLevel: 1, defenderLevel: 1 },
    );

    // Effective DEF floor(500×1.15)=575 → strike floor(1000 − 287.5)=712
    // → ×0.8×1.3 = 740.48 → ×0.85 (DEFENDER's taken reduction) = 629.
    expect(firstStrikeDamage(raid)).toBe(629);
    expect(firstStrikeDamage(raid)).toBeLessThan(firstStrikeDamage(neutral));

    // Fortification does NOT apply in infantry (it is base defense by copy).
    const infantry = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );
    expect(firstStrikeDamage(infantry)).toBe(780);
  });

  it('combined stack: clan attack ×10, discovery STR ×20, tech ×20 compose multiplicatively and ONCE', async () => {
    clanBonusesByClan['clanA'] = { attack: 10, defense: 0 };
    discoveryBonusesByUser['attacker'] = { unitStrength: 20, unitDefense: 0, damageDealt: 0, damageTakenReduction: 0 };
    sideRows[0].clanId = 'clanA';
    sideRows[0].unlockedTechs = ['tactical-warfare'];
    // No crit: the +5pp chance roll must read ≥ 0.05.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const log = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );

    // 1.10 × 1.20 × 1.20 = 1.584 → STR floor(1584) → strike floor(1584 − 250)
    // = 1334 → ×0.8×1.3 = 1387 (balance still from RAW stats, once).
    expect(firstStrikeDamage(log)).toBe(1387);
  });

  it('discovery damage axes ride the dealt chain exactly once', async () => {
    discoveryBonusesByUser['attacker'] = { unitStrength: 0, unitDefense: 0, damageDealt: 25, damageTakenReduction: 0 };

    const log = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );
    // Baseline strike 780, THEN × 1.25 dealt effect (one place).
    expect(firstStrikeDamage(log)).toBe(975);
  });

  it('zero-stat axes stay zero: clan DEFENSE rides the DEF axis only, never the attacker STR axis', async () => {
    const neutral = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );

    clanBonusesByClan['clanDef'] = { attack: 0, defense: 25 };
    sideRows[1].clanId = 'clanDef';
    const withClan = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );

    // The defender's clan DEFENSE raises THEIR DEF axis (floor(500×1.25)=625 →
    // strike floor(1000 − 312.5)=687 → ×0.8×1.3 = 714) — the attacker's strike
    // DROPS (defense works) but the attacker STR axis is untouched (the old
    // display's 7.5% average would have boosted BOTH axes).
    expect(firstStrikeDamage(withClan)).toBe(714);
    expect(firstStrikeDamage(withClan)).toBeLessThan(firstStrikeDamage(neutral));
  });

  it('tactical-warfare crit: seeded roll below the +5pp chance multiplies the strike by 1.5 exactly once', async () => {
    sideRows[0].unlockedTechs = ['tactical-warfare'];
    // Build the armies FIRST — the id generator consumes Math.random, and the
    // seeded roll must be the resolver's crit roll, not a unit id.
    const critArmies = [army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100)];
    const plainArmies = [army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100)];

    // FID-20261002-013: resolveBattle now draws the ONE seeded battle-order
    // permutation before any crit roll — the 5-copy defender stack takes 4
    // Fisher-Yates draws (the 1-copy attacker takes none), so the crit roll is
    // the FIFTH draw. Seeding EVERY draw to 0.01 pins both the order and the
    // crit: 0.01 < 0.05 → CRIT on the attacker's strike.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const critLog = await resolveBattle(
      critArmies[0], critArmies[1],
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );
    randomSpy.mockRestore();

    // Non-crit control: every roll 0.99 (≥ 0.05) → plain strike.
    const controlSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const plainLog = await resolveBattle(
      plainArmies[0], plainArmies[1],
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );
    controlSpy.mockRestore();

    expect(critLog.rounds[0].attackerCritical).toBe(true);
    // 988 (the tech strike) × 1.5 = 1482.
    expect(firstStrikeDamage(critLog)).toBe(1482);
    expect(plainLog.rounds[0].attackerCritical).toBeUndefined();
    expect(firstStrikeDamage(plainLog)).toBe(988);
    expect(firstStrikeDamage(critLog)).toBe(Math.floor(988 * 1.5));
  });

  it('effect-read outage fails SOFT: resolver proceeds at neutral, never fails the encounter', async () => {
    const mod = await import('@/lib/clanResearchService');
    (mod.getClanBonusesForClans as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('clan read outage'));

    const log = await resolveBattle(
      army('T5_Titan', 1, 1000, 500), army('T1_Scout', 5, 0, 100),
      'attacker', 'defender', BattleType.Infantry, undefined, { attackerLevel: 1, defenderLevel: 1 },
    );
    expect(firstStrikeDamage(log)).toBe(780);
  });
});

describe('FID-20261002-012 — display/resolver parity (calculateCombatPower)', () => {
  it('the display breakdown equals the resolver preparation for the same participant', async () => {
    doctrineByUser['attacker'] = { strMul: 1.15, defMul: 1.0 }; // offensive, mastery 0
    sideRows[0].clanId = 'clanA';
    sideRows[0].unlockedTechs = ['tactical-warfare'];
    parityPlayerRow.unlockedTechs = ['tactical-warfare'];
    clanBonusesByClan['clanA'] = { attack: 10, defense: 0 };
    discoveryBonusesByUser['attacker'] = { unitStrength: 20, unitDefense: 0, damageDealt: 25, damageTakenReduction: 10 };

    const { calculateCombatPower } = await import('@/lib/combatPowerService');
    const { combatPower, breakdown } = await calculateCombatPower('attacker');

    // Axis-weighted multipliers — offensive doctrine 1.15 STR / 1.0 DEF, clan
    // attack 10% on STR, discovery unitStrength 20% on STR, tech +20% STR.
    // NO 7.5% fixed average exists anywhere in the composition.
    expect(breakdown.effectiveStrengthMultiplier).toBeCloseTo(1.15 * 1.10 * 1.20 * 1.20, 10);
    expect(breakdown.effectiveDefenseMultiplier).toBe(1);
    expect(breakdown.effectiveStrength).toBe(Math.floor(1000 * breakdown.effectiveStrengthMultiplier));
    expect(breakdown.effectiveDefense).toBe(500);

    // Damage/crit effects are SEPARATE lines, never folded into the power.
    expect(breakdown.damageDealtBonusPct).toBeCloseTo(25, 10);
    expect(breakdown.damageTakenReductionPct).toBeCloseTo(10, 10);
    expect(breakdown.criticalChance).toBeCloseTo(0.05, 10);

    // Power = (⌊STR×mul⌋ + DEF) × balance multiplier (RAW balance (1000,500) →
    // CRITICAL ×0.5 — the same raw-balance rule the resolver uses).
    expect(breakdown.balanceMultiplier).toBe(0.5);
    expect(combatPower).toBe(
      Math.floor(
        (Math.floor(1000 * breakdown.effectiveStrengthMultiplier) + 500) *
        breakdown.balanceMultiplier
      )
    );
    expect(breakdown.finalCombatPower).toBe(combatPower);
  });
});
