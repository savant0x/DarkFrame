/**
 * @file __tests__/lib/flagHolderSurvival.test.ts
 * @created 2026-09-07
 * @overview Regression tests for the flag-holder account deletion defect
 *
 * DEFECT (observed 2026-09-07, account "fame"): resetFlagBot() implemented
 * "flag reset" as `DELETE FROM players WHERE username = currentHolder` — for
 * ANY holder, human or bot. A player who held the flag past the hold window
 * had their account row deleted out from under a live session.
 *
 * Contract under test (design doc FLAG_TRACKER_INTEGRATION.md,
 * FLAG_CONFIG.MAX_HOLD_DURATION = "1 hour before auto-drop"):
 *   1. A HUMAN holding the flag past MAX_HOLD_DURATION survives resetFlagBot:
 *      no players row is deleted, the flag is dropped (holder cleared),
 *      and a fresh flag bot respawns.
 *   2. A BOT holder is despawned (players row deleted) and replaced.
 *   3. shouldResetFlag() never reports a reset for a claimed (held) flag —
 *      hold duration must not trigger the cron path at all.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Table } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Chainable Drizzle fake — records every operation instead of touching pg.
// The service awaits builders via .limit(1) (reads) and .where(...) (writes),
// so every terminal method resolves a Promise.
// ---------------------------------------------------------------------------

type RecordedCall = { op: string; table: string; payload?: unknown };

const { calls, state, fakeDb, setTableNameResolver } = vi.hoisted(() => {
  const calls: RecordedCall[] = [];
  const state = { flagRows: [] as Record<string, unknown>[], holderRows: [] as Record<string, unknown>[] };
  // Drizzle keeps the SQL table name behind a symbol, not `.name` — the real
  // getTableName is injected from module scope after imports. The fake only
  // ever receives drizzle tables, so `Table` (not `unknown`) is the honest
  // parameter type — and the only one getTableName is assignable to.
  let tableName: (t: Table) => string = () => 'unknown';
  function resolveRowsFor(table: string): Record<string, unknown>[] {
    return table === 'flags' ? state.flagRows : state.holderRows;
  }
  function makeReader() {
    let table = 'unknown';
    const finish = () => {
      calls.push({ op: 'select', table, payload: undefined });
      return Promise.resolve(resolveRowsFor(table));
    };
    return {
      from: (t: Table) => {
        table = tableName(t);
        return {
          limit: finish,
          where: () => ({ limit: finish, where: finish, then: finish }),
          then: finish,
        };
      },
    };
  }
  function makeWriter(op: string, tbl: string) {
    let payload: unknown;
    const commit = () => {
      calls.push({ op, table: tbl, payload });
      return Promise.resolve(undefined);
    };
    return {
      set: (p: unknown) => {
        payload = p;
        return { where: commit, then: commit };
      },
      values: (p: unknown) => {
        payload = p;
        return commit();
      },
      where: commit,
      then: commit,
    };
  }
  const fakeDb = {
    select: () => makeReader(),
    update: (t: Table) => makeWriter('update', tableName(t)),
    delete: (t: Table) => makeWriter('delete', tableName(t)),
    insert: (t: Table) => makeWriter('insert', tableName(t)),
  };
  return { calls, state, fakeDb, setTableNameResolver: (fn: (t: Table) => string) => { tableName = fn; } };
});

import { getTableName } from 'drizzle-orm';
setTableNameResolver(getTableName);

vi.mock('@/lib/db', () => ({ db: fakeDb }));

// The spawn path is not under test — stub its collaborators.
vi.mock('@/lib/botService', () => ({
  createBotPlayer: vi.fn().mockResolvedValue({
    username: 'Bot_Spawn_1',
    base: { x: 1, y: 1 },
    currentPosition: { x: 1, y: 1 },
  }),
}));

vi.mock('@/lib/playerService', () => ({
  mapRowToPlayer: vi.fn(),
  mapDomainPlayerToRow: vi.fn().mockImplementation((p: unknown) => p),
  getPlayerByUsername: vi.fn().mockResolvedValue({
    username: 'Flag_Bearer_777',
    base: { x: 1, y: 1 },
    currentPosition: { x: 1, y: 1 },
  }),
}));

vi.mock('@/lib/utils', () => ({ generateId: vi.fn().mockReturnValue('flagid0000000000000000123') }));

import { resetFlagBot, shouldResetFlag } from '@/lib/flagBotService';

function playerDeleteCalls(): RecordedCall[] {
  return calls.filter((c) => c.op === 'delete' && c.table === 'players');
}

describe('flag holder survival (regression: account deletion defect, 2026-09-07)', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it('a HUMAN holding the flag past MAX_HOLD_DURATION survives resetFlagBot: flag drops, row intact', async () => {
    state.flagRows = [
      {
        id: 'flag1',
        currentHolder: 'fame',
        currentHolderUsername: 'fame',
        sessionEarningsMetal: 5000,
        sessionEarningsEnergy: 3000,
      },
    ];
    // Human holder: isBot = 0
    state.holderRows = [{ isBot: 0 }];

    const newBot = await resetFlagBot();

    // 1. The human's player row was NEVER deleted.
    expect(playerDeleteCalls()).toHaveLength(0);

    // 2. The flag was DROPPED, not transferred or deleted: holder cleared and
    //    session state reset on the flags row.
    const flagUpdate = calls.find((c) => c.op === 'update' && c.table === 'flags');
    expect(flagUpdate).toBeDefined();
    expect(flagUpdate!.payload).toMatchObject({
      currentHolder: null,
      currentHolderUsername: null,
      sessionEarningsMetal: 0,
      sessionEarningsEnergy: 0,
    });

    // 3. A fresh flag bot respawned and is returned.
    expect(newBot).toMatchObject({ username: 'Flag_Bearer_777' });
  });

  it('a BOT holder is despawned and replaced', async () => {
    state.flagRows = [
      {
        id: 'flag1',
        currentHolder: 'Flag_Bearer_1027',
        currentHolderUsername: 'Flag_Bearer_1027',
      },
    ];
    state.holderRows = [{ isBot: 1 }];

    await resetFlagBot();

    // Bot despawn: exactly one players-row delete on the reset path.
    expect(playerDeleteCalls()).toHaveLength(1);
  });

  it('shouldResetFlag is false while the flag is held — no matter how long', async () => {
    // Held far beyond the 1-hour respawnDelay: a claimed flag is never "reset".
    state.flagRows = [
      {
        id: 'flag1',
        currentHolder: 'fame',
        lastCapturedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12h hold
      },
    ];
    state.holderRows = [{ isBot: 0 }];

    await expect(shouldResetFlag()).resolves.toBe(false);
    expect(playerDeleteCalls()).toHaveLength(0);
  });
});
