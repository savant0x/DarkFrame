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
  findOneAndUpdate: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
  countDocuments: ReturnType<typeof vi.fn>;
}

const collections: Record<string, ScriptedCollection> = {};

function scriptCollection(name: string): ScriptedCollection {
  const c: ScriptedCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    // FID-20260914-003: claim-conditional writes arbitrate through
    // findOneAndUpdate. Default null = "claim lost" so a test that forgets to
    // script a claim fails loudly instead of silently refunding nothing.
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnThis(),
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'x' }),
    countDocuments: vi.fn().mockResolvedValue(0),
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
// createAuctionListing / buyoutAuction are imported lazily inside their suites
// (same pattern as the pre-existing buyout delivery test).
import { AuctionItemType, AuctionStatus } from '@/types/auction.types';

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
    const row = auctionRow({
      status: AuctionStatus.Active,
      settled: false,
      bids: [],
      highestBidder: null,
      currentBid: null,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    auctions.findOne.mockResolvedValue(row);
    auctions.findOneAndUpdate.mockResolvedValue(row); // claim won
    const players = scriptCollection('players');

    const result = await cancelAuction('seller1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const refund = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 1000
    );
    expect(refund).toBeDefined();
    // FID-20260914-003: the close is claimed via findOneAndUpdate — the refund
    // write is gated on winning that claim (double-cancel pays once).
    const claim = auctions.findOneAndUpdate.mock.calls.find(
      ([f, u]) =>
        (f as { status?: string }).status === 'active' &&
        (u as { $set?: Record<string, unknown> }).$set?.status === 'cancelled'
    );
    expect(claim).toBeDefined();
  });

  it('returns the escrowed unit (snapshot) to the seller on cancel', async () => {
    const auctions = scriptCollection('auctions');
    const unit = { unitId: 'U1', name: 'Grunt' };
    const row = auctionRow({
      status: AuctionStatus.Active,
      settled: false,
      bids: [],
      highestBidder: null,
      currentBid: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      item: { itemType: AuctionItemType.Unit, unitId: 'U1', unitSnapshot: unit },
    });
    auctions.findOne.mockResolvedValue(row);
    auctions.findOneAndUpdate.mockResolvedValue(row);
    const players = scriptCollection('players');

    const result = await cancelAuction('seller1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const giveBack = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $push?: { units?: unknown } }).$push?.units === unit
    );
    expect(giveBack).toBeDefined();
  });

  it('a lost cancel claim refunds nothing (row already closed)', async () => {
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
    auctions.findOneAndUpdate.mockResolvedValue(null); // someone else closed it
    const players = scriptCollection('players');

    const result = await cancelAuction('seller1', 'AUC-TEST-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUCTION_NOT_ACTIVE');
    expect(players.updateOne).not.toHaveBeenCalled();
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
    auctions.findOneAndUpdate.mockResolvedValue(
      auctionRow({ currentBid: 700, highestBidder: 'bidder2', expiresAt: new Date(Date.now() + 3_600_000) })
    ); // leader claim won

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

  it('a bid racing a closed row refunds its own escrow and touches no other wallet', async () => {
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
    // Claim lost: a concurrent buyout/settlement flipped status between the
    // bidder's validation and their leader write (FID-20260914-003).
    auctions.findOneAndUpdate.mockResolvedValue(null);

    const result = await placeBid('bidder2', { auctionId: 'AUC-TEST-1', bidAmount: 700 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUCTION_NOT_ACTIVE');
    // The fresh escrow is refunded exactly; the previous leader's escrow was
    // never touched (their release only runs after a won claim).
    const refund = players.updateOne.mock.calls.filter(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 700
    );
    expect(refund).toHaveLength(1);
    const release = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 500
    );
    expect(release).toBeUndefined();
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
    const row = auctionRow({
      buyoutPrice: 2000,
      currentBid: 300,
      highestBidder: null,
      bids: [],
      item: { itemType: 'resource', resourceType: 'metal', resourceAmount: 5000 },
    });
    auctions.findOne.mockResolvedValue(row);
    auctions.findOneAndUpdate.mockResolvedValue(row); // claim-first close won

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const delivery = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === 5000
    );
    expect(delivery).toBeDefined();
  });
});

