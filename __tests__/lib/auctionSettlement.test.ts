/**
 * FID-20260912-065 — auction settlement contract tests.
 *
 * The settlement engine moves real money (escrow releases, seller payouts,
 * refunds). These tests pin the outcome matrix at the seam boundary so a
 * seam change that breaks an escrow, a claim guard, or a refund fails here
 * instead of in the live economy.
 *
 * Rebased onto the pg drizzle seams (FID-20260917-017): the scripted
 * getCollection mock is replaced by a stateful drizzle simulation — wallet
 * deltas, unit-array operations, auction row patches, and trade inserts are
 * recorded against in-memory rows. Claim semantics (the guarded UPDATE...
 * RETURNING races) are scripted per scenario instead of asserted by call
 * shape; the claim-first ordering invariant is pinned on the event timeline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state, playersTable, auctionsTable, tradesTable, mockDb } = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  const state = {
    // username → sparse player row (resourcesMetal/resourcesEnergy/units)
    players: new Map<string, Row>(),
    // canonical auction rows (mutated by claims/patches); lookups by auctionId
    auctions: [] as Row[],
    // rows served for the settlement overdue query
    overdue: [] as Row[],
    // trade_history inserts
    trades: [] as Row[],
    // auction inserts (createAuctionListing)
    auctionInserts: [] as Row[],
    // scripted claim outcomes
    claimWins: true, // status-flipping claims (settle/cancel/buyout close)
    leaderClaimWins: true, // placeBid's leader-pair claim
    // recorded effects
    walletOps: [] as Array<{ username: string; column: string; delta: number }>,
    unitAppends: [] as Array<{ username: string; units: unknown[] }>,
    unitsSets: [] as Array<{ username: string; units: unknown[] }>,
    auctionPatches: [] as Array<Row>,
    // global event timeline for ordering pins
    events: [] as string[],
  };

  // --- drizzle SQL chunk helpers ---------------------------------------------
  const flatten = (c: unknown, out: unknown[] = []): unknown[] => {
    if (!c || typeof c !== 'object') {
      out.push(c);
      return out;
    }
    const q = c as { queryChunks?: unknown[] };
    if (Array.isArray(q.queryChunks)) {
      q.queryChunks.forEach((x) => flatten(x, out));
      return out;
    }
    out.push(c);
    return out;
  };

  /** Extract the value compared against a named column in an eq() condition. */
  const columnValue = (cond: unknown, colName: string): unknown => {
    const chunks = flatten(cond);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i] as { name?: string };
      if (c && typeof c === 'object' && typeof c.name === 'string' && c.name === colName) {
        for (let j = i + 1; j < chunks.length; j++) {
          const v = chunks[j];
          // Params emit as plain primitives (driver-side interpolation).
          if (typeof v === 'string' || typeof v === 'number') return v;
          const o = v as { value?: unknown } | null;
          if (!o || typeof o !== 'object') continue;
          // StringChunk carries static SQL text as {value: string[]} — skip.
          if (Array.isArray(o.value)) continue;
          if ('value' in o) return o.value;
        }
      }
    }
    return undefined;
  };

  /** Extract a signed delta from a `sql`${col} + N`` fragment. */
  const extractDelta = (expr: unknown): { column: string; delta: number } | null => {
    const chunks = flatten(expr);
    let column: string | null = null;
    let sign = 1;
    let value: number | null = null;
    for (const c of chunks) {
      const o = c as { name?: string; value?: unknown } | null;
      if (!o || typeof o !== 'object') {
        if (typeof c === 'number') value = c;
        continue;
      }
      // StringChunk: static SQL text as {value: string[]} — detect the minus operator.
      if (Array.isArray(o.value)) {
        if (/\s-\s/u.test(o.value.join(''))) sign = -1;
        continue;
      }
      if (typeof o.name === 'string' && !('value' in o)) column = o.name;
      else if ('value' in o && typeof o.value === 'number') value = o.value;
    }
    if (column && value !== null) return { column, delta: sign * value };
    return null;
  };

  /**
   * Extract the appended array from the units jsonb-append fragment
   * (`coalesce(units, '[]'::jsonb) || $1::jsonb`). The JSON array rides as a
   * plain string PARAM (driver-side interpolation), so both bare string
   * chunks and string-valued wrapper chunks are candidates.
   */
  const extractAppend = (expr: unknown): unknown[] | null => {
    const chunks = flatten(expr);
    for (const c of chunks) {
      const raw =
        typeof c === 'string'
          ? c
          : (() => {
              const o = c as { value?: unknown } | null;
              return o && typeof o === 'object' && 'value' in o && typeof o.value === 'string' ? o.value : null;
            })();
      if (raw !== null && raw.trimStart().startsWith('[')) {
        try {
          return JSON.parse(raw) as unknown[];
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  const applyWalletWrite = (patch: Row, username: string) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value && typeof value === 'object' && 'queryChunks' in (value as object)) {
        if (key === 'units') {
          const appended = extractAppend(value);
          if (appended) {
            state.unitAppends.push({ username, units: appended });
            const row = state.players.get(username);
            if (row) row.units = [...((row.units as unknown[]) ?? []), ...appended];
          }
          continue;
        }
        const d = extractDelta(value);
        if (d) {
          state.walletOps.push({ username, column: d.column, delta: d.delta });
          state.events.push('wallet');
          const row = state.players.get(username);
          if (row) row[d.column] = ((row[d.column] as number) ?? 0) + d.delta;
        }
        continue;
      }
      if (key === 'units' && Array.isArray(value)) {
        state.unitsSets.push({ username, units: value });
        const row = state.players.get(username);
        if (row) row.units = value;
      }
    }
  };

  const applyAuctionPatch = (patch: Row) => {
    state.auctionPatches.push({ ...patch });
    const row = state.auctions[0];
    if (row) {
      for (const [k, v] of Object.entries(patch)) {
        if (v && typeof v === 'object' && 'queryChunks' in (v as object)) continue; // doc fragment
        row[k] = v;
      }
    }
    state.events.push(`patch:${String(patch.status ?? '')}`);
  };

  /**
   * where() result: awaitable (plain update) AND carrying the reader-chain
   * methods (.returning() claims, .limit()/.offset()/.orderBy() reads). Every
   * player read in the service ends .limit(1) — the methods return the same
   * awaited rows.
   */
  const makeWhere = (apply: () => Promise<unknown[]>): Promise<unknown[]> & {
    returning: () => Promise<unknown[]>;
    limit: () => Promise<unknown[]>;
    offset: () => Promise<unknown[]>;
    orderBy: () => Promise<unknown[]>;
  } => {
    const p = apply();
    return Object.assign(p, {
      returning: async () => p,
      limit: () => p,
      offset: () => p,
      orderBy: () => p,
    }) as Promise<unknown[]> & {
      returning: () => Promise<unknown[]>;
      limit: () => Promise<unknown[]>;
      offset: () => Promise<unknown[]>;
      orderBy: () => Promise<unknown[]>;
    };
  };

  const mockDb = {
    select: (projection?: Row) => ({
      from: (table: unknown) => {
        if (table === playersTable) {
          return {
            where: (cond: unknown) =>
              makeWhere(async () => {
                const username = columnValue(cond, 'username');
                const row = username ? state.players.get(String(username)) : undefined;
                // Detached snapshot: writes later in the request must not be
                // visible through a reference the service already holds.
                return row ? [{ ...row }] : [];
              }),
          };
        }
        if (table === auctionsTable) {
          if (projection && 'count' in projection) {
            return { where: async () => [{ count: 0 }] };
          }
          return {
            where: (cond: unknown) => {
              const lookupId = columnValue(cond, 'auctionId');
              return {
                limit: async () => {
                  if (lookupId !== undefined) {
                    const row = state.auctions.find((r) => r.auctionId === lookupId);
                    // Detached snapshot — the claim's canonical-row mutation
                    // must not leak back into an already-fetched object.
                    return row ? [{ ...row }] : [];
                  }
                  return state.overdue.map((r) => ({ ...r }));
                },
                orderBy: () => ({
                  limit: () => ({
                    offset: async () => state.overdue,
                  }),
                }),
              };
            },
          };
        }
        return { where: async () => [] };
      },
    }),
    update: (table: unknown) => ({
      set: (patch: Row) => ({
        where: (cond: unknown) =>
          makeWhere(async () => {
            if (table === playersTable) {
              const username = String(columnValue(cond, 'username') ?? '');
              applyWalletWrite(patch, username);
              return [];
            }
            // auctions: status-flipping patches are claims (scripted via
            // claimWins); the leader-pair patch (no status) rides
            // leaderClaimWins. Post-claim settled-only patches also ride
            // leaderClaimWins (true by default — they only run after a won
            // claim anyway).
            const wins = patch.status !== undefined ? state.claimWins : state.leaderClaimWins;
            if (!wins) return [];
            applyAuctionPatch(patch);
            return [{ id: 'r1' }];
          }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (payload: Row) => {
        if (table === auctionsTable) state.auctionInserts.push(payload);
        if (table === tradesTable) state.trades.push(payload);
        return { insertedId: 'x' };
      },
    }),
    delete: () => ({ where: async () => [] }),
  };

  // Column-access proxies: any property read yields a tagged column stub so
  // sql`${col} + N` fragments carry the column name for delta extraction.
  const colProxy = (): Record<string, unknown> =>
    new Proxy({}, { get: (_t, prop) => (typeof prop === 'string' ? { name: prop } : undefined) });

  return {
    state,
    playersTable: colProxy(),
    auctionsTable: colProxy(),
    tradesTable: { __tag: 'trades' },
    mockDb,
  };
});

vi.mock('@/lib/db/connection', () => ({ db: mockDb }));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  players: playersTable,
}));

