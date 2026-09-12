/**
 * FID-20260912-065 — auction settlement contract tests.
 *
 * The settlement engine moves real money (escrow releases, seller payouts,
 * refunds). These tests pin the outcome matrix at the seam boundary with a
 * scripted getCollection mock, so a seam change that breaks an $inc key or a
 * status transition fails here instead of in the live economy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- scripted collection mock -------------------------------------------------

type Row = Record<string, unknown>;

interface ScriptedCollection {
  findOne: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
}

const collections: Record<string, ScriptedCollection> = {};

function scriptCollection(name: string): ScriptedCollection {
  const c: ScriptedCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    find: vi.fn().mockReturnThis(),
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'x' }),
  };
  // find() must expose .limit().toArray()
  (c.find as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    limit: () => ({ toArray: async () => [] }),
  }));
  collections[name] = c;
  return c;
}

vi.mock('@/lib/mongodb', () => ({
  getCollection: async (name: string) => collections[name] ?? scriptCollection(name),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  settleExpiredAuctions,
  cancelAuction,
  placeBid,
} from '@/lib/auctionService';
import { AuctionStatus, AuctionItemType } from '@/types/auction.types';

function auctionRow(overrides: Partial<Row> = {}): Row {
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

beforeEach(() => {
  for (const k of Object.keys(collections)) delete collections[k];
});

describe('settleExpiredAuctions', () => {
  it('settles a bid auction as Sold: pays seller finalPrice − fee, marks settled', async () => {
    const auctions = scriptCollection('auctions');
    auctions.find.mockImplementation(() => ({
      limit: () => ({ toArray: async () => [auctionRow()] }),
    }));
    const players = scriptCollection('players');
    // transferAuctionItem re-reads seller for resource items? (resource branch
    // doesn't) — but placeBid's flow is not exercised here.
    players.findOne.mockResolvedValue({ username: 'seller1', units: [], resources: { metal: 0, energy: 0 } });

    const result = await settleExpiredAuctions();

    expect(result.checked).toBe(1);
    expect(result.sold).toBe(1);
    const pay = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 475
    );
    expect(pay).toBeDefined(); // 500 − 5% = 475 to seller1
    const auctionsSettle = auctions.updateOne.mock.calls.find(
      ([, u]) => (u as { $set?: Record<string, unknown> }).$set?.settled === true
    );
    expect(auctionsSettle).toBeDefined();
    expect(collections['tradeHistory']).toBeDefined();
    expect(collections['tradeHistory'].insertOne).toHaveBeenCalled();
  });

  it('settles a no-bid auction as Expired and refunds the escrowed resources', async () => {
    const auctions = scriptCollection('auctions');
    auctions.find.mockImplementation(() => ({
      limit: () => ({
        toArray: async () => [auctionRow({ bids: [], highestBidder: null, currentBid: null })],
      }),
    }));
    const players = scriptCollection('players');
    players.findOne.mockResolvedValue({ username: 'seller1', units: [], resources: { metal: 0, energy: 0 } });

    const result = await settleExpiredAuctions();

    expect(result.expired).toBe(1);
    expect(result.sold).toBe(0);
    const refund = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 1000
    );
    expect(refund).toBeDefined();
  });

  it('refunds escrowed ENERGY with the energy key (no metal cross-contamination)', async () => {
    const auctions = scriptCollection('auctions');
    auctions.find.mockImplementation(() => ({
      limit: () => ({
        toArray: async () => [
          auctionRow({
            bids: [],
            highestBidder: null,
            currentBid: null,
            item: { itemType: 'resource', resourceType: 'energy', resourceAmount: 250 },
          }),
        ],
      }),
    }));
    const players = scriptCollection('players');
    players.findOne.mockResolvedValue({ username: 'seller1', units: [], resources: { metal: 0, energy: 0 } });

    const result = await settleExpiredAuctions();

    expect(result.expired).toBe(1);
    const refund = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_energy === 250
    );
    expect(refund).toBeDefined();
  });

  it('claim-lost auctions are skipped without counting as errors', async () => {
    const auctions = scriptCollection('auctions');
    auctions.find.mockImplementation(() => ({
      limit: () => ({ toArray: async () => [auctionRow()] }),
    }));
    // First updateOne (the claim) matches nothing — someone else settled it.
    auctions.updateOne.mockResolvedValue({ modifiedCount: 0 });
    const players = scriptCollection('players');

    const result = await settleExpiredAuctions();

    expect(result.sold).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.errors).toBe(0);
    expect(players.updateOne).not.toHaveBeenCalled();
  });
});

describe('cancelAuction refunds', () => {
  it('returns escrowed resources to the seller on cancel', async () => {
    const auctions = scriptCollection('auctions');
    auctions.findOne.mockResolvedValue(
      auctionRow({
        status: AuctionStatus.Active,
        settled: false,
        bids: [],
        highestBidder: null,
        currentBid: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      })
    );
    const players = scriptCollection('players');

    const result = await cancelAuction('seller1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const refund = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 1000
    );
    expect(refund).toBeDefined();
    const statusSet = auctions.updateOne.mock.calls.find(
      ([, u]) => (u as { $set?: Record<string, unknown> }).$set?.status === 'cancelled'
    );
    expect(statusSet).toBeDefined();
  });
});

describe('placeBid escrow', () => {
  it('deducts the bid from the bidder and refunds the previous leader', async () => {
    const players = scriptCollection('players');
    players.findOne
      .mockResolvedValueOnce({
        username: 'bidder2',
        resources: { metal: 5000, energy: 0 },
        units: [],
      }) // bidder
      .mockResolvedValue({ ...auctionRow(), auctionId: 'AUC-TEST-1' }); // re-reads
    const auctions = scriptCollection('auctions');
    auctions.findOne.mockResolvedValue(
      auctionRow({ currentBid: 500, highestBidder: 'winner1', expiresAt: new Date(Date.now() + 3_600_000) })
    );

    const result = await placeBid('bidder2', { auctionId: 'AUC-TEST-1', bidAmount: 700 });

    expect(result.success).toBe(true);
    const escrow = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === -700
    );
    expect(escrow).toBeDefined();
    const release = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 500
    );
    expect(release).toBeDefined();
  });

  it('rejects bids below current + increment without touching any wallet', async () => {
    const players = scriptCollection('players');
    players.findOne.mockResolvedValue({
      username: 'bidder2',
      resources: { metal: 5000, energy: 0 },
      units: [],
    });
    const auctions = scriptCollection('auctions');
    auctions.findOne.mockResolvedValue(
      auctionRow({ currentBid: 500, highestBidder: 'winner1', expiresAt: new Date(Date.now() + 3_600_000) })
    );

    const result = await placeBid('bidder2', { auctionId: 'AUC-TEST-1', bidAmount: 550 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('BID_TOO_LOW');
    expect(players.updateOne).not.toHaveBeenCalled();
  });
});

describe('buyout resource delivery (via transferAuctionItem)', () => {
  it('credits the buyer with the resources_metal key that resolves in the seam', async () => {
    // buyoutAuction path: item delivery must use resources_metal (the seam-resolvable
    // alias), not bare 'metal' (which silently dropped). We assert via the exported
    // buyoutAuction on a resource listing.
    const players = scriptCollection('players');
    const buyer = { username: 'buyer1', resources: { metal: 999999, energy: 0 }, units: [] };
    players.findOne.mockImplementation(async (f: Row) => {
      const username = (f as { username?: string }).username;
      if (username === 'buyer1') return buyer;
      return { username: 'seller1', units: [], resources: { metal: 0, energy: 0 } };
    });
    const auctions = scriptCollection('auctions');
    auctions.findOne.mockResolvedValue(
      auctionRow({
        buyoutPrice: 2000,
        currentBid: 300,
        highestBidder: null,
        bids: [],
        item: { itemType: 'resource', resourceType: 'metal', resourceAmount: 5000 },
      })
    );

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const delivery = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 5000
    );
    expect(delivery).toBeDefined();
  });
});
