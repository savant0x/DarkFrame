/**
 * @file __tests__/lib/treasuryConcurrency.test.ts
 * @created 2026-09-17
 * @overview FID-20260917-001 pins — the clan-treasury write idiom:
 *            withClanTreasuryLock (FOR UPDATE row lock inside a transaction),
 *            relative-SQL treasury deltas (never snapshot-computed numbers),
 *            paired player-resource atomicity on deposit/withdraw, and the
 *            in-lock double-collection guard for daily income. First test
 *            coverage for the bank/territory treasury-writer class.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQL } from 'drizzle-orm';

// --- scripted drizzle db mock (clanWarfareV2 convention) ----------------------

type Row = Record<string, unknown>;

const selectResult: { rows: Row[] } = { rows: [] };

function terminalChain(resolver: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    for: () => chain, // .for('update') — lock helper contract
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
  execute: vi.fn(),
  transaction: vi.fn(),
  txUpdate: vi.fn(), // updates issued INSIDE the transaction (the atomic ones)
}));

vi.mock('@/lib/db', () => ({ db: dbMocks }));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});

// Helper collaborators (activity logging happens inside the services under test)
vi.mock('@/lib/clanActivityService', () => ({ logClanActivity: vi.fn().mockResolvedValue(undefined) }));

import { withClanTreasuryLock, treasuryDelta, playerResourceDelta } from '@/lib/db/treasuryLock';
import { depositToBank, withdrawFromBank } from '@/lib/clanBankService';
import { collectDailyTerritoryIncome } from '@/lib/territoryService';

// --- fixture -------------------------------------------------------------------

function clanDbRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'clanA',
    name: 'Alpha',
    tag: 'AAA',
    leaderId: 'leader1',
    members: [
      { playerId: 'member1', role: 'MEMBER' },
      { playerId: 'leader1', role: 'LEADER' },
    ],
    maxMembers: 50,
    levelCurrentLevel: 5,
    levelTotalXP: 1000,
    levelCurrentLevelXP: 0,
    levelXpToNextLevel: 5000,
    levelFeaturesUnlocked: [],
    levelMilestonesCompleted: [],
    bankTreasuryMetal: 50000,
    bankTreasuryEnergy: 50000,
    bankTreasuryResearchPoints: 1000,
    bankTaxRatesMetal: '10',
    bankTaxRatesEnergy: '10',
    bankTaxRatesResearchPoints: '5',
    bankUpgradeLevel: 1,
    bankCapacity: 1000000,
    bankTransactions: [],
    activePerks: [],
    territories: [
      { clanId: 'clanA', tileX: 5, tileY: 5, claimedAt: new Date(), claimedBy: 'leader1', defenseBonus: 0 },
    ],
    lastTerritoryIncomeCollection: null,
    statsTotalTerritories: 1,
    ...overrides,
  };
}

function queueSelects(batches: Row[][]) {
  let call = 0;
  dbMocks.select.mockImplementation(() => {
    const batch = batches[Math.min(call, batches.length - 1)];
    call += 1;
    return terminalChain(async () => batch);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  selectResult.rows = [];
  dbMocks.select.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.insert.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.update.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.delete.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.execute.mockResolvedValue(undefined);
  dbMocks.txUpdate.mockImplementation(() => terminalChain(async () => selectResult.rows));
  dbMocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      // tx-internal selects flow through the SAME queued batches as db.select
      // (the lock helper's FOR UPDATE select is a tx-internal select)
      select: () => dbMocks.select(),
      update: () => dbMocks.txUpdate(),
      insert: () => terminalChain(async () => selectResult.rows),
    })
  );
});

describe('treasuryLock helper (FID-20260917-001)', () => {
  it('opens a transaction, invokes .for("update"), and hands fn the locked row', async () => {
    selectResult.rows = [clanDbRow()];
    let received: Row | null = null;
    const out = await withClanTreasuryLock('clanA', async (_tx, locked) => {
      received = locked;
      return 'ok';
    });
    expect(out).toBe('ok');
    expect((received as unknown as Row).id).toBe('clanA');
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
    // The lock idiom: the tx select chain must pass through .for()
    const txArg = dbMocks.transaction.mock.calls[0][0] as (tx: unknown) => Promise<unknown>;
    const chain = txArg({ select: () => terminalChain(async () => [clanDbRow()]) } as never);
    expect(chain).toBeDefined();
  });

  it('throws (rolling back) when the clan row does not exist', async () => {
    selectResult.rows = [];
    await expect(withClanTreasuryLock('ghost', async () => 'never')).rejects.toThrow('Clan not found');
  });

  it('treasuryDelta builds relative SQL, never plain numbers', () => {
    const d = treasuryDelta({ metal: -25000, energy: 1000 });
    // Relative idiom: SQL fragments (column = column + delta), not computed numbers
    expect(d.bankTreasuryMetal).toBeInstanceOf(SQL);
    expect(d.bankTreasuryEnergy).toBeInstanceOf(SQL);
    expect(d.bankTreasuryResearchPoints).toBeUndefined();
  });

  it('playerResourceDelta mirrors the paired-columns contract', () => {
    const d = playerResourceDelta({ metal: -500 });
    expect(d.resourcesMetal).toBeDefined();
    expect(d.resourcesEnergy).toBeUndefined();
  });
});

describe('deposit/withdraw atomicity (FID-20260917-001)', () => {
  it('deposit: capacity re-checked inside the lock; clan credit + player debit in ONE transaction', async () => {
    // depositToBank: getClanById → locked select → final getClanById
    const row = clanDbRow();
    const credited = clanDbRow({ bankTreasuryMetal: 55000 });
    queueSelects([[row], [row], [credited]]);
    const bank = await depositToBank('clanA', 'member1', { metal: 5000 });
    expect(bank.treasury.metal).toBe(55000); // read-back reflects the relative credit
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
    // Atomicity pin: clans credit + players debit = exactly 2 updates, 1 transaction
    expect(dbMocks.txUpdate).toHaveBeenCalledTimes(2);
  });

  it('deposit: re-checks capacity against the LOCKED row, not the pre-lock preview', async () => {
    // Preview row passes the fail-fast check; the LOCKED row is over-capacity —
    // only an in-lock re-read can catch this interleaving.
    const fresh = clanDbRow();
    const full = clanDbRow({ bankTreasuryMetal: 999000, bankCapacity: 1000000 });
    queueSelects([[fresh], [full], [full]]);
    await expect(depositToBank('clanA', 'member1', { metal: 5000 })).rejects.toThrow('Metal capacity exceeded');
    // Transaction still opened (rollback path), but no treasury update escapes it
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('withdraw: sufficiency re-checked inside the lock; clan debit + player credit atomic', async () => {
    const row = clanDbRow();
    const debited = clanDbRow({ bankTreasuryMetal: 40000 });
    queueSelects([[row], [row], [row], [debited]]);
    const bank = await withdrawFromBank('clanA', 'leader1', { metal: 10000 });
    expect(bank.treasury.metal).toBe(40000);
    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('withdraw: refuses on the LOCKED balance even when the pre-lock preview passed', async () => {
    // Preview row is flush (passes the fail-fast check); the LOCKED row is empty
    // — only the in-lock sufficiency re-check can catch this interleaving.
    const fresh = clanDbRow();
    const drained = clanDbRow({ bankTreasuryMetal: 100 });
    queueSelects([[fresh], [fresh], [drained]]);
    // 20k passes the pre-lock preview (50k) but exceeds the LOCKED balance (100)
    await expect(withdrawFromBank('clanA', 'leader1', { metal: 20000 })).rejects.toThrow(
      'Insufficient Metal in bank. Available: 100'
    );
  });
});

describe('daily income double-collection guard (FID-20260917-001)', () => {
  it('pays once, then refuses a same-day second collection via the LOCKED-row guard', async () => {
    const row = clanDbRow();
    queueSelects([[row], [row], [row]]);
    const first = await collectDailyTerritoryIncome('clanA');
    expect(first.success).toBe(true);
    expect(first.metalCollected).toBeGreaterThan(0);

    // Second call: the pre-lock PREVIEW row is still fresh (lastCollection null
    // — e.g. another writer raced us), but the LOCKED row shows today's
    // collection already recorded. Only the in-lock guard can catch this.
    const collected = clanDbRow({ lastTerritoryIncomeCollection: new Date() });
    queueSelects([[row], [collected], [collected]]);
    const second = await collectDailyTerritoryIncome('clanA');
    expect(second.success).toBe(false);
    expect(second.message).toBe('Income already collected today');
  });
});