vi.mock('@/lib/db/schema/config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  auctions: auctionsTable,
  tradeHistory: tradesTable,
}));

// The doc-bridge needs a real PgTable (getTableName/getTableColumns); under the
// mocked schema the rows already carry every domain field, so identity-shape.
vi.mock('@/lib/db/auctionDocBridge', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  syncAuctionDocFields: () => undefined,
  shapeRowAuctions: (_table: unknown, row: Record<string, unknown>) => row,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/auctionNotification', () => ({
  notifyAuctionEvent: vi.fn(),
}));

import {
  settleExpiredAuctions,
  cancelAuction,
  placeBid,
} from '@/lib/auctionService';
// createAuctionListing / buyoutAuction are imported lazily inside their suites
// (same pattern as the pre-existing buyout delivery test).
import { AuctionItemType, AuctionStatus } from '@/types/auction.types';

function auctionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    auctionId: 'AUC-TEST-1',
    sellerUsername: 'seller1',
    status: 'active',
    currentBid: 500,
    highestBidder: 'winner1',
    buyoutPrice: null,
    saleFee: 0.05,
    settled: false,
    expiresAt: new Date(Date.now() - 60_000),
    bids: [{ bidId: 'BID-1', bidderUsername: 'winner1', bidAmount: 500, isWinning: true }],
    item: { itemType: 'resource', resourceType: 'metal', resourceAmount: 1000 },
    ...overrides,
  };
}