describe('buyoutAuction claim-first close (FID-20260914-003)', () => {
  function buyoutRow(overrides: Partial<Row> = {}): Row {
    return auctionRow({
      buyoutPrice: 2000,
      currentBid: 300,
      highestBidder: 'winner1',
      bids: [{ bidId: 'BID-1', bidderUsername: 'winner1', bidAmount: 300, isWinning: true }],
      expiresAt: new Date(Date.now() + 3_600_000),
      ...overrides,
    });
  }

  function scriptedPlayers(): ReturnType<typeof scriptCollection> {
    const players = scriptCollection('players');
    players.findOne.mockImplementation(async (f: Row) => {
      const username = (f as { username?: string }).username;
      if (username === 'buyer1') {
        return { username: 'buyer1', resources: { metal: 999999, energy: 0 }, units: [] };
      }
      return { username, units: [], resources: { metal: 0, energy: 0 } };
    });
    return players;
  }

  function incCalls(players: ReturnType<typeof scriptCollection>): Array<number | undefined> {
    return players.updateOne.mock.calls.map(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal
    );
  }

  it('closes via a status-claim FIRST and refunds the outbid leader exactly once', async () => {
    const auctions = scriptCollection('auctions');
    const row = buyoutRow();
    auctions.findOne.mockResolvedValue(row);
    auctions.findOneAndUpdate.mockResolvedValue(row);
    const players = scriptedPlayers();

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    // Claim-first: the close is a conditional findOneAndUpdate on status 'active'.
    const claim = auctions.findOneAndUpdate.mock.calls.find(
      ([f, u]) =>
        (f as { status?: string }).status === 'active' &&
        (u as { $set?: Record<string, unknown> }).$set?.status === 'sold'
    );
    expect(claim).toBeDefined();
    // No unconditional status write may remain.
    const unconditionalSold = auctions.updateOne.mock.calls.find(
      ([, u]) => (u as { $set?: Record<string, unknown> }).$set?.status === 'sold'
    );
    expect(unconditionalSold).toBeUndefined();

    const incs = incCalls(players);
    // Seller: 2000 − 5% fee = 1900. Buyer: −2000. Outbid leader winner1: +300 once.
    expect(incs.filter((v) => v === 1900)).toHaveLength(1);
    expect(incs.filter((v) => v === -2000)).toHaveLength(1);
    expect(incs.filter((v) => v === 300)).toHaveLength(1);
  });

  it('a buyout BY the current leader charges only the remainder (no double-pay)', async () => {
    const auctions = scriptCollection('auctions');
    const row = buyoutRow({ highestBidder: 'buyer1' });
    auctions.findOne.mockResolvedValue(row);
    auctions.findOneAndUpdate.mockResolvedValue(row);
    const players = scriptedPlayers();

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const incs = incCalls(players);
    // Leader === buyer: escrow 300 IS the payment → charge 2000 − 300 = 1700.
    expect(incs.filter((v) => v === -1700)).toHaveLength(1);
    // No +300 self-refund and no full −2000 charge may appear.
    expect(incs.filter((v) => v === 300)).toHaveLength(0);
    expect(incs.filter((v) => v === -2000)).toHaveLength(0);
  });

  it('a lost close claim pays nothing and reports the row inactive', async () => {
    const auctions = scriptCollection('auctions');
    auctions.findOne.mockResolvedValue(buyoutRow());
    auctions.findOneAndUpdate.mockResolvedValue(null); // concurrent buyer won
    const players = scriptedPlayers();

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('AUCTION_NOT_ACTIVE');
    expect(players.updateOne).not.toHaveBeenCalled();
  });

  it('rolls the claim back when delivery fails — no money moves', async () => {
    const auctions = scriptCollection('auctions');
    // Unit listing WITHOUT a snapshot (legacy row) whose unit is gone from the
    // seller's army → transfer fails after the claim flipped status.
    const row = buyoutRow({
      item: { itemType: AuctionItemType.Unit, unitId: 'GONE' },
    });
    auctions.findOne.mockResolvedValue(row);
    auctions.findOneAndUpdate.mockResolvedValue(row);
    const players = scriptedPlayers();

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('UNIT_NOT_FOUND');
    // Rollback: the row returns to Active so settlement/other buyers proceed.
    const rollback = auctions.updateOne.mock.calls.find(
      ([, u]) => (u as { $set?: Record<string, unknown> }).$set?.status === 'active'
    );
    expect(rollback).toBeDefined();
    // No wallet writes: leader escrow untouched, buyer not charged, seller not paid.
    expect(players.updateOne).not.toHaveBeenCalled();
  });
});

