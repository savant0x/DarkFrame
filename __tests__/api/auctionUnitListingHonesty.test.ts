/**
 * @file __tests__/api/auctionUnitListingHonesty.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-001 (auction unit-listing honesty): the STORED
 *            listing's unit stat scalars are derived from the escrowed unit —
 *            never from client-supplied fields — and the listing card displays
 *            snapshot stats preferentially. Service pins ride the established
 *            drizzle-simulation mock (table identity + condition-fn Proxy +
 *            fluent builder), per the slice-5 settlement convention.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { mapDomainPlayerToRow } from '@/lib/playerService';
import { AuctionItemType, UnitType } from '@/types';
import type { PlayerUnit } from '@/types';

const { state } = vi.hoisted(() => {
  const state = {
    rows: [] as Array<Record<string, unknown>>,
    auctionPatches: [] as Array<Record<string, unknown>>,
    playerPatches: [] as Array<Record<string, unknown>>,
    insertCalls: [] as Array<{ table: string; values: Array<Record<string, unknown>> }>,
  };
  const mark = (op: string, col: unknown, val: unknown) => ({ __cond: true, op, col, val });
  const _condFns = {
    and: (...cs: unknown[]) => ({ __and: cs }),
    or: (...cs: unknown[]) => ({ __or: cs }),
    not: (c: unknown) => ({ __not: c }),
    eq: (col: unknown, val: unknown) => mark('eq', col, val),
    ne: (col: unknown, val: unknown) => mark('ne', col, val),
    lt: (col: unknown, val: unknown) => mark('lt', col, val),
    lte: (col: unknown, val: unknown) => mark('lte', col, val),
    gt: (col: unknown, val: unknown) => mark('gt', col, val),
    gte: (col: unknown, val: unknown) => mark('gte', col, val),
    isNull: (col: unknown) => mark('isNull', col, undefined),
    isNotNull: (col: unknown) => mark('isNotNull', col, undefined),
    inArray: (col: unknown, vals: unknown[]) => mark('inArray', col, vals),
    like: (col: unknown, val: unknown) => mark('like', col, val),
    ilike: (col: unknown, val: unknown) => mark('ilike', col, val),
    sql: Object.assign((q: TemplateStringsArray, ...p: unknown[]) => ({ __sql: q, params: p }), {
      raw: (s: string) => ({ __raw: s }),
      empty: () => ({ __raw: '' }),
      from: Object.assign(() => ({ __sqlFrom: true }), { as: () => ({ __alias: true }) }),
    }),
  };
  return { state };
});

function makeDb() {
  const builder = (table?: unknown) => {
    const b: Record<string, unknown> = { __table: table };
    const add = (name: string, impl: (args: unknown[]) => unknown) => {
      b[name] = (...args: unknown[]) => impl(args);
    };
    add('from', ([table]) => {
      b.__table = table;
      return b;
    });
    add('where', ([cond]) => {
      b.__where = cond;
      return b;
    });
    add('limit', ([n]) => {
      b.__limit = n;
      return b;
    });
    add('offset', ([n]) => {
      b.__offset = n;
      return b;
    });
    add('orderBy', () => b);
    add('select', (fields?: unknown) => {
      if (fields !== undefined) b.__fields = fields;
      return b;
    });
    add('insert', ([table]) => {
      b.__table = table;
      b.__insert = true;
      return b;
    });
    add('values', ([vals]) => {
      b.__values = vals;
      return b;
    });
    add('update', ([table]) => {
      b.__table = table;
      b.__update = true;
      return b;
    });
    add('set', ([patch]) => {
      b.__set = patch;
      return b;
    });
    add('returning', () => Promise.resolve([state.rows[0] ?? {}]));
    b.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      try {
        const table = b.__table as object | undefined;
        const isAuctions = table && getTableName(table as never) === 'auctions';
        if (b.__update) {
          if (isAuctions) state.auctionPatches.push(b.__set as Record<string, unknown>);
          else state.playerPatches.push(b.__set as Record<string, unknown>);
          resolve({ rowCount: 1 });
          return;
        }
        if (b.__insert) {
          state.insertCalls.push({
            table: getTableName(table as never),
            values: b.__values as Array<Record<string, unknown>>,
          });
          resolve({ rowCount: 1 });
          return;
        }
        if (b.__fields && typeof b.__fields === 'object' && 'count' in (b.__fields as object)) {
          resolve([{ count: 0 }]);
          return;
        }
        const rows = state.rows;
        resolve(b.__limit === 1 ? rows.slice(0, 1) : rows);
      } catch (e) {
        reject(e);
      }
    };
    return b;
  };
  return {
    select: () => builder(),
    insert: (t: unknown) => {
      const b = builder(t);
      b.__insert = true;
      return b;
    },
    update: (t: unknown) => {
      const b = builder(t);
      b.__update = true;
      return b;
    },
    execute: () => Promise.resolve({ rows: [] }),
  } as unknown as Record<string, unknown>;
}

vi.mock('@/lib/db', () => ({ db: makeDb() }));
vi.mock('@/lib/db/connection', () => ({ db: makeDb(), connectToDatabase: () => makeDb() }));
vi.mock('@/lib/activityLogger', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/websocket/chatHandlers', () => ({ emitAuctionEvent: vi.fn() }));
vi.mock('@/lib/balanceService', () => ({ getBalanceEffects: vi.fn().mockReturnValue({}) }));
vi.mock('@/lib/mongodb', () => {
  throw new Error('MONGO SHIM IMPORT — eradication gate');
});

// ── fixtures ────────────────────────────────────────────────────────────────
const REAL_UNIT: PlayerUnit = {
  id: 'u-123',
  unitId: 'unit-123',
  unitType: UnitType.T2_Marksman,
  name: 'Marksman',
  category: 'STR',
  rarity: 'common',
  strength: 250,
  defense: 40,
  quantity: 1,
  createdAt: new Date('2026-09-01T00:00:00Z'),
};

function sellerRow() {
  const seller = {
    username: 'seller1',
    resources: { metal: 100000, energy: 100000 },
    units: [REAL_UNIT],
  };
  return mapDomainPlayerToRow(seller as never);
}

const LISTING_FIELDS = [
  'auctionId', 'sellerUsername', 'item', 'startingBid', 'currentBid', 'buyoutPrice',
  'reservePrice', 'bids', 'createdAt', 'expiresAt', 'duration', 'status',
  'listingFee', 'saleFee', 'clanOnly', 'settled',
];

function listingRow() {
  const row: Record<string, unknown> = {};
  LISTING_FIELDS.forEach((f) => (row[f] = null));
  return row;
}

// service under test (after mocks)
import { createAuctionListing } from '@/lib/auctionService';

beforeEach(() => {
  state.rows = [sellerRow(), listingRow()];
  state.auctionPatches = [];
  state.playerPatches = [];
  state.insertCalls = [];
});

describe('FID-20260919-001: stored unit-listing stats derive from the escrowed unit', () => {
  it('overwrites client-supplied fabricated stats with the real unit stats', async () => {
    const result = await createAuctionListing('seller1', {
      item: {
        // client lies: whatever numbers it sends must NOT be stored
        itemType: AuctionItemType.Unit,
        unitId: 'unit-123',
        unitType: UnitType.T1_Infantry,
        unitStrength: 9999,
        unitDefense: 9999,
      },
      startingBid: 1000,
      duration: 24,
    });

    expect(result.success).toBe(true);
    const insert = state.insertCalls.find((c) => c.table === 'auctions');
    expect(insert).toBeDefined();
    // createAuctionListing inserts a SINGLE payload object (not an array)
    const stored = (insert!.values as unknown as Record<string, unknown>).item as Record<string, unknown>;
    expect(stored.unitSnapshot).toBeDefined();
    expect((stored.unitSnapshot as PlayerUnit).strength).toBe(250);
    expect((stored.unitSnapshot as PlayerUnit).defense).toBe(40);
    // scalars overwritten from the snapshot — never the client's 9999/9999
    expect(stored.unitStrength).toBe(250);
    expect(stored.unitDefense).toBe(40);
    // unitType resolved from the real unit, not the client's claim
    expect(stored.unitType).toBe(UnitType.T2_Marksman);
  });

  it('still escrows: the unit leaves the seller army (lock write)', async () => {
    const result = await createAuctionListing('seller1', {
      item: { itemType: AuctionItemType.Unit, unitId: 'unit-123' },
      startingBid: 1000,
      duration: 24,
    });
    expect(result.success).toBe(true);
    const lock = state.playerPatches.find((p) => Array.isArray(p.units));
    expect(lock).toBeDefined();
    expect((lock!.units as PlayerUnit[]).some((u) => u.unitId === 'unit-123')).toBe(false);
  });

  it('rejects a unitId the seller does not own', async () => {
    const result = await createAuctionListing('seller1', {
      item: {
        itemType: AuctionItemType.Unit,
        unitId: 'foreign-unit',
        unitStrength: 1,
        unitDefense: 1,
      },
      startingBid: 1000,
      duration: 24,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNIT_NOT_FOUND');
    expect(state.insertCalls.some((c) => c.table === 'auctions')).toBe(false);
  });

  it('rejects a unit listing with no unitId at all (the old modal payload)', async () => {
    const result = await createAuctionListing('seller1', {
      item: { itemType: AuctionItemType.Unit, unitType: UnitType.T1_Infantry, unitStrength: 100, unitDefense: 50 },
      startingBid: 1000,
      duration: 24,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_ITEM');
  });
});

describe('FID-20260919-001: listing card displays snapshot-truth stats', () => {
  it('prefers unitSnapshot stats over the legacy scalars', async () => {
    const { getItemDisplayStats } = await import('@/lib/auctionDisplay');
    const stats = getItemDisplayStats({
      itemType: AuctionItemType.Unit,
      unitType: UnitType.T2_Marksman,
      unitStrength: 9999,
      unitDefense: 9999,
      unitSnapshot: { ...REAL_UNIT },
    } as never);
    expect(stats).toEqual({ strength: 250, defense: 40 });
  });

  it('falls back to stored scalars for pre-escrow legacy listings', async () => {
    const { getItemDisplayStats } = await import('@/lib/auctionDisplay');
    const stats = getItemDisplayStats({
      itemType: AuctionItemType.Unit,
      unitType: UnitType.T1_Infantry,
      unitStrength: 100,
      unitDefense: 50,
    } as never);
    expect(stats).toEqual({ strength: 100, defense: 50 });
  });
});