function seedPlayer(username: string, metal = 0, energy = 0, units: unknown[] = []) {
  state.players.set(username, { username, resourcesMetal: metal, resourcesEnergy: energy, units });
}

const wallet = (username: string, delta: number, column = 'resourcesMetal') =>
  state.walletOps.filter((op) => op.username === username && op.delta === delta && op.column === column);

/**
 * Deep-includes for unit-appends: appended arrays ride SQL params as JSON
 * strings, so the recorded objects are round-trip copies — reference identity
 * (`includes`) can never match. Snapshot semantics = deep equality.
 */
const deepIncludes = (arr: unknown[], item: unknown): boolean =>
  arr.some((u) => JSON.stringify(u) === JSON.stringify(item));

beforeEach(() => {
  state.players.clear();
  state.auctions = [];
  state.overdue = [];
  state.trades = [];
  state.auctionInserts = [];
  state.claimWins = true;
  state.leaderClaimWins = true;
  state.walletOps = [];
  state.unitAppends = [];
  state.unitsSets = [];
  state.auctionPatches = [];
  state.events = [];
});

describe('settleExpiredAuctions', () => {
  it('settles a bid auction as Sold: pays seller finalPrice − fee, marks settled', async () => {
    state.overdue = [auctionRow()];
    seedPlayer('seller1');

    const result = await settleExpiredAuctions();

    expect(result.checked).toBe(1);
    expect(result.sold).toBe(1);
    expect(wallet('seller1', 475)).toHaveLength(1); // 500 − 5% = 475 to seller1
    const settlePatch = state.auctionPatches.find((p) => p.settled !== undefined);
    expect(settlePatch).toBeDefined();
    expect(settlePatch?.settled).toBe(1); // smallint mirror of true
    expect(state.trades).toHaveLength(1);
  });

  it('settles a no-bid auction as Expired and refunds the escrowed resources', async () => {
    state.overdue = [auctionRow({ bids: [], highestBidder: null, currentBid: null })];
    seedPlayer('seller1');

    const result = await settleExpiredAuctions();

    expect(result.expired).toBe(1);
    expect(result.sold).toBe(0);
    expect(wallet('seller1', 1000)).toHaveLength(1);
  });

  it('refunds escrowed ENERGY with the energy key (no metal cross-contamination)', async () => {
    state.overdue = [
      auctionRow({
        bids: [],
        highestBidder: null,
        currentBid: null,
        item: { itemType: 'resource', resourceType: 'energy', resourceAmount: 250 },
      }),
    ];
    seedPlayer('seller1');

    const result = await settleExpiredAuctions();

    expect(result.expired).toBe(1);
    expect(wallet('seller1', 250, 'resourcesEnergy')).toHaveLength(1);
    expect(wallet('seller1', 250, 'resourcesMetal')).toHaveLength(0);
  });

  it('claim-lost auctions are skipped without counting as errors', async () => {
    state.overdue = [auctionRow()];
    state.claimWins = false; // someone else settled it first
    seedPlayer('seller1');

    const result = await settleExpiredAuctions();

    expect(result.sold).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.errors).toBe(0);
    expect(state.walletOps).toHaveLength(0);
  });
});