describe('unit escrow at listing (FID-20260914-003)', () => {
  it('snapshots the unit, removes it from the army, and charges the fee', async () => {
    const players = scriptCollection('players');
    const unit = { unitId: 'U1', name: 'Grunt', quantity: 1 };
    players.findOne.mockResolvedValue({
      username: 'seller1',
      resources: { metal: 5000, energy: 0 },
      units: [unit, { unitId: 'U2', name: 'Scout', quantity: 1 }],
    });
    const auctions = scriptCollection('auctions');

    const { createAuctionListing } = await import('@/lib/auctionService');
    const result = await createAuctionListing('seller1', {
      item: { itemType: AuctionItemType.Unit, unitId: 'U1' },
      startingBid: 1000,
      duration: 12,
    });

    expect(result.success).toBe(true);
    const inserted = auctions.insertOne.mock.calls[0][0] as {
      item: { unitSnapshot?: unknown };
    };
    expect(inserted.item.unitSnapshot).toEqual(unit);
    // Escrow: the seller's units array is rewritten WITHOUT the listed unit.
    const escrow = players.updateOne.mock.calls.find(
      ([, u]) =>
        Array.isArray((u as { $set?: { units?: unknown[] } }).$set?.units) &&
        (u as { $set?: { units?: unknown[] } }).$set?.units?.length === 1
    );
    expect(escrow).toBeDefined();
    // Listing fee (12h = 100) is charged in the same write.
    const fee = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $inc?: Record<string, number> }).$inc?.resources_metal === -100
    );
    expect(fee).toBeDefined();
  });

  it('rejects TradeableItem listings before any lock or fee is taken', async () => {
    const players = scriptCollection('players');
    players.findOne.mockResolvedValue({
      username: 'seller1',
      resources: { metal: 5000, energy: 0 },
      units: [],
    });
    const auctions = scriptCollection('auctions');

    const { createAuctionListing } = await import('@/lib/auctionService');
    const result = await createAuctionListing('seller1', {
      item: { itemType: AuctionItemType.TradeableItem, tradeableItemQuantity: 1 },
      startingBid: 1000,
      duration: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('TRADEABLE_NOT_TRADEABLE_YET');
    expect(auctions.insertOne).not.toHaveBeenCalled();
    expect(players.updateOne).not.toHaveBeenCalled();
  });

  it('settlement of an expired unit listing returns the escrowed unit to the seller', async () => {
    const auctions = scriptCollection('auctions');
    const unit = { unitId: 'U1', name: 'Grunt', quantity: 1 };
    auctions.find.mockImplementation(() => ({
      limit: () => ({
        toArray: async () => [
          auctionRow({
            bids: [],
            highestBidder: null,
            currentBid: null,
            item: { itemType: AuctionItemType.Unit, unitId: 'U1', unitSnapshot: unit },
          }),
        ],
      }),
    }));
    const players = scriptCollection('players');

    const result = await settleExpiredAuctions();

    expect(result.expired).toBe(1);
    const giveBack = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $push?: { units?: unknown } }).$push?.units === unit
    );
    expect(giveBack).toBeDefined();
  });

  it('unit delivery on sale pushes the SNAPSHOT to the buyer (seller-side not required)', async () => {
    const auctions = scriptCollection('auctions');
    const unit = { unitId: 'U1', name: 'Grunt', quantity: 1 };
    const row = auctionRow({
      buyoutPrice: 2000,
      currentBid: 300,
      highestBidder: 'winner1',
      bids: [{ bidId: 'BID-1', bidderUsername: 'winner1', bidAmount: 300, isWinning: true }],
      expiresAt: new Date(Date.now() + 3_600_000),
      item: { itemType: AuctionItemType.Unit, unitId: 'U1', unitSnapshot: unit },
    });
    auctions.findOne.mockResolvedValue(row);
    auctions.findOneAndUpdate.mockResolvedValue(row);
    const players = scriptCollection('players');
    players.findOne.mockImplementation(async (f: Row) => {
      const username = (f as { username?: string }).username;
      if (username === 'buyer1') {
        return { username: 'buyer1', resources: { metal: 999999, energy: 0 }, units: [] };
      }
      return { username, units: [], resources: { metal: 0, energy: 0 } };
    });

    const { buyoutAuction } = await import('@/lib/auctionService');
    const result = await buyoutAuction('buyer1', 'AUC-TEST-1');

    expect(result.success).toBe(true);
    const delivery = players.updateOne.mock.calls.find(
      ([, u]) => (u as { $push?: { units?: unknown } }).$push?.units === unit
    );
    expect(delivery).toBeDefined();
    // The delivery push targets the BUYER, and no seller-side unit write occurs.
    const [calledFilter] = delivery!;
    expect((calledFilter as { username?: string }).username).toBe('buyer1');
  });
});
