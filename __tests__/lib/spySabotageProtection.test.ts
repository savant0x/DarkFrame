/**
 * FID-20260916-007: spy-sabotage protection seam pins.
 *
 * Seams implemented in `executeSabotage` (lib/wmd/spyService.ts):
 *  - operator binding: spy.ownerId must equal the 4th arg (route sends
 *    auth.playerId) — refuses hijacked spies BEFORE any other work so the
 *    void can never fire on an innocent owner.
 *  - owner-derived target resolution (`resolveSabotageTarget`): the victim is
 *    derived FROM the asset (missile ownerId / battery clan leader / research
 *    row), replacing the caller-asserted identity that made the live pipeline
 *    unsatisfiable.
 *  - target-side refusal: protected victims get PROTECTION_REFUSAL_REASON
 *    (parity with infantry / factory / WMD-launch).
 *  - void at commit: voidProtectionOnAggression(spy.ownerUsername) AFTER every
 *    refusal precondition and BEFORE the success roll — a refused or
 *    precondition-failed operation never forfeits.
 *
 * Chained-mock idiom mirrors __tests__/lib/playerProtection.seams.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const missilesTable = Symbol('table.missiles');
  const playersTable = Symbol('table.players');
  const clansTable = Symbol('table.clans');
  const wmdSpiesTable = Symbol('table.wmdSpies');
  const wmdDefenseBatteriesTable = Symbol('table.wmdDefenseBatteries');
  const playerResearchTable = Symbol('table.playerResearch');
  const wmdSabotageOperationsTable = Symbol('table.wmdSabotageOperations');

  const updates: Array<{ table: unknown; set: Record<string, unknown>; where: unknown[] }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const selectResults = new Map<unknown, Array<Record<string, unknown>>>();

  return {
    missilesTable,
    playersTable,
    clansTable,
    wmdSpiesTable,
    wmdDefenseBatteriesTable,
    playerResearchTable,
    wmdSabotageOperationsTable,
    updates,
    inserts,
    selectResults,
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() =>
            Promise.resolve(h.selectResults.get(table) ?? [])
          ),
        })),
      })),
    })),
    update: vi.fn().mockImplementation((table: unknown) => ({
      set: vi.fn().mockImplementation((set: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation((...whereArgs: unknown[]) => {
          h.updates.push({ table, set, where: whereArgs });
          // voidProtectionOnAggression chains .returning() after .where()
          return { returning: vi.fn().mockImplementation(() => Promise.resolve([])) };
        }),
      })),
    })),
    insert: vi.fn().mockImplementation((table: unknown) => ({
      values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
        h.inserts.push({ table, values });
        return Promise.resolve();
      }),
    })),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  // Spread the real barrel: transitive modules (statTrackingService etc.)
  // read their tables at module scope; only players/clans need Symbols here.
  ...(await importOriginal<object>()),
  players: h.playersTable,
  clans: h.clansTable,
}));

vi.mock('@/lib/db/schema/players', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  players: h.playersTable,
}));

vi.mock('@/lib/db/schema/clans', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  clans: h.clansTable,
}));

vi.mock('@/lib/db/schema/wmd', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  missiles: h.missilesTable,
  wmdSpies: h.wmdSpiesTable,
  wmdDefenseBatteries: h.wmdDefenseBatteriesTable,
  playerResearch: h.playerResearchTable,
  wmdSabotageOperations: h.wmdSabotageOperationsTable,
}));

vi.mock('@/lib/clanWarfareService', () => ({ getActiveWars: vi.fn() }));
vi.mock('./clanTreasuryWMDService', () => ({
  validateClanWMDFunds: vi.fn(),
  deductWMDCost: vi.fn(),
  WMDPurchaseType: {},
}));
vi.mock('./researchService', () => ({ getPlayerResearch: vi.fn() }));

import { executeSabotage } from '@/lib/wmd/spyService';
import { PROTECTION_REFUSAL_REASON } from '@/lib/playerProtection';

const OPERATOR = 'operator';
const VICTIM = 'victim';

/** Spy row as getSpy's select returns it (wmdSpies map). */
const spyRow = {
  id: 'ws_1',
  spyId: 'spy_1',
  ownerId: OPERATOR,
  ownerUsername: OPERATOR,
  clanId: null,
  codename: 'SHADOW',
  status: 'AVAILABLE',
  skillsStealth: 10,
  skillsHacking: 10,
  skillsSabotage: 50,
  skillsIntelligence: 10,
};