describe('cancelAuction refunds', () => {
  it('returns escrowed resources to the seller on cancel', async () => {
    state.auctions = [
      auctionRow({
        status: AuctionStatus.Active,
        settled: false,
        bids: [],
        highestBidder: null,
        currentBid: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    ];
    seedPlayer('seller1');

    const result = await cancelAuction('seller1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    expect(wallet('seller1', 1000)).toHaveLength(1);
    // FID-20260914-003: the close is claimed via a guarded update — the refund
    // write is gated on winning that claim (double-cancel pays once).
    const claim = state.auctionPatches.find((p) => p.status === 'cancelled');
    expect(claim).toBeDefined();
  });

  it('returns the escrowed unit (snapshot) to the seller on cancel', async () => {
    const unit = { unitId: 'U1', name: 'Grunt' };
    state.auctions = [
      auctionRow({
        status: AuctionStatus.Active,
        settled: false,
        bids: [],
        highestBidder: null,
        currentBid: null,
        expiresAt: new Date(Date.now() + 3_600_000),
        item: { itemType: AuctionItemType.Unit, unitId: 'U1', unitSnapshot: unit },
      }),
    ];
    seedPlayer('seller1');

    const result = await cancelAuction('seller1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const giveBack = state.unitAppends.find((op) => op.username === 'seller1' && deepIncludes(op.units, unit));
    expect(giveBack).toBeDefined();
  });

  it('a lost cancel claim refunds nothing (row already closed)', async () => {
    state.auctions = [
      auctionRow({
        status: AuctionStatus.Active,
        settled: false,
        bids: [],
        highestBidder: null,
        currentBid: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    ];
    state.claimWins = false; // someone else closed it
    seedPlayer('seller1');

    const result = await cancelAuction('seller1', 'AUC-TEST-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUCTION_NOT_ACTIVE');
    expect(state.walletOps).toHaveLength(0);
    expect(state.unitAppends).toHaveLength(0);
  });
});

describe('placeBid escrow', () => {
  it('deducts the bid from the bidder and refunds the previous leader', async () => {
    seedPlayer('bidder2', 5000);
    state.auctions = [
      auctionRow({ currentBid: 500, highestBidder: 'winner1', expiresAt: new Date(Date.now() + 3_600_000) }),
    ];
    state.leaderClaimWins = true;

    const result = await placeBid('bidder2', { auctionId: 'AUC-TEST-1', bidAmount: 700 });

    expect(result.success).toBe(true);
    expect(wallet('bidder2', -700)).toHaveLength(1);
    expect(wallet('winner1', 500)).toHaveLength(1);
  });

  it('a bid racing a closed row refunds its own escrow and touches no other wallet', async () => {
    seedPlayer('bidder2', 5000);
    state.auctions = [
      auctionRow({ currentBid: 500, highestBidder: 'winner1', expiresAt: new Date(Date.now() + 3_600_000) }),
    ];
    // Claim lost: a concurrent buyout/settlement flipped status between the
    // bidder's validation and their leader write (FID-20260914-003).
    state.leaderClaimWins = false;

    const result = await placeBid('bidder2', { auctionId: 'AUC-TEST-1', bidAmount: 700 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUCTION_NOT_ACTIVE');
    // The fresh escrow is refunded exactly; the previous leader's escrow was
    // never touched (their release only runs after a won claim).
    expect(wallet('bidder2', 700)).toHaveLength(1);
    expect(wallet('winner1', 500)).toHaveLength(0);
  });

  it('rejects bids below current + increment without touching any wallet', async () => {
    seedPlayer('bidder2', 5000);
    state.auctions = [
      auctionRow({ currentBid: 500, highestBidder: 'winner1', expiresAt: new Date(Date.now() + 3_600_000) }),
    ];

    const result = await placeBid('bidder2', { auctionId: 'AUC-TEST-1', bidAmount: 550 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('BID_TOO_LOW');
    expect(state.walletOps).toHaveLength(0);
  });
});

describe('buyout resource delivery (via transferAuctionItem)', () => {
  it('credits the buyer with the resources_metal key that resolves in the seam', async () => {
    // buyoutAuction path: item delivery must credit resources_metal, not bare
    // 'metal' (which silently dropped in the pre-065 seam).
    seedPlayer('buyer1', 999999);
    state.auctions = [
      auctionRow({
        buyoutPrice: 2000,
        currentBid: 300,
        highestBidder: null,
        bids: [],
        item: { itemType: 'resource', resourceType: 'metal', resourceAmount: 5000 },
      }),
    ];

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    expect(wallet('buyer1', 5000)).toHaveLength(1);
  });
});

describe('buyoutAuction claim-first close (FID-20260914-003)', () => {
  function buyoutRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return auctionRow({
      buyoutPrice: 2000,
      currentBid: 300,
      highestBidder: 'winner1',
      bids: [{ bidId: 'BID-1', bidderUsername: 'winner1', bidAmount: 300, isWinning: true }],
      expiresAt: new Date(Date.now() + 3_600_000),
      ...overrides,
    });
  }

  it('closes via a status-claim FIRST and refunds the outbid leader exactly once', async () => {
    state.auctions = [buyoutRow()];
    seedPlayer('buyer1', 999999);
    seedPlayer('seller1');
    seedPlayer('winner1');

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    // Claim-first: exactly ONE sold-status write exists and it precedes every
    // wallet movement. (The status guard itself is tsc-pinned against the real
    // WHERE; the mock scripts the claim outcome.)
    const soldPatches = state.auctionPatches.filter((p) => p.status === 'sold');
    expect(soldPatches).toHaveLength(1);
    const claimIdx = state.events.indexOf('patch:sold');
    const firstWalletIdx = state.events.indexOf('wallet');
    expect(claimIdx).toBeGreaterThan(-1);
    expect(firstWalletIdx).toBeGreaterThan(claimIdx);

    // Seller: 2000 − 5% fee = 1900. Buyer: −2000. Outbid leader winner1: +300 once.
    expect(wallet('seller1', 1900)).toHaveLength(1);
    expect(wallet('buyer1', -2000)).toHaveLength(1);
    expect(wallet('winner1', 300)).toHaveLength(1);
  });

  it('a buyout BY the current leader charges only the remainder (no double-pay)', async () => {
    state.auctions = [buyoutRow({ highestBidder: 'buyer1' })];
    seedPlayer('buyer1', 999999);
    seedPlayer('seller1');

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    // Leader === buyer: escrow 300 IS the payment → charge 2000 − 300 = 1700.
    expect(wallet('buyer1', -1700)).toHaveLength(1);
    // No +300 self-refund and no full −2000 charge may appear.
    expect(wallet('buyer1', 300)).toHaveLength(0);
    expect(wallet('buyer1', -2000)).toHaveLength(0);
  });

  it('a lost close claim pays nothing and reports the row inactive', async () => {
    state.auctions = [buyoutRow()];
    state.claimWins = false; // concurrent buyer won
    seedPlayer('buyer1', 999999);

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUCTION_NOT_ACTIVE');
    expect(state.walletOps).toHaveLength(0);
  });

  it('rolls the claim back when delivery fails — no money moves', async () => {
    // Unit listing WITHOUT a snapshot (legacy row) whose unit is gone from the
    // seller's army → transfer fails after the claim flipped status.
    state.auctions = [
      buyoutRow({
        item: { itemType: AuctionItemType.Unit, unitId: 'GONE' },
      }),
    ];
    seedPlayer('buyer1', 999999);
    seedPlayer('seller1'); // units: [] → GONE not found

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('UNIT_NOT_FOUND');
    // Rollback: the row returns to Active so settlement/other buyers proceed.
    const rollback = state.auctionPatches.find((p) => p.status === 'active');
    expect(rollback).toBeDefined();
    // No wallet writes: leader escrow untouched, buyer not charged, seller not paid.
    expect(state.walletOps).toHaveLength(0);
  });
});

describe('unit escrow at listing (FID-20260914-003)', () => {
  it('snapshots the unit, removes it from the army, and charges the fee', async () => {
    const unit = { unitId: 'U1', name: 'Grunt', quantity: 1 };
    seedPlayer('seller1', 5000, 0, [unit, { unitId: 'U2', name: 'Scout', quantity: 1 }]);

    const { createAuctionListing } = await import('@/lib/auctionService');
    const result = await createAuctionListing('seller1', {
      item: { itemType: AuctionItemType.Unit, unitId: 'U1' },
      startingBid: 1000,
      duration: 12,
    });

    expect(result.success).toBe(true);
    const inserted = state.auctionInserts[0] as { item: { unitSnapshot?: unknown } };
    expect(inserted.item.unitSnapshot).toEqual(unit);
    // Escrow: the seller's units array is rewritten WITHOUT the listed unit.
    expect(state.unitsSets).toHaveLength(1);
    expect(state.unitsSets[0].username).toBe('seller1');
    expect(state.unitsSets[0].units).toHaveLength(1);
    // Listing fee (12h = 100) is charged in the same write.
    expect(wallet('seller1', -100)).toHaveLength(1);
  });

  it('rejects TradeableItem listings before any lock or fee is taken', async () => {
    seedPlayer('seller1', 5000);

    const { createAuctionListing } = await import('@/lib/auctionService');
    const result = await createAuctionListing('seller1', {
      item: { itemType: AuctionItemType.TradeableItem, tradeableItemQuantity: 1 },
      startingBid: 1000,
      duration: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('TRADEABLE_NOT_TRADEABLE_YET');
    expect(state.auctionInserts).toHaveLength(0);
    expect(state.walletOps).toHaveLength(0);
    expect(state.unitsSets).toHaveLength(0);
  });

  it('settlement of an expired unit listing returns the escrowed unit to the seller', async () => {
    const unit = { unitId: 'U1', name: 'Grunt', quantity: 1 };
    state.overdue = [
      auctionRow({
        bids: [],
        highestBidder: null,
        currentBid: null,
        item: { itemType: AuctionItemType.Unit, unitId: 'U1', unitSnapshot: unit },
      }),
    ];
    seedPlayer('seller1');

    const result = await settleExpiredAuctions();

    expect(result.expired).toBe(1);
    const giveBack = state.unitAppends.find((op) => op.username === 'seller1' && deepIncludes(op.units, unit));
    expect(giveBack).toBeDefined();
  });

  it('unit delivery on sale pushes the SNAPSHOT to the buyer (seller-side not required)', async () => {
    const unit = { unitId: 'U1', name: 'Grunt', quantity: 1 };
    state.auctions = [
      auctionRow({
        buyoutPrice: 2000,
        currentBid: 300,
        highestBidder: 'winner1',
        bids: [{ bidId: 'BID-1', bidderUsername: 'winner1', bidAmount: 300, isWinning: true }],
        expiresAt: new Date(Date.now() + 3_600_000),
        item: { itemType: AuctionItemType.Unit, unitId: 'U1', unitSnapshot: unit },
      }),
    ];
    seedPlayer('buyer1', 999999);
    seedPlayer('seller1');

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    // The delivery push targets the BUYER, and no seller-side unit write occurs.
    const delivery = state.unitAppends.find((op) => op.username === 'buyer1' && deepIncludes(op.units, unit));
    expect(delivery).toBeDefined();
    expect(state.unitsSets).toHaveLength(0);
  });
});
