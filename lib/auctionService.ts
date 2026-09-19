/**
 * @file lib/auctionService.ts
 * @created 2025-01-17
 * @overview Auction House service for P2P trading system
 */

import { db } from './db/connection';
import { players } from './db/schema';
import { auctions, tradeHistory } from './db/schema/config';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { mapRowToPlayer } from './playerService';
import { AUCTION_DOC_COLUMNS, shapeRowAuctions } from './db/auctionDocBridge';
import { 
  AuctionListing, 
  AuctionBid, 
  AuctionStatus, 
  AuctionItem,
  AuctionItemType,
  TradeHistory,
  CreateAuctionRequest,
  PlaceBidRequest,
  AUCTION_CONFIG,
  AuctionSearchFilters,
} from '@/types/auction.types';
import type { Player, PlayerUnit } from '@/types/game.types';
import { logger } from './logger';
import { notifyAuctionEvent } from './auctionNotification';

/** auction/trade rows use varchar(24) ids — 24-char uuid-hex slice (migration 0008 PK convention). */
function generateRowId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 24);
}

/**
 * Row-partial update payload for the auctions doc-bridge table: mirrored
 * columns (AUCTION_DOC_COLUMNS) also jsonb_set into the stored doc; any
 * non-column key merges into the doc wholesale — the shim's DOC_TABLES
 * updateOne behavior in one place (Law 13: same shape rule, one truth).
 */
function auctionSet(patch: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const docOps: Array<{ path: string; value: unknown }> = [];
  const docMerge: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const mirrored = AUCTION_DOC_COLUMNS.find((m) => m.column === key);
    if (mirrored) {
      if (typeof value === 'boolean') {
        payload[key] = value ? 1 : 0; // pg smallint mirrors
        docOps.push({ path: mirrored.docKey, value }); // doc keeps the boolean
      } else {
        payload[key] = value;
        docOps.push({ path: mirrored.docKey, value });
      }
    } else {
      docMerge[key] = value;
    }
  }
  let docExpr = sql`${auctions.doc}`;
  for (const { path, value } of docOps) {
    docExpr = sql`jsonb_set(${docExpr}, '{${sql.raw(path)}}', ${JSON.stringify(value ?? null)}::jsonb, true)`;
  }
  if (Object.keys(docMerge).length > 0) {
    docExpr = sql`${docExpr} || ${JSON.stringify(docMerge)}::jsonb`;
  }
  payload.doc = docExpr;
  return payload;
}

/** Row → domain overlay through the shared doc-bridge. */
function shapeAuction(row: Record<string, unknown>): AuctionListing {
  return shapeRowAuctions(auctions, row) as unknown as AuctionListing;
}

/** Lookup by the domain auctionId (indexed mirror column). */
async function getAuctionByAuctionId(auctionId: string): Promise<AuctionListing | null> {
  const [row] = await db.select().from(auctions).where(eq(auctions.auctionId, auctionId)).limit(1);
  return row ? shapeAuction(row as unknown as Record<string, unknown>) : null;
}

/** Human-readable item label for notifications. */
function describeAuctionItem(item: AuctionItem): string {
  if (item.itemType === AuctionItemType.Resource) {
    return `${(item.resourceAmount ?? 0).toLocaleString()} ${item.resourceType ?? 'resource'}`;
  }
  if (item.itemType === AuctionItemType.Unit) {
    return `${item.unitType ?? 'unit'} (${item.unitId ?? 'unknown'})`;
  }
  return `${item.tradeableItemQuantity ?? 1}× tradeable item${(item.tradeableItemQuantity ?? 1) > 1 ? 's' : ''}`;
}

/**
 * Create a new auction listing
 * 
 * @param sellerUsername - Username of the seller
 * @param request - Auction creation details
 * @returns Created auction listing
 */
