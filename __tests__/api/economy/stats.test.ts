/**
 * @file __tests__/api/economy/stats.test.ts
 * @overview FID-20260909-031 §4.1 regression — the economy statistics
 * aggregate endpoint.
 *
 * Pins the route contract:
 *  - Unauthenticated requests are rejected (session identity, per FID-023)
 *  - Authenticated requests return the full aggregate shape from the
 *    Drizzle aggregation (mocked seam) and route through the 60s cache
 *  - Derived metrics (median, avgFeePct, zero-filled flow days) compute
 *    honestly from the served rows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { capture } = vi.hoisted(() => ({
  capture: {
    // Result-set queue: one array per db.select(...) consumed, in order.
    results: [] as unknown[][],
    cacheStore: new Map<string, unknown>(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const builder: Record<string, unknown> = {
          where: () => builder,
          groupBy: () => builder,
          orderBy: () => builder,
          limit: () => builder,
          then: (resolve: (v: unknown) => void) => {
            const rows = capture.results.shift() ?? [];
            resolve(rows);
          },
        };
        return builder;
      },
    }),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/schema')>()),
  auctions: {},
  playerActivity: {},
  players: {},
  tradeHistory: {},
}));

vi.mock('@/lib/cacheService', () => ({
  getCacheOrFetch: async <T,>(key: string, fetchFn: () => Promise<T>): Promise<T> => {
    if (capture.cacheStore.has(key)) return capture.cacheStore.get(key) as T;
    const value = await fetchFn();
    capture.cacheStore.set(key, value);
    return value;
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: vi.fn(),
}));

import { GET } from '@/app/api/economy/stats/route';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

const mockAuth = getAuthenticatedUser as ReturnType<typeof vi.fn>;

/** Build the 9 result sets computeEconomyStats consumes, in call order:
 *  0 trade ledger, 1 all-time, 2 today, 3 7d, 4 active book, 5 sold book,
 *  6 flow rows, 7 supply, 8 top sellers. */
function seedEconomyResults() {
  capture.results = [
    // Trade ledger (two trades, unsorted → median/sort derived in JS)
    [
      { finalPrice: 5000, saleFee: 250, sellerReceived: 4750, sellerUsername: 'Seller_A', buyerUsername: 'Buyer_B', completedAt: new Date() },
      { finalPrice: 1000, saleFee: 50, sellerReceived: 950, sellerUsername: 'Buyer_B', buyerUsername: 'Seller_A', completedAt: new Date() },
    ],
    [{ total: 2, volume: 6000 }],
    [{ total: 1, volume: 1000 }],
    [{ total: 2, volume: 6000 }],
    // Active book
    [{ activeCount: 4, avgBid: 1200.4, avgBuyout: 2500.9 }],
    // Sold book
    [{ soldCount: 8, avgSoldPrice: 3100.2, avgHours: 12.34 }],
    // Flow rows (only today has data; yesterday zero-filled by the route)
    [
      {
        bucket: new Date().toISOString().slice(0, 10),
        day: 'ignored',
        metal: 182400,
        energy: 96500,
        caves: 12,
      },
    ],
    // Supply
    [{ walletMetal: 7777777, walletEnergy: 8888888, bankedMetal: 111111, bankedEnergy: 222222 }],
    // Top sellers
    [{ username: 'Seller_A', trades: 1, volume: 5000, received: 4750 }],
  ];
}

function authenticatedGet() {
  const request = new NextRequest('http://localhost:3000/api/economy/stats');
  return GET(request, {} as never);
}

describe('GET /api/economy/stats (FID-031)', () => {
  beforeEach(() => {
    capture.results.length = 0;
    capture.cacheStore.clear();
    mockAuth.mockReset();
  });

  it('rejects unauthenticated requests (session identity, FID-023)', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await authenticatedGet();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns the full aggregate shape from live-seam rows', async () => {
    mockAuth.mockResolvedValue({ username: 'fame', isAdmin: false });
    seedEconomyResults();

    const response = await authenticatedGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const { data } = body;
    // Market
    expect(data.market.totalTrades).toBe(2);
    expect(data.market.totalVolume).toBe(6000);
    expect(data.market.tradesToday).toBe(1);
    expect(data.market.trades7d).toBe(2);
    expect(data.market.medianSalePrice).toBe(3000); // (1000+5000)/2
    expect(data.market.priceFloor).toBe(1000);
    expect(data.market.priceCeiling).toBe(5000);
    expect(data.market.avgSalePrice).toBe(3000);
    expect(data.market.totalFeesCollected).toBe(300);
    expect(data.market.avgFeePct).toBe(5); // 300/6000
    // Auctions
    expect(data.auctions.activeCount).toBe(4);
    expect(data.auctions.avgCurrentBidOnActive).toBe(1200);
    expect(data.auctions.avgBuyoutPrice).toBe(2501);
    expect(data.auctions.soldCount).toBe(8);
    expect(data.auctions.avgSoldPrice).toBe(3100);
    expect(data.auctions.avgTimeToSellHours).toBe(12.3);
    // Flow — 7 continuous days, today's from the served row, totals honest
    expect(data.flow7d.days).toHaveLength(7);
    const today = data.flow7d.days[6];
    expect(today.harvestedMetal).toBe(182400);
    expect(today.harvestedEnergy).toBe(96500);
    expect(today.caveExplorations).toBe(12);
    expect(data.flow7d.totals.harvestedMetal).toBe(182400);
    // Supply
    expect(data.supply.walletMetal).toBe(7777777);
    expect(data.supply.bankedEnergy).toBe(222222);
    // Top traders: Seller_A (1 sale) + 1 purchase = 2 participations
    expect(data.topTraders[0].username).toBe('Seller_A');
    expect(data.topTraders[0].trades).toBe(2);
    expect(data.topTraders[0].volume).toBe(6000);
  });

  it('serves the second request from the cache (single-flight key reuse)', async () => {
    mockAuth.mockResolvedValue({ username: 'fame', isAdmin: false });
    seedEconomyResults();

    await authenticatedGet();
    // The result queue is now empty — a second DB hit would resolve [] and
    // produce zeros, so if the cache works the first payload repeats.
    const response = await authenticatedGet();
    const body = await response.json();

    expect(body.data.market.totalTrades).toBe(2);
    expect(body.data.market.totalVolume).toBe(6000);
  });
});
