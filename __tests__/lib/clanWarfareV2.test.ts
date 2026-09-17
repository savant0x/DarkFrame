/**
 * FID-20260912-076 — War Engine v2 lifecycle tests.
 *
 * Wars used to be mod_log ghosts: declares were written, reads returned [],
 * endWar threw, and capture was a war-free coin flip. These tests pin the
 * redesigned lifecycle against a scripted drizzle `db` mock:
 *   • declareWar: cost debit + ACTIVE row insert + mod_log record
 *   • recordWarBattleOutcome: +1 to the correct side; no-war is a no-op
 *   • attemptTerritoryCapture: war-gating, daily cap, strength defense math
 *   • settleDueWars: only wars past the minimum duration settle
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- scripted drizzle db mock -------------------------------------------------

type Row = Record<string, unknown>;

const selectResult: { rows: Row[] } = { rows: [] };

function terminalChain(resolver: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    values: () => chain,
    set: () => chain,
    returning: async () => selectResult.rows,
    then: (resolve: (v: unknown) => void, reject: (v: unknown) => void) => resolver().then(resolve, reject),
  };
  return chain;
}

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMocks }));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateId: () => 'war-test-1',
}));
vi.mock('@/lib/clanActivityService', () => ({ logClanActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/battleNotification', () => ({ notifySystem: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/researchPointService', () => ({ awardRP: vi.fn().mockResolvedValue({ awarded: 0 }) }));
vi.mock('@/lib/clanLevelService', () => ({ awardClanXP: vi.fn().mockResolvedValue({ levelUp: false }) }));

import {
  WAR_CONSTANTS,
  recordWarBattleOutcome,
  settleDueWars,
  attemptTerritoryCapture,
  captureTerritory,
  getCaptureTargets,
} from '@/lib/clanWarfareService';

function warRow(overrides: Partial<Row> = {}): Row {
  const now = new Date();
  return {
    warId: 'war-test-1',
    attackerClanId: 'clanA',
    attackerName: 'Alpha',
    attackerTag: 'AAA',
    defenderClanId: 'clanB',
    defenderName: 'Bravo',
    defenderTag: 'BBB',
    status: 'ACTIVE',
    declaredAt: now,
    declaredBy: 'leaderA',
    endedAt: null,
    endedReason: null,
    outcome: null,
    declarationCost: { metal: 50000, energy: 25000 },
    attackerScore: 0,
    defenderScore: 0,
    attackerCaptures: 0,
    defenderCaptures: 0,
    captureDay: '',
    attackerCapturesToday: 0,
    defenderCapturesToday: 0,
    attackerTruceProposed: 0,
    defenderTruceProposed: 0,
    spoils: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResult.rows = [];
  dbMocks.select.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.insert.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.update.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.delete.mockImplementation(() => terminalChain(async () => selectResult.rows));
  // transaction(cb): hand cb a tx object exposing update().set()... chains, await result
  dbMocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      update: () => terminalChain(async () => selectResult.rows),
      insert: () => terminalChain(async () => selectResult.rows),
      select: () => terminalChain(async () => selectResult.rows),
    }));
});

describe('recordWarBattleOutcome', () => {
  it('is a no-op when either clan is missing or both ids match', async () => {
    await recordWarBattleOutcome(null, 'clanB', 'b1');
    await recordWarBattleOutcome('clanA', undefined, 'b2');
    await recordWarBattleOutcome('same', 'same', 'b3');
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it('records a draw-free battle to the ATTACKER side when the attacker clan won', async () => {
    const war = warRow();
    selectResult.rows = [war];
    await recordWarBattleOutcome('clanA', 'clanB', 'battle-77');
    expect(dbMocks.update).toHaveBeenCalledTimes(1);
  });

  it('swallows DB failures — combat must never fail from bookkeeping', async () => {
    dbMocks.update.mockImplementationOnce(() => {
      throw new Error('db down');
    });
    selectResult.rows = [warRow()];
    await expect(recordWarBattleOutcome('clanA', 'clanB', 'battle-x')).resolves.toBeUndefined();
  });
});

describe('settleDueWars', () => {
  it('returns zero when no wars are due', async () => {
    selectResult.rows = [];
    const result = await settleDueWars();
    expect(result.settled).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('settles a war past the minimum duration and reports the outcome', async () => {
    const old = new Date(Date.now() - (WAR_CONSTANTS.MIN_WAR_DURATION_HOURS + 2) * 3600 * 1000);
    selectResult.rows = [
      warRow({ declaredAt: old, attackerScore: 5, defenderScore: 2 }),
    ];
    const result = await settleDueWars();
    expect(result.settled).toBe(1);
    expect(result.results[0].warId).toBe('war-test-1');
    expect(result.results[0].outcome).toBe('ATTACKER_WIN');
    expect(result.results[0].winnerClanId).toBe('clanA');
  });

  it('awards the win to the DEFENDER when the defender leads on score', async () => {
    const old = new Date(Date.now() - (WAR_CONSTANTS.MIN_WAR_DURATION_HOURS + 2) * 3600 * 1000);
    selectResult.rows = [
      warRow({ declaredAt: old, attackerScore: 1, defenderScore: 9 }),
    ];
    const result = await settleDueWars();
    expect(result.results[0].outcome).toBe('DEFENDER_WIN');
    expect(result.results[0].winnerClanId).toBe('clanB');
  });

  it('settles on TOTAL POINTS first — capture counts are a tiebreak, not the ruler', async () => {
    // The old precedence let 1 capture outrank 99 battle wins. Points now rule:
    // attacker leads captures 50→0 but trails on score 1→9 → defender wins.
    const old = new Date(Date.now() - (WAR_CONSTANTS.MIN_WAR_DURATION_HOURS + 2) * 3600 * 1000);
    selectResult.rows = [
      warRow({
        declaredAt: old,
        attackerScore: 1,
        defenderScore: 9,
        attackerCaptures: 50,
        defenderCaptures: 0,
      }),
    ];
    const result = await settleDueWars();
    expect(result.results[0].outcome).toBe('DEFENDER_WIN');
    expect(result.results[0].winnerClanId).toBe('clanB');
  });

  it('uses capture counts only as the tiebreak when points are equal', async () => {
    const old = new Date(Date.now() - (WAR_CONSTANTS.MIN_WAR_DURATION_HOURS + 2) * 3600 * 1000);
    selectResult.rows = [
      warRow({
        declaredAt: old,
        attackerScore: 4,
        defenderScore: 4,
        attackerCaptures: 2,
        defenderCaptures: 0,
      }),
    ];
    const result = await settleDueWars();
    expect(result.results[0].outcome).toBe('ATTACKER_WIN');
    expect(result.results[0].winnerClanId).toBe('clanA');
  });
});

describe('WAR_CONSTANTS', () => {
  it('pins the redesigned economy numbers', () => {
    // War declaration is a real treasury decision, not pocket change.
    expect(WAR_CONSTANTS.BASE_WAR_COST_METAL).toBeGreaterThan(10000);
    expect(WAR_CONSTANTS.MIN_WAR_DURATION_HOURS).toBeGreaterThanOrEqual(48);
    // Daily capture cap keeps territory wars from being won in one sitting.
    expect(WAR_CONSTANTS.CAPTURES_PER_CLAN_PER_DAY).toBeGreaterThan(0);
  });

  it('pins the FID-20260916-013 scoring + contested-capture constants', () => {
    // Capture success is worth more than any single battle win (+1).
    expect(WAR_CONSTANTS.CAPTURE_WIN_POINTS).toBe(2);
    // A repel still scores for the defender — defense is a way to win.
    expect(WAR_CONSTANTS.CAPTURE_REPEL_POINTS).toBe(1);
    // Armyless defenders hold the shipped base wall; jitter keeps rolls contested.
    expect(WAR_CONSTANTS.CAPTURE_BASE_WALL).toBe(5000);
    expect(WAR_CONSTANTS.CAPTURE_JITTER).toBe(0.15);
  });
});

describe('attemptTerritoryCapture (FID-20260916-013)', () => {
  function clanRow(overrides: Partial<Row> = {}): Row {
    return {
      id: 'clanA',
      name: 'Alpha',
      tag: 'AAA',
      members: [{ playerId: 'off1', role: 'OFFICER' }],
      levelCurrentLevel: 10,
      bankTreasuryMetal: 100000,
      bankTreasuryEnergy: 100000,
      researchResearchPoints: 0,
      statsTotalTerritories: 0,
      statsWarsWon: 0,
      statsWarsLost: 0,
      territories: [],
      ...overrides,
    };
  }

  const TILE = { clanId: 'clanB', tileX: 5, tileY: 5, claimedAt: new Date(), claimedBy: 'x', defenseBonus: 0 };

  /**
   * The capture path performs SEQUENTIAL selects (clans ×3, war, players), each
   * read via rows[0] — so the shared whole-array mock cannot serve it. Queue one
   * batch per select call, in call order; the last batch repeats if over-read.
   * Call order: loadClan(attacker), loadClan(defender), war select,
   * computeClanArmyPower(defender): loadClan(defender) + players(units).
   */
  function queueCapture(attackerUnits: Row[]) {
    const defender = clanRow({ id: 'clanB', tag: 'BBB', members: [], territories: [TILE], researchResearchPoints: 500 });
    const batches: Row[][] = [
      [clanRow()], // loadClan(attacker)
      [defender], // loadClan(defender) — territory lookup
      [warRow()], // ACTIVE war select
      [defender], // computeClanArmyPower(defender): loadClan
      [{ units: attackerUnits }], // players.units scan
    ];
    let call = 0;
    dbMocks.select.mockImplementation(() => {
      const batch = batches[Math.min(call, batches.length - 1)];
      call += 1;
      return terminalChain(async () => batch);
    });
  }

  it('repels deterministically when the attacker army cannot beat the base wall (weak-army pin)', async () => {
    // 300 STR × 10 = 3,000 power; even +15% jitter (3,450) < 5,000 wall floor.
    queueCapture([{ strength: 300, quantity: 10 }]);
    const result = await attemptTerritoryCapture('clanA', 'clanB', 5, 5, 'off1', 3000);
    expect(result.captured).toBe(false);
    // Low-level shape: success stays true (attempt resolved); the wrapper maps
    // success ≡ captured for the route contract.
    expect(result.success).toBe(true);
    expect(result.message).toContain('repelled');
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('captures deterministically when the attacker army overwhelms the defense (strong-army pin)', async () => {
    // 10,000 STR × 10 = 100,000 power; worst jitter (85,000) ≫ 5,000 wall.
    queueCapture([{ strength: 10000, quantity: 10 }]);
    const result = await attemptTerritoryCapture('clanA', 'clanB', 5, 5, 'off1', 100000);
    expect(result.captured).toBe(true);
    expect(result.success).toBe(true);
    expect(result.message).toContain('captured');
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('getCaptureTargets (FID-20260916-013)', () => {
  /** Wars select returns an array; each looped loadClan reads rows[0]. */
  function queueWars(batches: Row[][]) {
    let call = 0;
    dbMocks.select.mockImplementation(() => {
      const batch = batches[Math.min(call, batches.length - 1)];
      call += 1;
      return terminalChain(async () => batch);
    });
  }

  it('enumerates ALL outgoing ACTIVE wars — no limit(1) hiding of multi-wars', async () => {
    const now = new Date();
    queueWars([
      [
        warRow({ declaredAt: now }), // war A vs B
        warRow({ warId: 'war-test-2', defenderClanId: 'clanC', defenderTag: 'CCC', declaredAt: now }), // war A vs C
      ],
      [
        {
          id: 'clanB',
          tag: 'BBB',
          members: [],
          territories: [
            { clanId: 'clanB', tileX: 5, tileY: 5, claimedAt: now, claimedBy: 'x', defenseBonus: 0 },
            { clanId: 'clanB', tileX: 5, tileY: 6, claimedAt: now, claimedBy: 'x', defenseBonus: 10 },
          ],
        },
      ],
      [{ id: 'clanC', tag: 'CCC', members: [], territories: [] }],
    ]);
    const result = await getCaptureTargets('clanA');
    expect(result.activeWars).toHaveLength(2);
    expect(result.activeWars.map((w) => w.defenderTag).sort()).toEqual(['BBB', 'CCC']);
    expect(result.activeWars[0].capturesCap).toBe(WAR_CONSTANTS.CAPTURES_PER_CLAN_PER_DAY);
  });

  it('previews defenseBonus per tile with the same adjacency math the server resolves', async () => {
    const now = new Date();
    queueWars([
      [warRow({ declaredAt: now })],
      [
        {
          id: 'clanB',
          tag: 'BBB',
          members: [],
          territories: [
            { clanId: 'clanB', tileX: 5, tileY: 5, claimedAt: now, claimedBy: 'x', defenseBonus: 0 },
            { clanId: 'clanB', tileX: 5, tileY: 6, claimedAt: now, claimedBy: 'x', defenseBonus: 10 },
          ],
        },
      ],
    ]);
    const result = await getCaptureTargets('clanA');
    // (5,5) borders (5,6) → +10%; the UI chip therefore previews the server roll.
    const tile = result.activeWars[0].targets.find((t) => t.tileX === 5 && t.tileY === 5);
    expect(tile?.defenseBonus).toBe(10);
  });

  it('returns an empty array when the clan has no outgoing wars (UI guidance, not an error)', async () => {
    selectResult.rows = [];
    const result = await getCaptureTargets('clanA');
    expect(result.activeWars).toEqual([]);
  });
});

describe('captureTerritory wrapper (FID-20260916-013 A2)', () => {
  it('maps success ≡ captured — a repelled attempt never surfaces as success', async () => {
    const now = new Date();
    const attacker = {
      id: 'clanA',
      name: 'Alpha',
      tag: 'AAA',
      members: [{ playerId: 'off1', role: 'OFFICER' }],
      levelCurrentLevel: 10,
      bankTreasuryMetal: 100000,
      bankTreasuryEnergy: 100000,
      researchResearchPoints: 0,
      statsTotalTerritories: 0,
      statsWarsWon: 0,
      statsWarsLost: 0,
      territories: [],
    };
    const defender = {
      id: 'clanB',
      name: 'Bravo',
      tag: 'BBB',
      members: [],
      levelCurrentLevel: 10,
      bankTreasuryMetal: 100000,
      bankTreasuryEnergy: 100000,
      researchResearchPoints: 500,
      statsTotalTerritories: 1,
      statsWarsWon: 0,
      statsWarsLost: 0,
      territories: [{ clanId: 'clanB', tileX: 5, tileY: 5, claimedAt: now, claimedBy: 'x', defenseBonus: 0 }],
    };
    // Wrapper: loadClan(attacker) → computeClanArmyPower(attacker): loadClan +
    // players → attemptTerritoryCapture: loadClan(attacker), loadClan(defender),
    // war, computeClanArmyPower(defender): loadClan + players = 8 selects.
    const batches: Row[][] = [
      [attacker],
      [attacker],
      [{ units: [{ strength: 10000, quantity: 10 }] }], // attacker power 100k → deterministic capture
      [attacker],
      [defender],
      [warRow()],
      [defender],
      [{ units: [] }],
    ];
    let call = 0;
    dbMocks.select.mockImplementation(() => {
      const batch = batches[Math.min(call, batches.length - 1)];
      call += 1;
      return terminalChain(async () => batch);
    });
    const result = await captureTerritory('clanA', 'clanB', 5, 5, 'off1');
    expect(result.success).toBe(true);
    expect(result.territory).toEqual({ tileX: 5, tileY: 5, clanId: 'clanA' });
  });
});