export async function createAuctionListing(
  sellerUsername: string,
  request: CreateAuctionRequest
): Promise<{ success: boolean; message: string; auction?: AuctionListing; error?: string }> {
  try {
    // Get seller
    const [sellerRow] = await db.select().from(players).where(eq(players.username, sellerUsername)).limit(1);
    const seller = sellerRow ? mapRowToPlayer(sellerRow) : null;
    if (!seller) {
      return { success: false, message: 'Seller not found', error: 'SELLER_NOT_FOUND' };
    }

    // Check active listings limit
    const [activeRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .where(and(eq(auctions.sellerUsername, sellerUsername), eq(auctions.status, AuctionStatus.Active)));
    const activeListings = activeRow?.count ?? 0;

    if (activeListings >= AUCTION_CONFIG.MAX_ACTIVE_LISTINGS) {
      return {
        success: false,
        message: `Maximum ${AUCTION_CONFIG.MAX_ACTIVE_LISTINGS} active listings reached`,
        error: 'MAX_LISTINGS_REACHED'
      };
    }

    // Validate starting bid
    if (request.startingBid < AUCTION_CONFIG.MIN_STARTING_BID) {
      return {
        success: false,
        message: `Starting bid must be at least ${AUCTION_CONFIG.MIN_STARTING_BID}`,
        error: 'BID_TOO_LOW'
      };
    }

    if (request.startingBid > AUCTION_CONFIG.MAX_STARTING_BID) {
      return {
        success: false,
        message: `Starting bid cannot exceed ${AUCTION_CONFIG.MAX_STARTING_BID}`,
        error: 'BID_TOO_HIGH'
      };
    }

    // Validate buyout price
    if (request.buyoutPrice && request.buyoutPrice <= request.startingBid) {
      return {
        success: false,
        message: 'Buyout price must be higher than starting bid',
        error: 'INVALID_BUYOUT'
      };
    }

    // Validate reserve price
    if (request.reservePrice && request.reservePrice < request.startingBid) {
      return {
        success: false,
        message: 'Reserve price cannot be lower than starting bid',
        error: 'INVALID_RESERVE'
      };
    }

    // Validate duration
    if (!AUCTION_CONFIG.DURATIONS.includes(request.duration)) {
      return {
        success: false,
        message: 'Invalid duration. Must be 12, 24, or 48 hours',
        error: 'INVALID_DURATION'
      };
    }

    // Calculate listing fee
    const listingFee = request.duration === 12 
      ? AUCTION_CONFIG.LISTING_FEE_12H
      : request.duration === 24
        ? AUCTION_CONFIG.LISTING_FEE_24H
        : AUCTION_CONFIG.LISTING_FEE_48H;

    // Check seller has enough resources for listing fee
    if (seller.resources.metal < listingFee) {
      return {
        success: false,
        message: `Insufficient metal for listing fee (${listingFee} required)`,
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // Validate item ownership and lock item
    const itemValidation = await validateAndLockItem(seller, request.item);
    if (!itemValidation.success) {
      return {
        success: false,
        message: itemValidation.message,
        error: itemValidation.error
      };
    }

    // Calculate sale fee (will be deducted when auction closes)
    const saleFee = request.clanOnly ? AUCTION_CONFIG.CLAN_SALE_FEE : AUCTION_CONFIG.PUBLIC_SALE_FEE;

    // Create auction listing
    const auctionId = `AUC-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.duration * 60 * 60 * 1000);

    const auction: AuctionListing = {
      auctionId,
      sellerUsername,
      // sellerClan: seller.clan, // TODO: Enable in Phase 5 when clans are implemented
      // Unit escrow (FID-20260914-003): freeze the listed unit into the listing.
      // The SERVICE owns the snapshot — the route's zod schema strips unknown
      // keys (no `unitSnapshot` key exists to inject) and the display scalars
      // are OVERWRITTEN from the escrowed unit (FID-20260919-001): clients
      // cannot store fabricated unitStrength/unitDefense/unitType values.
      item: itemValidation.escrowedUnit
        ? {
            ...request.item,
            unitType: itemValidation.escrowedUnit.unitType,
            unitStrength: itemValidation.escrowedUnit.strength,
            unitDefense: itemValidation.escrowedUnit.defense,
            unitSnapshot: itemValidation.escrowedUnit,
          }
        : request.item,
      startingBid: request.startingBid,
      currentBid: request.startingBid,
      buyoutPrice: request.buyoutPrice,
      reservePrice: request.reservePrice,
      bids: [],
      createdAt: now,
      expiresAt,
      duration: request.duration,
      status: AuctionStatus.Active,
      listingFee,
      saleFee,
      clanOnly: request.clanOnly || false,
      settled: false
    };

    // Insert auction (doc-bridge: the bridge synthesizes the stored doc and
    // fills the mirrored columns + legacy NOT NULL columns from the payload).
    const insertPayload: Record<string, unknown> = { ...auction, id: generateRowId() };
    const { syncAuctionDocFields } = await import('./db/auctionDocBridge');
    syncAuctionDocFields(auctions as never, insertPayload);
    await db.insert(auctions).values(insertPayload as never);

    // Deduct listing fee and lock item
    // Merge the listing fee into the item-lock write (fee + locked amount share the
    // resources_metal column). Spreading lockUpdate OVER $inc REPLACED the fee entry,
    // so sellers never actually paid the listing fee (live-verified: 10 metal refund).
    // FID-20260914-003: the lock write may ALSO carry $set (unit escrow removes the
    // unit from the seller's army) — merge it through or the escrow is dropped.
    const metalDelta = -listingFee + (itemValidation.lockUpdate?.incMetal ?? 0);
    const energyDelta = itemValidation.lockUpdate?.incEnergy ?? 0;
    const lockWrite: PgUpdateSetSource<typeof players> = { ...(itemValidation.lockUpdate?.set ?? {}) };
    if (metalDelta !== 0) lockWrite.resourcesMetal = sql`${players.resourcesMetal} + ${metalDelta}`;
    if (energyDelta !== 0) lockWrite.resourcesEnergy = sql`${players.resourcesEnergy} + ${energyDelta}`;
    if (Object.keys(lockWrite).length > 0) {
      await db.update(players).set(lockWrite).where(eq(players.username, sellerUsername));
    }

    logger.info('Auction created', { auctionId, seller: sellerUsername, item: request.item });

    return {
      success: true,
      message: `Auction created! Listing fee: ${listingFee} metal`,
      auction
    };

  } catch (error) {
    logger.error('Error creating auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to create auction',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Validate item ownership and prepare lock update
 */
async function validateAndLockItem(
  player: Player,
  item: AuctionItem
): Promise<{
  success: boolean;
  message: string;
  error?: string;
  lockUpdate?: { set?: PgUpdateSetSource<typeof players>; incMetal?: number; incEnergy?: number };
  escrowedUnit?: PlayerUnit;
}> {
  
  if (item.itemType === AuctionItemType.Unit) {
    // Validate unit ownership
    if (!item.unitId) {
      return { success: false, message: 'Unit ID is required', error: 'INVALID_ITEM' };
    }

    const unit = player.units.find((u) => u.unitId === item.unitId);
    if (!unit) {
      return { success: false, message: 'Unit not found', error: 'UNIT_NOT_FOUND' };
    }

    // ESCROW (FID-20260914-003): the unit leaves the seller's army at listing
    // time — the same pattern as the resource branch's $inc. The old positional
    // `units.$[unit].locked` $set was a silent no-op on the shim (dotted $set
    // maps only on doc-tables; players has no doc column), so one unit could be
    // listed in several live auctions. The full PlayerUnit is snapshotted into
    // the listing (item.unitSnapshot): the escrow record for delivery AND
    // refunds, frozen from stat drift while listed. lockUpdate.$set writes the
    // seller's units array minus the listed unit (direct column — resolves).
    return {
      success: true,
      message: 'Unit validated and escrowed',
      lockUpdate: {
        set: {
          units: player.units.filter((u) => u.unitId !== item.unitId),
        },
      },
      escrowedUnit: unit,
    };

  } else if (item.itemType === AuctionItemType.Resource) {
    // Validate resource amount
    if (!item.resourceType || !item.resourceAmount) {
      return { success: false, message: 'Resource type and amount required', error: 'INVALID_ITEM' };
    }

    const currentAmount = item.resourceType === 'metal' 
      ? player.resources.metal 
      : player.resources.energy;

    if (currentAmount < item.resourceAmount) {
      return {
        success: false,
        message: `Insufficient ${item.resourceType}`,
        error: 'INSUFFICIENT_RESOURCES'
      };
    }

    return {
      success: true,
      message: 'Resources validated',
      lockUpdate:
        item.resourceType === 'energy'
          ? { incEnergy: -item.resourceAmount }
          : { incMetal: -item.resourceAmount },
    };

  } else if (item.itemType === AuctionItemType.TradeableItem) {
    // GATE (FID-20260914-003, finding 5): tradeable-item listings were accepted
    // end-to-end while transferAuctionItem's branch for them is an empty TODO —
    // the buyer paid fees and received nothing. Blocked at the front door until
    // real inventory transfer ships (Phase 5); the UI option is already disabled.
    return {
      success: false,
      message: 'Tradeable item listings are not available yet (coming in a later phase)',
      error: 'TRADEABLE_NOT_TRADEABLE_YET'
    };
  }

  return { success: false, message: 'Invalid item type', error: 'INVALID_ITEM_TYPE' };
}

/**
 * Place a bid on an auction
 * 
 * @param bidderUsername - Username of the bidder
 * @param request - Bid details
 * @returns Bid result
 */
export async function placeBid(
  bidderUsername: string,
  request: PlaceBidRequest
): Promise<{ success: boolean; message: string; auction?: AuctionListing; error?: string }> {
  try {
    // Get bidder
    const [bidderRow] = await db.select().from(players).where(eq(players.username, bidderUsername)).limit(1);
    const bidder = bidderRow ? mapRowToPlayer(bidderRow) : null;
    if (!bidder) {
      return { success: false, message: 'Bidder not found', error: 'BIDDER_NOT_FOUND' };
    }

    // Get auction
    const auction = await getAuctionByAuctionId(request.auctionId);
    if (!auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    // Validate auction status
    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Check if expired
    if (new Date() > auction.expiresAt) {
      return { success: false, message: 'Auction has expired', error: 'AUCTION_EXPIRED' };
    }

    // Check if bidder is seller
    if (bidderUsername === auction.sellerUsername) {
      return { success: false, message: 'Cannot bid on own auction', error: 'SELF_BID' };
    }

    // Check clan-only restriction (TODO: Enable in Phase 5)
    // if (auction.clanOnly && bidder.clan !== auction.sellerClan) {
    //   return { success: false, message: 'This is a clan-only auction', error: 'CLAN_ONLY' };
    // }

    // Validate bid amount
    const minBid = auction.currentBid + AUCTION_CONFIG.MIN_BID_INCREMENT;
    if (request.bidAmount < minBid) {
      return {
        success: false,
        message: `Bid must be at least ${minBid} (current bid + ${AUCTION_CONFIG.MIN_BID_INCREMENT})`,
        error: 'BID_TOO_LOW'
      };
    }

    // Check bidder has enough resources
    if (bidder.resources.metal < request.bidAmount) {
      return {
        success: false,
        message: 'Insufficient metal for bid',
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // ESCROW: deduct the bid from the bidder immediately (FID-20260912-065).
    // Previously bids were honor-system — winners could be broke at settlement.
    await db
      .update(players)
      .set({ resourcesMetal: sql`${players.resourcesMetal} - ${request.bidAmount}` })
      .where(eq(players.username, bidderUsername));

    // Create bid
    const bidId = `BID-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const newBid: AuctionBid = {
      bidId,
      auctionId: request.auctionId,
      bidderUsername,
      bidAmount: request.bidAmount,
      bidTime: new Date(),
      isWinning: true
    };

    // Mark previous winning bid as not winning
    const updatedBids = auction.bids.map((b: AuctionBid) => ({ ...b, isWinning: false }));
    updatedBids.push(newBid);

    // LEADER CLAIM (FID-20260914-003): the leader transition is conditional on
    // the row STILL being active AND still carrying the leader pair we validated
    // against. The claim is arbitrated by a guarded UPDATE ... RETURNING
    // (0 rows = a concurrent buyout/settlement closed the row between
    // validation and now).
    const claimed = await db
      .update(auctions)
      .set(auctionSet({ currentBid: request.bidAmount, highestBidder: bidderUsername, bids: updatedBids }))
      .where(
        and(
          eq(auctions.auctionId, request.auctionId),
          eq(auctions.status, AuctionStatus.Active),
          eq(auctions.currentBid, auction.currentBid),
          auction.highestBidder
            ? eq(auctions.highestBidder, auction.highestBidder)
            : isNull(auctions.highestBidder)
        )
      )
      .returning({ id: auctions.id });

    if (claimed.length === 0) {
      // Lost the race (bought out / settled mid-bid): refund THIS bidder's fresh
      // escrow. The outbid leader was never touched — no other wallet moved.
      await db
        .update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} + ${request.bidAmount}` })
        .where(eq(players.username, bidderUsername));
      return {
        success: false,
        message: 'Auction is no longer active',
        error: 'AUCTION_NOT_ACTIVE'
      };
    }

    // Outbid release: refund the previous leader's escrowed bid (their money was
    // held since their own placeBid). The claim's pair filter guarantees exactly
    // one bidder transitioned from (leader, currentBid) to us, so this release
    // runs exactly once per outbid event. Zero when no prior bids existed.
    const previousBidder = auction.highestBidder;
    const previousAmount = auction.currentBid;
    if (previousBidder && previousAmount > 0) {
      await db
        .update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} + ${previousAmount}` })
        .where(eq(players.username, previousBidder));
      await notifyAuctionEvent('outbid', previousBidder, {
        auctionId: request.auctionId,
        itemName: describeAuctionItem(auction.item),
        amount: request.bidAmount,
        counterparty: bidderUsername,
      });
    }

    const updatedAuction = await getAuctionByAuctionId(request.auctionId);

    logger.info('Bid placed', { auctionId: request.auctionId, bidder: bidderUsername, amount: request.bidAmount });

    return {
      success: true,
      message: `Bid placed successfully! You are the highest bidder at ${request.bidAmount} metal`,
      auction: updatedAuction!
    };

  } catch (error) {
    logger.error('Error placing bid', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to place bid',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Instant buyout of an auction
 * 
 * @param buyerUsername - Username of the buyer
 * @param auctionId - Auction ID
 * @returns Buyout result
 */
export async function buyoutAuction(
  buyerUsername: string,
  auctionId: string
): Promise<{ success: boolean; message: string; trade?: TradeHistory; error?: string }> {
  try {
    // Get buyer
    const [buyerRow] = await db.select().from(players).where(eq(players.username, buyerUsername)).limit(1);
    const buyer = buyerRow ? mapRowToPlayer(buyerRow) : null;
    if (!buyer) {
      return { success: false, message: 'Buyer not found', error: 'BUYER_NOT_FOUND' };
    }

    // Get auction
    const auction = await getAuctionByAuctionId(auctionId);
    if (!auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    // Validate buyout available
    if (!auction.buyoutPrice) {
      return { success: false, message: 'This auction has no buyout price', error: 'NO_BUYOUT' };
    }

    // Validate auction status
    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Check if buyer is seller
    if (buyerUsername === auction.sellerUsername) {
      return { success: false, message: 'Cannot buy own auction', error: 'SELF_PURCHASE' };
    }

    // Check clan-only restriction (TODO: Enable in Phase 5)
    // if (auction.clanOnly && buyer.clan !== auction.sellerClan) {
    //   return { success: false, message: 'This is a clan-only auction', error: 'CLAN_ONLY' };
    // }

    // Check buyer has enough resources
    if (buyer.resources.metal < auction.buyoutPrice) {
      return {
        success: false,
        message: 'Insufficient metal for buyout',
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // CLAIM-FIRST CLOSE (FID-20260914-003, finding 4): flip status Active→Sold
    // BEFORE any money or goods move. The claim is arbitrated by a guarded
    // UPDATE ... RETURNING: 0 rows = a concurrent buyout/settlement won the row
    // — every later competitor fails validation (status no longer Active).
    // This is the exactly-once gate for every write below.
    const claimRows = await db
      .update(auctions)
      .set(
        auctionSet({
          status: AuctionStatus.Sold,
          closedAt: new Date(),
          settled: true,
          settledAt: new Date(),
          finalPrice: auction.buyoutPrice,
          winnerUsername: buyerUsername,
        })
      )
      .where(and(eq(auctions.auctionId, auctionId), eq(auctions.status, AuctionStatus.Active)))
      .returning({ id: auctions.id });
    if (claimRows.length === 0) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // FRESH re-read: the leader under the JUST-CLOSED row. A concurrent placeBid
    // may have become leader after our earlier read — their escrow is the one
    // actually held against this auction, so the fresh leader is the honest one.
    const closedAuction = (await getAuctionByAuctionId(auctionId)) ?? null;
    const leader = closedAuction?.highestBidder;
    const leaderAmount = closedAuction?.currentBid ?? 0;

    // Calculate fees
    const saleFeeAmount = Math.floor(auction.buyoutPrice * auction.saleFee);
    const sellerReceives = auction.buyoutPrice - saleFeeAmount;

    // Transfer item and resources
    const transferResult = await transferAuctionItem(
      auction.sellerUsername,
      buyerUsername,
      auction.item
    );

    if (!transferResult.success) {
      // Roll back the claim so the row stays Active (settlement and other buyers
      // can proceed); leader escrow untouched — nobody paid yet.
      await db
        .update(auctions)
        .set(
          auctionSet({
            status: AuctionStatus.Active,
            settled: false,
            settledAt: null,
            closedAt: null,
            finalPrice: null,
            winnerUsername: null,
          })
        )
        .where(eq(auctions.auctionId, auctionId));
      return {
        success: false,
        message: transferResult.message,
        error: transferResult.error
      };
    }

    // Seller receives price minus fee.
    await db
      .update(players)
      .set({ resourcesMetal: sql`${players.resourcesMetal} + ${sellerReceives}` })
      .where(eq(players.username, auction.sellerUsername));

    // Leader resolution (FID-20260914-003): the previous leader's escrowed bid
    // comes OUT of this close exactly once (the claim gates re-entry).
    // - Different player → their metal is refunded; it was never part of this
    //   sale (pre-FID buyout forfeited it silently).
    // - Leader IS the buyer → their escrow IS the payment: charge only the
    //   remainder. (buyout > currentBid by validation, so the remainder is > 0;
    //   the guard keeps the ledger honest regardless.)
    if (leader && leaderAmount > 0 && leader !== buyerUsername) {
      await db
        .update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} + ${leaderAmount}` })
        .where(eq(players.username, leader));
    }
    const buyerCharge =
      leader === buyerUsername ? auction.buyoutPrice - leaderAmount : auction.buyoutPrice;
    if (buyerCharge > 0) {
      await db
        .update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} - ${buyerCharge}` })
        .where(eq(players.username, buyerUsername));
    }

    void notifyAuctionEvent('sold_seller', auction.sellerUsername, {
      auctionId,
      itemName: describeAuctionItem(auction.item),
      amount: sellerReceives,
      counterparty: buyerUsername,
    });
    void notifyAuctionEvent('sold_winner', buyerUsername, {
      auctionId,
      itemName: describeAuctionItem(auction.item),
      amount: auction.buyoutPrice,
      counterparty: auction.sellerUsername,
    });

    // Create trade history (status/winner/finalPrice were set by the claim above)
    const tradeId = `TRD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const trade: TradeHistory = {
      tradeId,
      auctionId,
      sellerUsername: auction.sellerUsername,
      buyerUsername,
      item: auction.item,
      finalPrice: auction.buyoutPrice,
      saleFee: saleFeeAmount,
      sellerReceived: sellerReceives,
      tradeType: 'buyout',
      completedAt: new Date()
    };

    await db.insert(tradeHistory).values({
      id: generateRowId(),
      tradeId,
      auctionId,
      sellerUsername: auction.sellerUsername,
      buyerUsername,
      item: auction.item as unknown as Record<string, unknown>,
      finalPrice: auction.buyoutPrice,
      saleFee: saleFeeAmount,
      sellerReceived: sellerReceives,
      tradeType: 'buyout',
      completedAt: new Date()
    });

    logger.info('Auction bought out', { auctionId, buyer: buyerUsername, price: auction.buyoutPrice });

    return {
      success: true,
      message: `Successfully purchased! Paid ${auction.buyoutPrice} metal`,
      trade
    };

  } catch (error) {
    logger.error('Error buying out auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to complete buyout',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Transfer auction item from seller to buyer
 */
async function transferAuctionItem(
  fromUsername: string,
  toUsername: string,
  item: AuctionItem
): Promise<{ success: boolean; message: string; error?: string }> {
  if (item.itemType === AuctionItemType.Unit) {
    // Deliver the ESCROWED unit (FID-20260914-003). With unit escrow the goods
    // left the seller at listing time — delivery is a buyer-side jsonb append of
    // the snapshotted object. The old seller-side $pull is GONE: the live probe
    // (scripts/probePullObjectOperand.ts) proved the shim's $pull SQL is invalid
    // on this engine (no jsonb - jsonb operator), so it could never execute.
    // Legacy (pre-escrow) listings still find the unit in the seller's army and
    // remove it via an array-rebuild write — the same idiom placeBid uses for bids.
    let seller: Player | null = null;
    if (!item.unitSnapshot) {
      const [row] = await db.select().from(players).where(eq(players.username, fromUsername)).limit(1);
      seller = row ? mapRowToPlayer(row) : null;
    }
    const unit: PlayerUnit | undefined =
      item.unitSnapshot ?? seller?.units.find((u) => u.unitId === item.unitId);

    if (!unit) {
      return { success: false, message: 'Unit not found', error: 'UNIT_NOT_FOUND' };
    }

    if (!item.unitSnapshot && seller) {
      await db
        .update(players)
        .set({ units: seller.units.filter((u) => u.unitId !== item.unitId) })
        .where(eq(players.username, fromUsername));
    }

    // Add to buyer (atomic jsonb append — the $push equivalent)
    await db
      .update(players)
      .set({
        units: sql`coalesce(${players.units}, '[]'::jsonb) || ${JSON.stringify([unit])}::jsonb`,
      })
      .where(eq(players.username, toUsername));

  } else if (item.itemType === AuctionItemType.Resource) {
    // Resources were escrowed from the seller at listing time — credit the buyer.
    // (FID-20260912-065: the delivery write previously keyed bare 'metal'/'energy',
    // which map to no column and silently vanished.)
    const amount = item.resourceAmount ?? 0;
    if (item.resourceType === 'energy') {
      await db
        .update(players)
        .set({ resourcesEnergy: sql`${players.resourcesEnergy} + ${amount}` })
        .where(eq(players.username, toUsername));
    } else {
      await db
        .update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} + ${amount}` })
        .where(eq(players.username, toUsername));
    }

  } else if (item.itemType === AuctionItemType.TradeableItem) {
    // Transfer tradeable items
    // TODO: Implement proper tradeable item transfer
  }

  return { success: true, message: 'Item transferred' };
}

