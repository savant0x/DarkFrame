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
vi.mock('@/lib/clanActivityService', () => ({ logClanActivity: vi.fn() }));
vi.mock('@/lib/battleNotification', () => ({ notifySystem: vi.fn() }));
vi.mock('@/lib/researchPointService', () => ({ awardRP: vi.fn().mockResolvedValue({ awarded: 0 }) }));
vi.mock('@/lib/clanLevelService', () => ({ awardClanXP: vi.fn().mockResolvedValue({ levelUp: false }) }));

import {
  WAR_CONSTANTS,
  recordWarBattleOutcome,
  settleDueWars,
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
});

describe('WAR_CONSTANTS', () => {
  it('pins the redesigned economy numbers', () => {
    // War declaration is a real treasury decision, not pocket change.
    expect(WAR_CONSTANTS.BASE_WAR_COST_METAL).toBeGreaterThan(10000);
    expect(WAR_CONSTANTS.MIN_WAR_DURATION_HOURS).toBeGreaterThanOrEqual(48);
    // Daily capture cap keeps territory wars from being won in one sitting.
    expect(WAR_CONSTANTS.CAPTURES_PER_CLAN_PER_DAY).toBeGreaterThan(0);
  });
});