const victimUnprotected = { username: VICTIM, protectionUntil: null };
const victimProtected = {
  username: VICTIM,
  protectionUntil: new Date(Date.now() + 3_600_000).toISOString(),
};

const voidUpdates = () =>
  h.updates.filter((u) => u.table === h.playersTable && 'protectionUntil' in u.set);
const operationsInserted = () =>
  h.inserts.some((i) => i.table === h.wmdSabotageOperationsTable);

beforeEach(() => {
  h.updates.length = 0;
  h.inserts.length = 0;
  h.selectResults.clear();
});

describe('FID-20260916-007: executeSabotage protection seams', () => {
  it('pin 1 — protected victim: refused with parity reason, no void, no record', async () => {
    h.selectResults.set(h.wmdSpiesTable, [spyRow]);
    h.selectResults.set(h.missilesTable, [{ ownerId: VICTIM, missileId: 'm_biz_1' }]);
    h.selectResults.set(h.playersTable, [victimProtected]);

    const result = await executeSabotage('spy_1', 'MISSILE', 'm_biz_1', OPERATOR);

    expect(result.success).toBe(false);
    expect(result.message).toBe(PROTECTION_REFUSAL_REASON);
    expect(voidUpdates()).toHaveLength(0);
    expect(operationsInserted()).toBe(false);
  });

  it('pin 2 — unprotected victim: void fires on the spy owner (username-keyed) before the roll', async () => {
    h.selectResults.set(h.wmdSpiesTable, [spyRow]);
    h.selectResults.set(h.missilesTable, [{ ownerId: VICTIM, missileId: 'm_biz_1' }]);
    h.selectResults.set(h.playersTable, [victimUnprotected]);

    const result = await executeSabotage('spy_1', 'MISSILE', 'm_biz_1', OPERATOR);

    // Success/detection are roll-dependent; the COMMIT is not — the void must
    // have fired and the operation record written either way.
    expect(voidUpdates()).toHaveLength(1);
    expect(voidUpdates()[0].set.protectionUntil).toBeNull();
    expect(operationsInserted()).toBe(true);
    expect(result.message).toContain('Sabotage operation');
  });

  it('pin 3 — hijacked spy (owned by someone else): refused before any other work', async () => {
    h.selectResults.set(h.wmdSpiesTable, [{ ...spyRow, ownerId: 'someoneElse', ownerUsername: 'someoneElse' }]);

    const result = await executeSabotage('spy_1', 'MISSILE', 'm_biz_1', OPERATOR);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Not your spy');
    expect(voidUpdates()).toHaveLength(0);
    expect(operationsInserted()).toBe(false);
  });

  it('pin 4 — missing asset: refused, no void (an impossible operation never forfeits)', async () => {
    h.selectResults.set(h.wmdSpiesTable, [spyRow]);
    h.selectResults.set(h.missilesTable, []); // asset not found

    const result = await executeSabotage('spy_1', 'MISSILE', 'm_biz_1', OPERATOR);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid sabotage target');
    expect(voidUpdates()).toHaveLength(0);
    expect(operationsInserted()).toBe(false);
  });

  it('pin 5 — skill below 30: refused before validation, no void', async () => {
    h.selectResults.set(h.wmdSpiesTable, [{ ...spyRow, skillsSabotage: 29 }]);

    const result = await executeSabotage('spy_1', 'MISSILE', 'm_biz_1', OPERATOR);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Spy lacks sufficient sabotage skills (minimum 30)');
    expect(voidUpdates()).toHaveLength(0);
    expect(operationsInserted()).toBe(false);
  });

  it('pin 6 — spy unavailable: refused before validation, no void, no record', async () => {
    h.selectResults.set(h.wmdSpiesTable, [{ ...spyRow, status: 'COMPROMISED' }]);

    const result = await executeSabotage('spy_1', 'MISSILE', 'm_biz_1', OPERATOR);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Spy is not available');
    expect(voidUpdates()).toHaveLength(0);
    expect(operationsInserted()).toBe(false);
  });
});