/**
 * Cancel an auction (seller only, no bids)
 * 
 * @param sellerUsername - Username of the seller
 * @param auctionId - Auction ID
 * @returns Cancellation result
 */
export async function cancelAuction(
  sellerUsername: string,
  auctionId: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // Get auction
    const auction = await getAuctionByAuctionId(auctionId);
    if (!auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    // Verify ownership
    if (auction.sellerUsername !== sellerUsername) {
      return { success: false, message: 'Not authorized', error: 'NOT_AUTHORIZED' };
    }

    // Check if active
    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Check if bids exist
    if (auction.bids.length > 0) {
      return {
        success: false,
        message: 'Cannot cancel auction with existing bids',
        error: 'HAS_BIDS'
      };
    }

    // CLAIM the close (FID-20260914-003): refunds may only be paid by the writer
    // that flips the row. The old code updated status unconditionally and then
    // refunded — two concurrent cancels (double-click) would pay the escrow
    // twice. The guarded UPDATE arbitrates: 0 rows = someone else closed it first.
    const claimRows = await db
      .update(auctions)
      .set(
        auctionSet({
          status: AuctionStatus.Cancelled,
          closedAt: new Date(),
          settled: true,
          settledAt: new Date(),
        })
      )
      .where(and(eq(auctions.auctionId, auctionId), eq(auctions.status, AuctionStatus.Active)))
      .returning({ id: auctions.id });
    if (claimRows.length === 0) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Refund escrowed goods to the seller (FID-20260912-065 resources,
    // FID-20260914-003 units). Listing removed the goods from the seller's
    // wallet/army; cancellation returns them exactly once (claim-guarded above).
    if (auction.item.itemType === AuctionItemType.Resource && (auction.item.resourceAmount ?? 0) > 0) {
      const refundWrite: PgUpdateSetSource<typeof players> = {};
      if (auction.item.resourceType === 'energy') {
        refundWrite.resourcesEnergy = sql`${players.resourcesEnergy} + ${auction.item.resourceAmount ?? 0}`;
      } else {
        refundWrite.resourcesMetal = sql`${players.resourcesMetal} + ${auction.item.resourceAmount ?? 0}`;
      }
      await db.update(players).set(refundWrite).where(eq(players.username, sellerUsername));
    }
    if (auction.item.itemType === AuctionItemType.Unit && auction.item.unitSnapshot) {
      await db
        .update(players)
        .set({
          units: sql`coalesce(${players.units}, '[]'::jsonb) || ${JSON.stringify([auction.item.unitSnapshot])}::jsonb`,
        })
        .where(eq(players.username, sellerUsername));
    }
    void notifyAuctionEvent('refund_seller', sellerUsername, {
      auctionId,
      itemName: describeAuctionItem(auction.item),
    });

    logger.info('Auction cancelled', { auctionId, seller: sellerUsername });

    return {
      success: true,
      message: 'Auction cancelled successfully. Listing fee is non-refundable.'
    };

  } catch (error) {
    logger.error('Error cancelling auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to cancel auction',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Get active auctions with filters
 * 
 * @param filters - Search and filter options
 * @returns List of auctions
 */
export async function getAuctions(
  filters: AuctionSearchFilters
): Promise<{ success: boolean; auctions: AuctionListing[]; total: number; error?: string }> {
  try {
    // Build conditions (auctions schema has direct columns: status, item type, seller)
    const conditions: SQL[] = [eq(auctions.status, AuctionStatus.Active)];

    if (filters.itemType) {
      conditions.push(sql`${auctions.doc}->'item'->>'itemType' = ${filters.itemType}`);
    }

    if (filters.unitType) {
      conditions.push(sql`${auctions.doc}->'item'->>'unitType' = ${filters.unitType}`);
    }

    if (filters.resourceType) {
      conditions.push(sql`${auctions.doc}->'item'->>'resourceType' = ${filters.resourceType}`);
    }

    if (filters.minPrice) {
      conditions.push(gte(auctions.currentBid, filters.minPrice));
    }

    if (filters.maxPrice) {
      conditions.push(lte(auctions.currentBid, filters.maxPrice));
    }

    if (filters.hasBuyout !== undefined) {
      conditions.push(
        filters.hasBuyout ? isNotNull(auctions.buyoutPrice) : isNull(auctions.buyoutPrice)
      );
    }

    if (filters.clanOnly !== undefined) {
      conditions.push(eq(auctions.clanOnly, filters.clanOnly ? 1 : 0));
    }

    if (filters.sellerUsername) {
      conditions.push(eq(auctions.sellerUsername, filters.sellerUsername));
    }

    // Sorting
    let orderBy: SQL | ReturnType<typeof asc> | ReturnType<typeof desc> = desc(auctions.createdAt);
    switch (filters.sortBy) {
      case 'price_asc':
        orderBy = asc(auctions.currentBid);
        break;
      case 'price_desc':
        orderBy = desc(auctions.currentBid);
        break;
      case 'ending_soon':
        orderBy = asc(auctions.expiresAt);
        break;
      case 'newly_listed':
      default:
        orderBy = desc(auctions.createdAt);
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const where = and(...conditions);

    // Get total count
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .where(where);
    const total = countRow?.count ?? 0;

    // Get auctions (rows shaped through the shared doc-bridge)
    const rows = await db
      .select()
      .from(auctions)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(skip);
    const shaped = rows.map((row) => shapeAuction(row as unknown as Record<string, unknown>));

    return { success: true, auctions: shaped, total };

  } catch (error) {
    logger.error('Error getting auctions', error instanceof Error ? error : new Error(String(error)));
    return { success: false, auctions: [], total: 0, error: 'SERVER_ERROR' };
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Listing fees are non-refundable to prevent spam
// - Sale fees are deducted from final price when auction closes
// - Items are locked when listed (removed from inventory/units)
// - Bids lock buyer's resources until outbid or auction ends
// - Auto-settlement closes auction after grace period
// - Clan-only auctions have 0% fees
// - Reserve price is hidden from buyers
// ============================================================
// END OF FILE
// ============================================================

// ============================================================
// FID-20260912-065 — Settlement engine (expired auctions)
// ============================================================

/**
 * Settle a single expired auction and return the outcome.
 *
 * Called by the auctionSettlementManager job (every 5 min). An auction is
 * settle-eligible when status is Active AND expiresAt has passed. Outcomes:
 * - With bids  → Sold to highest bidder: item already escrowed from the seller
 *   (delivered via transferAuctionItem), winner's bid was already escrowed at
 *   placeBid (credited to seller minus sale fee; winner receives nothing extra —
 *   their metal left at bid time and the goods arrive here).
 * - No bids    → Expired: escrowed goods return to the seller.
 *
 * Guarded by a conditional update (claim) so concurrent job ticks or a job +
 * a live bid/buyout racing the expiry boundary cannot double-settle: only the
 * writer that flips status Active→settling earns the right to pay out.
 */
async function settleExpiredAuction(
  auction: AuctionListing
): Promise<{ auctionId: string; outcome: 'sold' | 'expired'; error?: string }> {
  // Claim: atomically flip Active → Expired-claim marker. 0 rows = lost the
  // race (already settled/cancelled, or a bid/buyout flipped status first).
  const claimRows = await db
    .update(auctions)
    .set(auctionSet({ status: AuctionStatus.Expired, closedAt: new Date() }))
    .where(and(eq(auctions.auctionId, auction.auctionId), eq(auctions.status, AuctionStatus.Active)))
    .returning({ id: auctions.id });
  if (claimRows.length !== 1) {
    return { auctionId: auction.auctionId, outcome: 'expired', error: 'CLAIM_LOST' };
  }

  const hasBids = auction.bids.length > 0 && !!auction.highestBidder;

  if (!hasBids) {
    // Expired unsold: refund escrowed goods (FID-20260912-065 resources,
    // FID-20260914-003 units — the escrowed unit returns to the seller's army).
    if (
      auction.item.itemType === AuctionItemType.Resource &&
      (auction.item.resourceAmount ?? 0) > 0
    ) {
      const refundWrite: PgUpdateSetSource<typeof players> = {};
      if (auction.item.resourceType === 'energy') {
        refundWrite.resourcesEnergy = sql`${players.resourcesEnergy} + ${auction.item.resourceAmount ?? 0}`;
      } else {
        refundWrite.resourcesMetal = sql`${players.resourcesMetal} + ${auction.item.resourceAmount ?? 0}`;
      }
      await db.update(players).set(refundWrite).where(eq(players.username, auction.sellerUsername));
    }
    if (auction.item.itemType === AuctionItemType.Unit && auction.item.unitSnapshot) {
      await db
        .update(players)
        .set({
          units: sql`coalesce(${players.units}, '[]'::jsonb) || ${JSON.stringify([auction.item.unitSnapshot])}::jsonb`,
        })
        .where(eq(players.username, auction.sellerUsername));
    }
    void notifyAuctionEvent('expired_seller', auction.sellerUsername, {
      auctionId: auction.auctionId,
      itemName: describeAuctionItem(auction.item),
    });

    await db
      .update(auctions)
      .set(auctionSet({ settled: true, settledAt: new Date() }))
      .where(eq(auctions.auctionId, auction.auctionId));
    return { auctionId: auction.auctionId, outcome: 'expired' };
  }

  // Sold at hammer: deliver goods, credit seller, record trade.
  const winner = auction.highestBidder!;
  const finalPrice = auction.currentBid;
  const saleFeeAmount = Math.floor(finalPrice * auction.saleFee);
  const sellerReceives = finalPrice - saleFeeAmount;

  const transferResult = await transferAuctionItem(
    auction.sellerUsername,
    winner,
    auction.item
  );

  if (!transferResult.success) {
    // Delivery failed (e.g. unit no longer present). Refund the winner's escrow
    // and return goods escrow, then mark Expired-settled so we don't retry forever.
    await db
      .update(players)
      .set({ resourcesMetal: sql`${players.resourcesMetal} + ${finalPrice}` })
      .where(eq(players.username, winner));
    if (
      auction.item.itemType === AuctionItemType.Resource &&
      (auction.item.resourceAmount ?? 0) > 0
    ) {
      const refundWrite: PgUpdateSetSource<typeof players> = {};
      if (auction.item.resourceType === 'energy') {
        refundWrite.resourcesEnergy = sql`${players.resourcesEnergy} + ${auction.item.resourceAmount ?? 0}`;
      } else {
        refundWrite.resourcesMetal = sql`${players.resourcesMetal} + ${auction.item.resourceAmount ?? 0}`;
      }
      await db.update(players).set(refundWrite).where(eq(players.username, auction.sellerUsername));
    }
    if (auction.item.itemType === AuctionItemType.Unit && auction.item.unitSnapshot) {
      await db
        .update(players)
        .set({
          units: sql`coalesce(${players.units}, '[]'::jsonb) || ${JSON.stringify([auction.item.unitSnapshot])}::jsonb`,
        })
        .where(eq(players.username, auction.sellerUsername));
    }
    await db
      .update(auctions)
      .set(auctionSet({ settled: true, settledAt: new Date() }))
      .where(eq(auctions.auctionId, auction.auctionId));
    return { auctionId: auction.auctionId, outcome: 'expired', error: 'TRANSFER_FAILED' };
  }

  // Winner's metal already left their wallet at bid time — pay the seller.
  await db
    .update(players)
    .set({ resourcesMetal: sql`${players.resourcesMetal} + ${sellerReceives}` })
    .where(eq(players.username, auction.sellerUsername));

  void notifyAuctionEvent('sold_seller', auction.sellerUsername, {
    auctionId: auction.auctionId,
    itemName: describeAuctionItem(auction.item),
    amount: sellerReceives,
    counterparty: winner,
  });
  void notifyAuctionEvent('won_settlement', winner, {
    auctionId: auction.auctionId,
    itemName: describeAuctionItem(auction.item),
    amount: finalPrice,
    counterparty: auction.sellerUsername,
  });

  await db
    .update(auctions)
    .set(
      auctionSet({
        status: AuctionStatus.Sold,
        settled: true,
        settledAt: new Date(),
        finalPrice,
        winnerUsername: winner,
      })
    )
    .where(eq(auctions.auctionId, auction.auctionId));

  const tradeId = `TRD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
  await db.insert(tradeHistory).values({
    id: generateRowId(),
    tradeId,
    auctionId: auction.auctionId,
    sellerUsername: auction.sellerUsername,
    buyerUsername: winner,
    item: auction.item as unknown as Record<string, unknown>,
    finalPrice,
    saleFee: saleFeeAmount,
    sellerReceived: sellerReceives,
    tradeType: 'auction',
    completedAt: new Date()
  });

  return { auctionId: auction.auctionId, outcome: 'sold' };
}

/**
 * Settle every overdue auction. Idempotent and race-safe (claim guard above).
 * @returns per-run counters for the jobs-status panel.
 */
export async function settleExpiredAuctions(): Promise<{
  success: boolean;
  checked: number;
  sold: number;
  expired: number;
  errors: number;
  message: string;
}> {
  try {
    const overdue = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.status, AuctionStatus.Active), lt(auctions.expiresAt, new Date())))
      .limit(100);
    const overdueAuctions = overdue.map((row) => shapeAuction(row as unknown as Record<string, unknown>));

    let sold = 0;
    let expired = 0;
    let errors = 0;
    for (const auction of overdueAuctions) {
      try {
        const result = await settleExpiredAuction(auction);
        if (result.error === 'CLAIM_LOST') continue;
        if (result.outcome === 'sold') sold += 1;
        else expired += 1;
        if (result.error === 'TRANSFER_FAILED') errors += 1;
      } catch (err) {
        errors += 1;
        logger.error('Settlement failed for auction', err instanceof Error ? err : new Error(String(err)));
      }
    }

    return {
      success: true,
      checked: overdue.length,
      sold,
      expired,
      errors,
      message: `Settled ${overdue.length} overdue auction(s): ${sold} sold, ${expired} expired`
    };
  } catch (error) {
    logger.error('Error running auction settlement', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      checked: 0,
      sold: 0,
      expired: 0,
      errors: 1,
      message: 'Settlement run failed'
    };
  }
}